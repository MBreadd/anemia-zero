const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  port: Number(process.env.PORT || 3000),
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
  db: {
    // Si defines DATABASE_URL (Neon, Supabase, Vercel Postgres, etc.) tiene prioridad
    // sobre las variables sueltas DB_*. Estos proveedores exigen SSL.
    connectionString: process.env.DATABASE_URL || null,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || "anemia_zero",
    password: process.env.DB_PASSWORD || "anemia_zero",
    database: process.env.DB_NAME || "anemia_zero"
  },
  session: {
    secret: process.env.SESSION_SECRET || "cambia-este-secreto-en-produccion",
    cookieName: "az_session",
    ttlMs: 12 * 60 * 60 * 1000
  }
};
