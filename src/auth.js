const crypto = require("crypto");
const { session: sessionConfig } = require("./config");

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  const hashBuffer = Buffer.from(hash, "hex");
  const candidateBuffer = Buffer.from(candidate, "hex");
  if (hashBuffer.length !== candidateBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, candidateBuffer);
}

// Sesiones sin estado (firmadas con HMAC), no un Map en memoria.
// En un entorno serverless (Vercel) cada request puede llegar a una instancia
// distinta del proceso: un Map en memoria pierde la sesion entre requests y
// deja al usuario fuera aunque la contrasena sea correcta. Firmando el propio
// contenido de la sesion evitamos depender de que el servidor "recuerde" nada.
function base64UrlEncode(input) {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(payload) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", sessionConfig.secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function createSession(user) {
  return sign({
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    exp: Date.now() + sessionConfig.ttlMs
  });
}

function getSession(token) {
  if (!token || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = crypto.createHmac("sha256", sessionConfig.secret).update(body).digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(body));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (error) {
    return null;
  }
}

// No hay estado del lado del servidor que borrar: el logout se resuelve
// limpiando la cookie (ver /api/auth/logout en server.js).
function destroySession() {}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

function requireAuth(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[sessionConfig.cookieName];
  const sessionRecord = getSession(token);
  if (!sessionRecord) {
    return res.status(401).json({ ok: false, error: "No autenticado" });
  }
  req.session = sessionRecord;
  req.sessionToken = token;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !roles.includes(req.session.role)) {
      return res.status(403).json({ ok: false, error: "No autorizado para este rol" });
    }
    next();
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  getSession,
  destroySession,
  parseCookies,
  requireAuth,
  requireRole
};
