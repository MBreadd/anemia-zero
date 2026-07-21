const dotenv = require("dotenv");

dotenv.config();

function readBool(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

module.exports = {
  port: Number(process.env.PORT || 3000),
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
  db: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || "anemia_zero",
    password: process.env.DB_PASSWORD || "anemia_zero",
    database: process.env.DB_NAME || "anemia_zero"
  },
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || "",
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || "hackathon-secret",
    allowSimulation: readBool(process.env.TELEGRAM_ALLOW_SIMULATION, true)
  },
  session: {
    secret: process.env.SESSION_SECRET || "cambia-este-secreto-en-produccion",
    cookieName: "az_session",
    ttlMs: 12 * 60 * 60 * 1000
  }
};
