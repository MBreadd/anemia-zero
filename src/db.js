const { Pool } = require("pg");
const { db } = require("./config");
const { hashPassword } = require("./auth");
const { computeVulnerability } = require("./predictiveModel");

const pool = new Pool(
  db.connectionString
    ? { connectionString: db.connectionString, ssl: db.ssl }
    : { host: db.host, port: db.port, user: db.user, password: db.password, database: db.database }
);

let memoryMode = false;
let patientCounter = 1;
let ayudaCounter = 1;
let userCounter = 1;
const memoryPatients = [];
const memoryAyudas = [];
const memoryUsers = [];

const DEFAULT_USERS = [
  { username: "admin", password: "anemia2026", name: "Administradora General", role: "admin" },
  { username: "promotor", password: "anemia2026", name: "Promotor de Salud", role: "promotor" }
];

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
        departamento TEXT NOT NULL DEFAULT 'PUNO',
        provincia TEXT,
        risk_score INTEGER NOT NULL,
        risk_level TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS departamento TEXT NOT NULL DEFAULT 'PUNO';`);
    await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS provincia TEXT;`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ayudas (
        id BIGSERIAL PRIMARY KEY,
        departamento TEXT NOT NULL,
        provincia TEXT,
        tipo TEXT NOT NULL,
        nota TEXT,
        enviado_por TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`ALTER TABLE ayudas ADD COLUMN IF NOT EXISTS provincia TEXT;`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
  } catch (error) {
    memoryMode = true;
    console.warn("PostgreSQL no disponible. Se activa modo memoria para demo.", error.message);
  }

  await seedDefaultUsers();
}

async function seedDefaultUsers() {
  for (const seed of DEFAULT_USERS) {
    const existing = await getUserByUsername(seed.username);
    if (!existing) {
      await createUser({
        username: seed.username,
        passwordHash: hashPassword(seed.password),
        name: seed.name,
        role: seed.role
      });
    }
  }
}

async function getUserByUsername(username) {
  if (memoryMode) {
    return memoryUsers.find((item) => item.username === username) || null;
  }

  const result = await pool.query(
    `SELECT id, username, password_hash AS "passwordHash", name, role, created_at AS "createdAt"
     FROM users WHERE username = $1`,
    [username]
  );
  return result.rows[0] || null;
}

async function createUser(user) {
  if (memoryMode) {
    const createdUser = {
      id: userCounter++,
      username: user.username,
      passwordHash: user.passwordHash,
      name: user.name,
      role: user.role,
      createdAt: new Date().toISOString()
    };
    memoryUsers.push(createdUser);
    return createdUser;
  }

  const result = await pool.query(
    `INSERT INTO users (username, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, password_hash AS "passwordHash", name, role, created_at AS "createdAt"`,
    [user.username, user.passwordHash, user.name, user.role]
  );
  return result.rows[0];
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
           chat_id AS "chatId", departamento, provincia, risk_score AS "riskScore", risk_level AS "riskLevel",
           created_at AS "createdAt"
    FROM patients
    ORDER BY risk_score DESC, created_at DESC
  `);
  return result.rows;
}

async function createPatient(patient) {
  const departamento = String(patient.departamento || "PUNO").toUpperCase();
  const provincia = departamento === "PUNO" && patient.provincia ? String(patient.provincia).toUpperCase() : null;

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
      departamento,
      provincia,
      riskScore: Number(patient.riskScore),
      riskLevel: patient.riskLevel,
      createdAt: new Date().toISOString()
    };
    memoryPatients.push(createdPatient);
    return createdPatient;
  }

  const result = await pool.query(
    `
      INSERT INTO patients (nombre, edad, hb, km, omitidas, idioma, chat_id, departamento, provincia, risk_score, risk_level)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id, nombre, edad, hb::float8 AS hb, km::float8 AS km, omitidas, idioma,
                chat_id AS "chatId", departamento, provincia, risk_score AS "riskScore", risk_level AS "riskLevel",
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
      departamento,
      provincia,
      patient.riskScore,
      patient.riskLevel
    ]
  );
  return result.rows[0];
}

async function getPatientsByDepartment() {
  const patients = memoryMode ? memoryPatients : (await getPatients());
  const byDept = {};

  for (const patient of patients) {
    const key = patient.departamento || "PUNO";
    if (!byDept[key]) {
      byDept[key] = { departamento: key, total: 0, alto: 0, medio: 0, bajo: 0, hbSum: 0, riskScoreSum: 0 };
    }
    const bucket = byDept[key];
    bucket.total++;
    bucket[patient.riskLevel] = (bucket[patient.riskLevel] || 0) + 1;
    bucket.hbSum += Number(patient.hb);
    bucket.riskScoreSum += Number(patient.riskScore);
  }

  return Object.values(byDept).map((bucket) => {
    const avgRiskScore = bucket.total ? bucket.riskScoreSum / bucket.total : 0;
    const { vulnerabilityIndex, alertLevel } = computeVulnerability({
      total: bucket.total,
      alto: bucket.alto || 0,
      avgRiskScore
    });

    return {
      departamento: bucket.departamento,
      total: bucket.total,
      alto: bucket.alto || 0,
      medio: bucket.medio || 0,
      bajo: bucket.bajo || 0,
      hbPromedio: bucket.total ? Number((bucket.hbSum / bucket.total).toFixed(1)) : null,
      avgRiskScore: Number(avgRiskScore.toFixed(1)),
      vulnerabilityIndex,
      alertLevel
    };
  });
}

async function getProvinciasPuno() {
  const patients = memoryMode ? memoryPatients : (await getPatients());
  const byProv = {};

  for (const patient of patients) {
    if (patient.departamento !== "PUNO" || !patient.provincia) continue;
    const key = patient.provincia;
    if (!byProv[key]) {
      byProv[key] = { provincia: key, total: 0, alto: 0, medio: 0, bajo: 0, hbSum: 0, riskScoreSum: 0 };
    }
    const bucket = byProv[key];
    bucket.total++;
    bucket[patient.riskLevel] = (bucket[patient.riskLevel] || 0) + 1;
    bucket.hbSum += Number(patient.hb);
    bucket.riskScoreSum += Number(patient.riskScore);
  }

  return Object.values(byProv).map((bucket) => {
    const avgRiskScore = bucket.total ? bucket.riskScoreSum / bucket.total : 0;
    const { vulnerabilityIndex, alertLevel } = computeVulnerability({
      total: bucket.total,
      alto: bucket.alto || 0,
      avgRiskScore
    });

    return {
      provincia: bucket.provincia,
      total: bucket.total,
      alto: bucket.alto || 0,
      medio: bucket.medio || 0,
      bajo: bucket.bajo || 0,
      hbPromedio: bucket.total ? Number((bucket.hbSum / bucket.total).toFixed(1)) : null,
      avgRiskScore: Number(avgRiskScore.toFixed(1)),
      vulnerabilityIndex,
      alertLevel
    };
  });
}

async function createAyuda(ayuda) {
  if (memoryMode) {
    const createdAyuda = {
      id: ayudaCounter++,
      departamento: ayuda.departamento,
      provincia: ayuda.provincia || null,
      tipo: ayuda.tipo,
      nota: ayuda.nota || "",
      enviadoPor: ayuda.enviadoPor,
      createdAt: new Date().toISOString()
    };
    memoryAyudas.push(createdAyuda);
    return createdAyuda;
  }

  const result = await pool.query(
    `
      INSERT INTO ayudas (departamento, provincia, tipo, nota, enviado_por)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, departamento, provincia, tipo, nota, enviado_por AS "enviadoPor", created_at AS "createdAt"
    `,
    [ayuda.departamento, ayuda.provincia || null, ayuda.tipo, ayuda.nota || "", ayuda.enviadoPor]
  );

  return result.rows[0];
}

async function getAyudas() {
  if (memoryMode) {
    return [...memoryAyudas].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  const result = await pool.query(`
    SELECT id, departamento, provincia, tipo, nota, enviado_por AS "enviadoPor", created_at AS "createdAt"
    FROM ayudas
    ORDER BY created_at DESC
  `);
  return result.rows;
}

async function getStats() {
  const ayudas = await getAyudas();

  if (memoryMode) {
    const total = memoryPatients.length;
    const alto = memoryPatients.filter((item) => item.riskLevel === "alto").length;
    const hbPromedio = total
      ? Number((memoryPatients.reduce((sum, item) => sum + Number(item.hb), 0) / total).toFixed(1))
      : null;

    return {
      total,
      alto,
      hbPromedio,
      ayudasEnviadas: ayudas.length
    };
  }

  const summaryResult = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE risk_level = 'alto')::int AS alto,
      AVG(hb)::float8 AS hb_promedio
    FROM patients
  `);

  return {
    total: summaryResult.rows[0].total || 0,
    alto: summaryResult.rows[0].alto || 0,
    hbPromedio: summaryResult.rows[0].hb_promedio ? Number(summaryResult.rows[0].hb_promedio.toFixed(1)) : null,
    ayudasEnviadas: ayudas.length
  };
}

module.exports = {
  pool,
  initDb,
  getPatients,
  createPatient,
  getStats,
  getUserByUsername,
  createUser,
  getPatientsByDepartment,
  getProvinciasPuno,
  createAyuda,
  getAyudas
};
