const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const { port, session: sessionConfig } = require("./config");
const {
  initDb,
  getPatients,
  createPatient,
  getStats,
  getUserByUsername,
  getPatientsByDepartment,
  getProvinciasPuno,
  createAyuda,
  getAyudas
} = require("./db");
const { calculateRiskScore } = require("./riskModel");
const anemiaAnalytics = require("./data/anemia_analytics.json");
const peruDepartments = require("./data/peru_departments.json");
const punoProvinces = require("./data/puno_provinces.json");
const referenciaSalud = require("./data/referencia_salud.json");
const {
  verifyPassword,
  createSession,
  destroySession,
  parseCookies,
  requireAuth,
  requireRole
} = require("./auth");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "..")));

let dbReady = null;
app.use((req, res, next) => {
  if (!dbReady) dbReady = initDb();
  dbReady.then(() => next()).catch(next);
});

app.get("/api/health", async (req, res) => {
  res.json({
    status: "ok",
    service: "anemia_zero",
    timestamp: new Date().toISOString()
  });
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: "Usuario y contrasena son obligatorios" });
    }

    const user = await getUserByUsername(String(username).trim().toLowerCase());
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ ok: false, error: "Credenciales invalidas" });
    }

    const token = createSession(user);
    const maxAgeSeconds = Math.floor(sessionConfig.ttlMs / 1000);
    res.setHeader(
      "Set-Cookie",
      `${sessionConfig.cookieName}=${token}; HttpOnly; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`
    );

    return res.json({
      ok: true,
      data: { username: user.username, name: user.name, role: user.role }
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/auth/logout", (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[sessionConfig.cookieName];
  destroySession(token);
  res.setHeader(
    "Set-Cookie",
    `${sessionConfig.cookieName}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
  );
  res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({
    ok: true,
    data: {
      username: req.session.username,
      name: req.session.name,
      role: req.session.role
    }
  });
});

app.get("/api/patients", requireAuth, async (req, res, next) => {
  try {
    const rows = await getPatients();
    res.json({ ok: true, data: rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/predict", requireAuth, (req, res) => {
  const prediction = calculateRiskScore(req.body || {});
  res.json({ ok: true, data: prediction });
});

app.get("/api/analytics/anemia", requireAuth, (req, res) => {
  res.json({ ok: true, data: anemiaAnalytics });
});

app.get("/api/geo/peru-departments", requireAuth, (req, res) => {
  res.json({ ok: true, data: peruDepartments });
});

app.get("/api/geo/patients-by-department", requireAuth, async (req, res, next) => {
  try {
    const rows = await getPatientsByDepartment();
    res.json({ ok: true, data: rows });
  } catch (error) {
    next(error);
  }
});

app.get("/api/geo/puno-provinces", requireAuth, (req, res) => {
  res.json({ ok: true, data: punoProvinces });
});

app.get("/api/geo/puno-provincias-datos", requireAuth, async (req, res, next) => {
  try {
    const rows = await getProvinciasPuno();
    res.json({ ok: true, data: rows });
  } catch (error) {
    next(error);
  }
});

app.get("/api/referencia/salud", requireAuth, (req, res) => {
  res.json({ ok: true, data: referenciaSalud });
});

app.get("/api/stats", requireAuth, async (req, res, next) => {
  try {
    const stats = await getStats();
    res.json({ ok: true, data: stats });
  } catch (error) {
    next(error);
  }
});

app.post("/api/patients", requireAuth, requireRole("admin", "promotor"), async (req, res, next) => {
  try {
    const body = req.body || {};
    const required = ["nombre", "edad", "hb", "km", "omitidas", "idioma"];
    const missing = required.filter((field) => body[field] === undefined || body[field] === "");

    if (missing.length > 0) {
      return res.status(400).json({ ok: false, error: `Campos faltantes: ${missing.join(", ")}` });
    }

    const prediction = calculateRiskScore(body);
    const patient = await createPatient({
      ...body,
      riskScore: prediction.score,
      riskLevel: prediction.level
    });

    return res.status(201).json({
      ok: true,
      data: {
        patient,
        prediction
      }
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/ayudas", requireAuth, async (req, res, next) => {
  try {
    const rows = await getAyudas();
    res.json({ ok: true, data: rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/ayudas", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { departamento, provincia, tipo, nota } = req.body || {};
    if (!departamento || !tipo) {
      return res.status(400).json({ ok: false, error: "Departamento y tipo de ayuda son obligatorios" });
    }

    const ayuda = await createAyuda({
      departamento: String(departamento).toUpperCase(),
      provincia: provincia ? String(provincia).toUpperCase() : null,
      tipo,
      nota: nota || "",
      enviadoPor: req.session.name
    });

    return res.status(201).json({ ok: true, data: ayuda });
  } catch (error) {
    return next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({
    ok: false,
    error: "Error interno del servidor",
    details: error.message
  });
});

// Solo abre un puerto cuando se ejecuta directamente (node src/server.js, npm start, Docker).
// En Vercel este archivo se importa como funcion serverless: no debe llamar a listen().
if (require.main === module) {
  app.listen(port, () => {
    console.log(`anemia_zero corriendo en http://localhost:${port}`);
  });
}

module.exports = app;
