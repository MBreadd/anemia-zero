const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const { port, appBaseUrl, telegram } = require("./config");
const {
  initDb,
  getPatients,
  createPatient,
  createOutboundMessage,
  getStats
} = require("./db");
const { calculateRiskScore } = require("./riskModel");
const telegramService = require("./services/telegram");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "..")));

app.get("/api/health", async (req, res) => {
  res.json({
    status: "ok",
    service: "hemopuno-mvp",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/patients", async (req, res, next) => {
  try {
    const rows = await getPatients();
    res.json({ ok: true, data: rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/predict", (req, res) => {
  const prediction = calculateRiskScore(req.body || {});
  res.json({ ok: true, data: prediction });
});

app.get("/api/stats", async (req, res, next) => {
  try {
    const stats = await getStats();
    res.json({ ok: true, data: stats });
  } catch (error) {
    next(error);
  }
});

app.post("/api/patients", async (req, res, next) => {
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

app.post("/api/messages/send", async (req, res, next) => {
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

app.post("/api/telegram/get-me", async (req, res, next) => {
  try {
    const { token } = req.body || {};
    const response = await telegramService.getMe(token);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

app.post("/api/telegram/set-webhook", async (req, res, next) => {
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
    console.log(`HemoPuno MVP corriendo en http://localhost:${port}`);
  });
}

bootstrap().catch((error) => {
  console.error("No se pudo iniciar la aplicacion", error);
  process.exit(1);
});
