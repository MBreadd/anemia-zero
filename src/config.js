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
    user: process.env.DB_USER || "hemopuno",
    password: process.env.DB_PASSWORD || "hemopuno",
    database: process.env.DB_NAME || "hemopuno"
  },
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || "",
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || "hackathon-secret",
    allowSimulation: readBool(process.env.TELEGRAM_ALLOW_SIMULATION, true)
  }
};
