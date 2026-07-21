const { Pool } = require("pg");
const { db } = require("./config");

const pool = new Pool({
  host: db.host,
  port: db.port,
  user: db.user,
  password: db.password,
  database: db.database
});

let memoryMode = false;
let patientCounter = 1;
let messageCounter = 1;
const memoryPatients = [];
const memoryMessages = [];

async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id BIGSERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        edad INTEGER NOT NULL,
        hb NUMERIC(4,1) NOT NULL,
        km NUMERIC(5,2) NOT NULL,
        omitidas INTEGER NOT NULL,
        idioma TEXT NOT NULL,
        chat_id TEXT,
        risk_score INTEGER NOT NULL,
        risk_level TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS outbound_messages (
        id BIGSERIAL PRIMARY KEY,
        patient_id BIGINT REFERENCES patients(id) ON DELETE CASCADE,
        channel TEXT NOT NULL,
        text TEXT NOT NULL,
        status TEXT NOT NULL,
        provider_message_id TEXT,
        provider_response JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
  } catch (error) {
    memoryMode = true;
    console.warn("PostgreSQL no disponible. Se activa modo memoria para demo.", error.message);
  }
}

async function getPatients() {
  if (memoryMode) {
    return [...memoryPatients].sort((a, b) => {
      if (b.riskScore !== a.riskScore) {
        return b.riskScore - a.riskScore;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  const result = await pool.query(`
    SELECT id, nombre, edad, hb::float8 AS hb, km::float8 AS km, omitidas, idioma,
           chat_id AS "chatId", risk_score AS "riskScore", risk_level AS "riskLevel",
           created_at AS "createdAt"
    FROM patients
    ORDER BY risk_score DESC, created_at DESC
  `);
  return result.rows;
}

async function createPatient(patient) {
  if (memoryMode) {
    const createdPatient = {
      id: patientCounter++,
      nombre: patient.nombre,
      edad: Number(patient.edad),
      hb: Number(patient.hb),
      km: Number(patient.km),
      omitidas: Number(patient.omitidas),
      idioma: patient.idioma,
      chatId: patient.chatId || null,
      riskScore: Number(patient.riskScore),
      riskLevel: patient.riskLevel,
      createdAt: new Date().toISOString()
    };
    memoryPatients.push(createdPatient);
    return createdPatient;
  }

  const result = await pool.query(
    `
      INSERT INTO patients (nombre, edad, hb, km, omitidas, idioma, chat_id, risk_score, risk_level)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id, nombre, edad, hb::float8 AS hb, km::float8 AS km, omitidas, idioma,
                chat_id AS "chatId", risk_score AS "riskScore", risk_level AS "riskLevel",
                created_at AS "createdAt"
    `,
    [
      patient.nombre,
      patient.edad,
      patient.hb,
      patient.km,
      patient.omitidas,
      patient.idioma,
      patient.chatId || null,
      patient.riskScore,
      patient.riskLevel
    ]
  );
  return result.rows[0];
}

async function createOutboundMessage(message) {
  if (memoryMode) {
    const createdMessage = {
      id: messageCounter++,
      patientId: message.patientId || null,
      channel: message.channel,
      text: message.text,
      status: message.status,
      providerMessageId: message.providerMessageId || null,
      createdAt: new Date().toISOString()
    };
    memoryMessages.push(createdMessage);
    return createdMessage;
  }

  const result = await pool.query(
    `
      INSERT INTO outbound_messages (patient_id, channel, text, status, provider_message_id, provider_response)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, patient_id AS "patientId", channel, text, status,
                provider_message_id AS "providerMessageId", created_at AS "createdAt"
    `,
    [
      message.patientId || null,
      message.channel,
      message.text,
      message.status,
      message.providerMessageId || null,
      JSON.stringify(message.providerResponse || {})
    ]
  );

  return result.rows[0];
}

async function getStats() {
  if (memoryMode) {
    const total = memoryPatients.length;
    const alto = memoryPatients.filter((item) => item.riskLevel === "alto").length;
    const hbPromedio = total
      ? Number((memoryPatients.reduce((sum, item) => sum + Number(item.hb), 0) / total).toFixed(1))
      : null;
    const mensajesEnviados = memoryMessages.filter((item) => item.status === "sent").length;

    return {
      total,
      alto,
      hbPromedio,
      mensajesEnviados
    };
  }

  const summaryResult = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE risk_level = 'alto')::int AS alto,
      AVG(hb)::float8 AS hb_promedio
    FROM patients
  `);

  const messagesResult = await pool.query(`
    SELECT COUNT(*)::int AS enviados
    FROM outbound_messages
    WHERE status = 'sent'
  `);

  return {
    total: summaryResult.rows[0].total || 0,
    alto: summaryResult.rows[0].alto || 0,
    hbPromedio: summaryResult.rows[0].hb_promedio ? Number(summaryResult.rows[0].hb_promedio.toFixed(1)) : null,
    mensajesEnviados: messagesResult.rows[0].enviados || 0
  };
}

module.exports = {
  pool,
  initDb,
  getPatients,
  createPatient,
  createOutboundMessage,
  getStats
};
