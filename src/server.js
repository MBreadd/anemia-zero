const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const { port, appBaseUrl, telegram, session: sessionConfig } = require("./config");
const {
  initDb,
  getPatients,
  createPatient,
  createOutboundMessage,
  getStats,
  getUserByUsername,
  getPatientsByDepartment
} = require("./db");
const { calculateRiskScore } = require("./riskModel");
const telegramService = require("./services/telegram");
const anemiaAnalytics = require("./data/anemia_analytics.json");
const peruDepartments = require("./data/peru_departments.json");
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

app.post("/api/messages/send", requireAuth, requireRole("admin", "promotor"), async (req, res, next) => {
  try {
    const { patientId, chatId, nombre, riskLevel, token } = req.body || {};
    if (!chatId) {
      return res.status(400).json({ ok: false, error: "chatId es obligatorio" });
    }

    const templateFn = telegramService.templates[riskLevel] || telegramService.templates.medio;
    const text = templateFn(nombre || "el niño");

    const providerResponse = await telegramService.sendMessage({
      token,
      chatId,
      text
    });

    const status = providerResponse.ok ? "sent" : "failed";

    const message = await createOutboundMessage({
      patientId,
      channel: "telegram",
      text,
      status,
      providerMessageId: providerResponse.result?.message_id ? String(providerResponse.result.message_id) : null,
      providerResponse
    });

    return res.json({
      ok: providerResponse.ok,
      simulated: providerResponse.simulated || false,
      data: {
        message,
        providerResponse
      }
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/telegram/get-me", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { token } = req.body || {};
    const response = await telegramService.getMe(token);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

app.post("/api/telegram/set-webhook", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { token, webhookBaseUrl } = req.body || {};
    const response = await telegramService.setWebhook({
      token,
      webhookBaseUrl: webhookBaseUrl || appBaseUrl
    });
    res.json(response);
  } catch (error) {
    next(error);
  }
});

app.post("/api/telegram/webhook", async (req, res) => {
  const secret = req.query.secret;
  if (secret !== telegram.webhookSecret) {
    return res.status(401).json({ ok: false, error: "Webhook no autorizado" });
  }

  const messageText = req.body?.message?.text;
  const fromId = req.body?.message?.from?.id;

  if (messageText && fromId && telegram.token) {
    if (messageText.toLowerCase() === "ok") {
      await telegramService.sendMessage({
        chatId: fromId,
        text: "Gracias por confirmar. Seguimos acompanando el tratamiento."
      });
    }
  }

  return res.json({ ok: true });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({
    ok: false,
    error: "Error interno del servidor",
    details: error.message
  });
});

async function bootstrap() {
  await initDb();
  app.listen(port, () => {
    console.log(`anemia_zero corriendo en http://localhost:${port}`);
  });
}

bootstrap().catch((error) => {
  console.error("No se pudo iniciar la aplicacion", error);
  process.exit(1);
});
