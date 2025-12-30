import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import net from 'net';
import { isDbConfigured, missingDbEnv, pool as dbPool } from './db.js';
import { commercialPanelConfig, envSummary } from './env.js';

if (process.env.DB_USERNAME && !process.env.DB_USER) {
  process.env.DB_USER = process.env.DB_USERNAME;
}

if (process.env.DB_DATABASE && !process.env.DB_NAME) {
  process.env.DB_NAME = process.env.DB_DATABASE;
}

const SERVER_VERSION = '2025-12-28-plesk-fix';
console.log(`[BOOT] Server v${SERVER_VERSION} booting`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = Number(process.env.PORT || 3333);
const host = '0.0.0.0';
const distDir = path.resolve(__dirname, '..', 'dist');
const NODE_ENV = process.env.NODE_ENV || 'development';
const DB_HOST = process.env.DB_HOST;

/* =========================
   ENV / DB CONFIG
========================= */
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const SALT_ROUNDS = Number(process.env.SALT_ROUNDS || 12);
const REGISTER_INVITE_TOKEN = process.env.REGISTER_INVITE_TOKEN;
const ALLOW_PUBLIC_REGISTER = process.env.ALLOW_PUBLIC_REGISTER === 'true';
const ENABLE_DB_INTROSPECTION = process.env.ENABLE_DB_INTROSPECTION === 'true';
const DEBUG_TOKEN = process.env.DEBUG_TOKEN;
const DEBUG_AUTH = process.env.DEBUG_AUTH === '1';

if (envSummary.missingRequiredEnv.length > 0 || envSummary.missingDbEnv.length > 0) {
  console.error('[FATAL] Variáveis críticas ausentes.', {
    missingRequired: envSummary.missingRequiredEnv,
    missingDb: envSummary.missingDbEnv,
  });
  process.exit(1);
}

if (envSummary.missingOptionalEnv.length > 0) {
  console.info('[INFO] Variáveis opcionais não definidas.', {
    missingOptional: envSummary.missingOptionalEnv,
  });
}

console.log('[BOOT] Environment summary', {
  node_env: NODE_ENV,
  port,
  distDir,
  cwd: process.cwd(),
  db: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE || process.env.DB_NAME,
    user: envSummary.dbUser,
  },
  jwt: {
    configured: Boolean(JWT_SECRET),
    expires_in: JWT_EXPIRES_IN,
  },
});

console.log('[BOOT] Config checks', {
  db_configured: isDbConfigured,
  jwt_configured: Boolean(JWT_SECRET),
});

const isPrivateIpv4 = (ip) => {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }
  if (parts[0] === 10 || parts[0] === 127) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return false;
};

const isPrivateIpv6 = (ip) => {
  const normalized = ip.toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80')
  );
};

const isPrivateIp = (ip) => {
  const ipVersion = net.isIP(ip);
  if (ipVersion === 4) return isPrivateIpv4(ip);
  if (ipVersion === 6) return isPrivateIpv6(ip);
  return false;
};

if (NODE_ENV === 'production' && DB_HOST && net.isIP(DB_HOST) && !isPrivateIp(DB_HOST)) {
  console.warn(
    '[WARN] DB_HOST aponta para um IP público em production. ' +
      'Se o MySQL estiver no mesmo host, prefira 127.0.0.1 ou localhost.'
  );
}

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.originalUrl}`);
  next();
});
if (process.env.DEBUG_ROUTES === '1') {
  app.use((req, _res, next) => {
    console.log(
      `[DEBUG_ROUTES] ${req.method} ${req.originalUrl} host=${req.headers.host}`
    );
    next();
  });
}

/* =========================
   HELPERS (resposta padrão)
========================= */
const ok = (res, data, status = 200) => res.status(status).json({ data });
const fail = (res, status, error, details = undefined) =>
  res.status(status).json({ error, details, data: null });

const normalizeCnpj = (value = '') => String(value).replace(/\D/g, '');

const safeQuery = async (sql, params = []) => {
  if (!dbPool) {
    throw new Error('Banco de dados não configurado (variáveis de ambiente ausentes).');
  }
  const [rows] = await dbPool.execute(sql, params);
  return rows;
};

const assertUsersSchema = async () => {
  const REQUIRED = ['id', 'name', 'email', 'cnpj_access', 'password', 'role', 'created_at'];
  const STRICT_SCHEMA = process.env.STRICT_SCHEMA === '1';
  if (!dbPool) {
    throw new Error('Banco de dados não configurado (variáveis de ambiente ausentes).');
  }
  console.log('[DB_SCHEMA_CHECK] Validando schema da tabela users...');
  const [cols] = await dbPool.query('SHOW COLUMNS FROM users');
  const names = new Set(cols.map((col) => col.Field));
  const missing = REQUIRED.filter((column) => !names.has(column));
  const extra = [...names].filter((column) => !REQUIRED.includes(column));
  if (missing.length || (STRICT_SCHEMA && extra.length)) {
    console.error('[DB_SCHEMA_ERROR] users schema mismatch:', { missing, extra });
    throw new Error('Users schema mismatch');
  }
  console.log('[DB_SCHEMA_OK] users schema valid');
};

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
};

const parseJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const serializeJsonArray = (value) => {
  if (value === undefined) return null;
  return JSON.stringify(value ?? []);
};

const isBcryptHash = (v = '') =>
  v.startsWith('$2a$') || v.startsWith('$2b$') || v.startsWith('$2y$');

const isBcryptHashValid = (v = '') => isBcryptHash(v) && v.length === 60;

const isInactiveUser = (_user) => false;

const signToken = (user) => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET não definido no ambiente.');
  }
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      cnpj_access: normalizeCnpj(user.cnpj_access || ''),
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (!token || scheme?.toLowerCase() !== 'bearer') {
    return fail(res, 401, 'Token ausente.');
  }

  if (!JWT_SECRET) {
    return fail(res, 500, 'JWT_SECRET não definido no ambiente.');
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const rows = await safeQuery('SELECT * FROM users WHERE id = ? LIMIT 1', [payload.sub]);
    const user = rows[0];

    if (!user) {
      return fail(res, 401, 'Usuário não encontrado.');
    }

    if (isInactiveUser(user)) {
      return fail(res, 403, 'Usuário inativo.');
    }

    req.user = {
      ...payload,
      role: user.role,
      email: user.email,
      cnpj_access: normalizeCnpj(user.cnpj_access || ''),
    };
    return next();
  } catch (error) {
    return fail(res, 403, 'Token inválido ou expirado.');
  }
};

const requireRole = (...roles) => (req, res, next) => {
  const currentRole = req.user?.role;

  if (!currentRole || !roles.includes(currentRole)) {
    return fail(res, 403, 'Acesso negado.');
  }

  return next();
};

const requireCommercialPanelAuth = (req, res, next) => {
  const { username, password } = commercialPanelConfig;
  if (!username || !password) {
    return fail(res, 503, 'Painel comercial não configurado.');
  }

  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (!encoded || scheme?.toLowerCase() !== 'basic') {
    res.set('WWW-Authenticate', 'Basic realm="Painel Comercial"');
    return fail(res, 401, 'Credenciais ausentes.');
  }

  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const [providedUser, providedPassword] = decoded.split(':');
  if (providedUser !== username || providedPassword !== password) {
    res.set('WWW-Authenticate', 'Basic realm="Painel Comercial"');
    return fail(res, 401, 'Credenciais inválidas.');
  }

  return next();
};

const requireDebugToken = (req, res, next) => {
  if (!DEBUG_TOKEN) {
    return fail(res, 503, 'DEBUG_TOKEN não configurado.');
  }
  const provided = req.headers['x-debug-token'];
  if (!provided || provided !== DEBUG_TOKEN) {
    return fail(res, 403, 'Token de depuração inválido.');
  }
  return next();
};

/* =========================
   AUTH RATE LIMITING
========================= */
const AUTH_RATE_LIMIT_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = Number(process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS || 5);
const AUTH_RATE_LIMIT_LOCKOUT_BASE_MS = Number(
  process.env.AUTH_RATE_LIMIT_LOCKOUT_BASE_MS || 5 * 60 * 1000
);
const AUTH_RATE_LIMIT_LOCKOUT_MAX_MS = Number(
  process.env.AUTH_RATE_LIMIT_LOCKOUT_MAX_MS || 60 * 60 * 1000
);
const AUTH_RATE_LIMIT_TEST_MODE = process.env.AUTH_RATE_LIMIT_TEST_MODE === 'true';

const authRateLimitStore = {
  ip: new Map(),
  user: new Map(),
};

const authRateLimitMetrics = {
  attempts: 0,
  successes: 0,
  failures: 0,
  blocked: 0,
  lockouts: 0,
};

const logAuthRateLimitMetrics = (event, meta = {}) => {
  console.info('[AUTH_RATE_LIMIT_METRICS]', {
    event,
    metrics: { ...authRateLimitMetrics },
    ...meta,
  });
};

const AUTH_PAYLOAD_FIELDS = new Set([
  'email',
  'login',
  'usuario',
  'password',
  'senha',
  'pass',
  'name',
  'cnpj_access',
  'invite_token',
]);

const isAuthPayloadObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 0) return false;
  return keys.some((key) => AUTH_PAYLOAD_FIELDS.has(key));
};

const normalizeAuthPayload = (payload = {}) => {
  const source = payload ?? {};
  const emailRaw = source?.email ?? source?.login ?? source?.usuario ?? '';
  const passwordRaw = source?.password ?? source?.senha ?? source?.pass ?? '';
  const email = String(emailRaw).trim().toLowerCase();
  const password = String(passwordRaw);
  const deprecatedKeys = [];

  if (source?.login !== undefined) deprecatedKeys.push('login');
  if (source?.usuario !== undefined) deprecatedKeys.push('usuario');
  if (source?.senha !== undefined) deprecatedKeys.push('senha');
  if (source?.pass !== undefined) deprecatedKeys.push('pass');

  return {
    email,
    password,
    deprecatedKeys,
  };
};

const getAuthPayload = (req) => {
  // Prioriza req.body.auth quando for objeto válido com campos esperados ou JSON parseável;
  // se vier string inválida ou objeto vazio/inesperado, faz fallback para req.body.
  const rawAuth = req.body?.auth;

  if (rawAuth !== undefined) {
    if (typeof rawAuth === 'string') {
      try {
        const parsed = JSON.parse(rawAuth);
        if (isAuthPayloadObject(parsed)) {
          return parsed;
        }
      } catch {
        // fallback handled below
      }
      return req.body ?? {};
    }

    if (isAuthPayloadObject(rawAuth)) {
      return rawAuth;
    }
  }

  const raw = req.body?.auth ?? req.body ?? {};
  if (typeof raw === 'string' || Buffer.isBuffer(raw)) {
    const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : raw;
    try {
      return JSON.parse(text);
    } catch (error) {
      if (DEBUG_AUTH) {
        console.error('[AUTH_PAYLOAD_PARSE_ERROR]', {
          message: error?.message,
          content_type: req.headers['content-type'] || null,
        });
      }
      return {};
    }
  }

  if (isAuthPayloadObject(raw)) {
    return raw;
  }

  return req.body ?? {};
};

const isBodyEmpty = (body) => {
  if (body === undefined || body === null) return true;
  if (Buffer.isBuffer(body)) return body.length === 0;
  if (typeof body === 'string') return body.trim().length === 0;
  if (typeof body === 'object') return Object.keys(body).length === 0;
  return false;
};

const getRateLimitKey = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() ||
    req.ip ||
    req.connection?.remoteAddress ||
    'unknown';

  const payload = getAuthPayload(req);

  const { email } = normalizeAuthPayload(payload);

  return {
    ipKey: `ip:${ip}`,
    userKey: email ? `user:${email}` : null,
  };
};

const resetRateLimitIfWindowExpired = (entry) => {
  if (!entry) return;
  const now = Date.now();
  if (!entry.firstAttemptAt || now - entry.firstAttemptAt > AUTH_RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.firstAttemptAt = now;
  }
};

const isLockedOut = (entry) => entry?.lockoutUntil && Date.now() < entry.lockoutUntil;

const registerAuthFailure = (store, key, reason) => {
  if (!key) return;
  const now = Date.now();
  const entry = store.get(key) || {
    count: 0,
    firstAttemptAt: now,
    lockoutUntil: null,
    lockoutLevel: 0,
    lastFailureAt: null,
  };

  resetRateLimitIfWindowExpired(entry);
  entry.count += 1;
  entry.lastFailureAt = now;

  if (entry.count >= AUTH_RATE_LIMIT_MAX_ATTEMPTS) {
    entry.lockoutLevel += 1;
    const backoffMs = Math.min(
      AUTH_RATE_LIMIT_LOCKOUT_BASE_MS * 2 ** (entry.lockoutLevel - 1),
      AUTH_RATE_LIMIT_LOCKOUT_MAX_MS
    );
    entry.lockoutUntil = now + backoffMs;
    entry.count = 0;
    entry.firstAttemptAt = now;
    authRateLimitMetrics.lockouts += 1;
    console.warn('[AUTH_RATE_LIMIT] Lockout aplicado.', {
      key,
      lockoutUntil: new Date(entry.lockoutUntil).toISOString(),
      lockoutLevel: entry.lockoutLevel,
      reason,
    });
    logAuthRateLimitMetrics('lockout', { key, reason });
  }

  store.set(key, entry);
};

const registerAuthSuccess = (store, key) => {
  if (!key) return;
  store.delete(key);
};

const authRateLimitMiddleware = (req, res, next) => {
  if (AUTH_RATE_LIMIT_TEST_MODE) {
    authRateLimitMetrics.attempts = 0;
    authRateLimitMetrics.failures = 0;
    authRateLimitStore.ip.clear();
    authRateLimitStore.user.clear();
    return next();
  }
  const { ipKey, userKey } = getRateLimitKey(req);
  const ipEntry = authRateLimitStore.ip.get(ipKey);
  const userEntry = userKey ? authRateLimitStore.user.get(userKey) : null;

  const lockedEntry = isLockedOut(ipEntry) ? ipEntry : isLockedOut(userEntry) ? userEntry : null;
  if (lockedEntry) {
    authRateLimitMetrics.blocked += 1;
    const retryAfterSeconds = Math.ceil((lockedEntry.lockoutUntil - Date.now()) / 1000);
    console.warn('[AUTH_RATE_LIMIT] Tentativa bloqueada.', {
      ipKey,
      userKey,
      retryAfterSeconds,
    });
    logAuthRateLimitMetrics('blocked', { ipKey, userKey });
    res.setHeader('Retry-After', retryAfterSeconds);
    return fail(res, 429, 'Muitas tentativas. Tente novamente mais tarde.', {
      retry_after_seconds: retryAfterSeconds,
    });
  }

  return next();
};

/* =========================
   RELATIONS (proposals)
========================= */
const readRelationMap = async (table, column, proposalIds = []) => {
  if (proposalIds.length === 0) return new Map();
  try {
    const [rows] = await dbPool.query(
      `SELECT proposal_id, ${column} AS related_id FROM ${table} WHERE proposal_id IN (?)`,
      [proposalIds]
    );
    const map = new Map();
    rows.forEach((row) => {
      if (!map.has(row.proposal_id)) map.set(row.proposal_id, []);
      map.get(row.proposal_id).push(row.related_id);
    });
    return map;
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') return new Map();
    throw error;
  }
};

const attachProposalRelations = async (proposals) => {
  const ids = proposals.map((p) => p.id);
  const servicesMap = await readRelationMap('proposal_services', 'service_id', ids);
  const termsMap = await readRelationMap('proposal_terms', 'term_id', ids);
  const optionalsMap = await readRelationMap('proposal_optionals', 'optional_id', ids);

  return proposals.map((p) => ({
    ...p,
    services_ids: servicesMap.get(p.id) || [],
    terms_ids: termsMap.get(p.id) || [],
    optionals_ids: optionalsMap.get(p.id) || [],
  }));
};

const writeProposalRelations = async (proposalId, table, column, ids = []) => {
  try {
    await safeQuery(`DELETE FROM ${table} WHERE proposal_id = ?`, [proposalId]);
    if (!ids || ids.length === 0) return;

    const values = ids.map((id) => [proposalId, id]);
    // mysql2 suporta "VALUES ?" com query (não execute)
    await dbPool.query(`INSERT INTO ${table} (proposal_id, ${column}) VALUES ?`, [values]);
  } catch (error) {
    if (error?.code !== 'ER_NO_SUCH_TABLE') throw error;
  }
};

/* =========================
   AUTH ROUTES
========================= */
const recordAuthFailure = (req, reason) => {
  authRateLimitMetrics.failures += 1;
  const { ipKey, userKey } = getRateLimitKey(req);
  registerAuthFailure(authRateLimitStore.ip, ipKey, reason);
  registerAuthFailure(authRateLimitStore.user, userKey, reason);
  logAuthRateLimitMetrics('failure', { ipKey, userKey, reason });
  return { ipKey, userKey };
};

const loginHandler = async (req, res) => {
  try {
    authRateLimitMetrics.attempts += 1;

    const body = getAuthPayload(req);

    const { email, password, deprecatedKeys } = normalizeAuthPayload(body);

    if (deprecatedKeys.length > 0) {
      console.warn('[AUTH_DEPRECATED_PAYLOAD_KEYS]', {
        keys: deprecatedKeys,
        ip: req.ip,
      });
    }

    console.log('[LOGIN_ATTEMPT]', {
      email,
      hasPassword: Boolean(password),
    });

    if (!email || !password) {
      recordAuthFailure(req, 'missing_credentials');
      console.warn('[LOGIN_FAIL] Credenciais incompletas.', {
        ip: req.ip,
        hasEmail: Boolean(email),
        hasPassword: Boolean(password),
      });
      return fail(res, 400, 'Credenciais incompletas.', {
        content_type: req.headers['content-type'] || null,
        body_empty: isBodyEmpty(req.body),
      });
    }
    const { ipKey, userKey } = getRateLimitKey(req);

    if (!dbPool) {
      throw new Error('Banco de dados não configurado (variáveis de ambiente ausentes).');
    }

    // busca usuário por email
    const [rows] = await dbPool.query(
      `SELECT id, name, email, cnpj_access, password, role, created_at
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    const user = rows[0];
    if (!user) {
      recordAuthFailure(req, 'invalid_credentials');
      console.warn('[LOGIN_FAIL] Usuário não encontrado.', { ip: req.ip, email });
      return fail(res, 401, 'Credenciais inválidas.');
    }

    if (isInactiveUser(user)) {
      recordAuthFailure(req, 'user_inactive');
      console.warn('[LOGIN_FAIL] Usuário inativo.', { ip: req.ip, userId: user.id });
      return fail(res, 403, 'Usuário inativo.');
    }

    const storedHash = String(user.password || '').trim();
    if (!isBcryptHashValid(storedHash)) {
      recordAuthFailure(req, 'invalid_credentials');
      console.warn('[LOGIN_FAIL] Hash inválido no cadastro.', { ip: req.ip, userId: user.id });
      return fail(res, 401, 'Credenciais inválidas.');
    }
    const passwordOk = await bcrypt.compare(password, storedHash);
    if (!passwordOk) {
      recordAuthFailure(req, 'invalid_credentials');
      console.warn('[LOGIN_FAIL] Senha inválida.', { ip: req.ip, userId: user.id });
      return fail(res, 401, 'Credenciais inválidas.');
    }

    const token = signToken(user);
    authRateLimitMetrics.successes += 1;
    registerAuthSuccess(authRateLimitStore.ip, ipKey);
    registerAuthSuccess(authRateLimitStore.user, userKey);
    console.info('[AUTH_RATE_LIMIT] Login bem-sucedido.', {
      ipKey,
      userKey,
      metrics: { ...authRateLimitMetrics },
    });
    logAuthRateLimitMetrics('success', { ipKey, userKey });

    // ✅ PADRÃO para o front: sempre data
    return ok(res, { token, user: sanitizeUser(user) });
  } catch (error) {
    recordAuthFailure(req, 'server_error');
    console.error('AUTH_LOGIN_ERROR:', error);
    return fail(res, 500, 'Erro interno ao autenticar.');
  }
};

const registerHandler = async (req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && !ALLOW_PUBLIC_REGISTER && !REGISTER_INVITE_TOKEN) {
      return fail(res, 403, 'Cadastro desativado.');
    }

    const payload = req.body?.auth || req.body || {};
    if (REGISTER_INVITE_TOKEN && !ALLOW_PUBLIC_REGISTER) {
      const inviteToken = payload?.invite_token || req.headers['x-invite-token'];
      if (!inviteToken || inviteToken !== REGISTER_INVITE_TOKEN) {
        return fail(res, 403, 'Cadastro não autorizado.');
      }
    }

    const name = payload?.name?.trim();
    const email = payload?.email?.trim()?.toLowerCase();
    const cnpjAccess = payload?.cnpj_access;
    const password = payload?.password;

    if (!name || !email || !cnpjAccess || !password) {
      return fail(res, 400, 'Dados obrigatórios ausentes.');
    }

    const cnpjNormalized = normalizeCnpj(cnpjAccess);

    const existing = await safeQuery(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (existing.length > 0) {
      return fail(res, 409, 'E-mail já cadastrado.');
    }

    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await safeQuery(
      `INSERT INTO users (id, name, email, cnpj_access, password, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [id, name, email, cnpjNormalized, passwordHash, 'employee']
    );

    const user = {
      id,
      name,
      email,
      cnpj_access: cnpjNormalized,
      role: 'employee',
    };
    const token = signToken(user);

    return ok(res, { user, token }, 201);
  } catch (error) {
    console.error('🔥 ERRO NO REGISTER:', error);
    return fail(res, 500, 'Erro interno ao registrar.');
  }
};

/* =========================
   HEALTH
========================= */
const healthHandler = (_req, res) => res.status(200).json({ ok: true });

const healthVersionHandler = (_req, res) =>
  res.status(200).json({
    ok: true,
    version: SERVER_VERSION,
    distDir,
    cwd: process.cwd(),
  });

const healthDbHandler = async (_req, res) => {
  if (!dbPool) {
    return fail(res, 503, 'Banco de dados não configurado.');
  }
  try {
    const [rows] = await dbPool.query(
      'SELECT DATABASE() AS db, @@hostname AS host, @@port AS port'
    );
    const dbInfo = rows?.[0] || {};
    console.log('[DB_FINGERPRINT]', dbInfo);
    return res.status(200).json({
      ok: true,
      db: dbInfo.db || process.env.DB_DATABASE || process.env.DB_NAME,
      host: dbInfo.host || process.env.DB_HOST,
      port: dbInfo.port || process.env.DB_PORT,
    });
  } catch (error) {
    console.error('HEALTH_DB_ERROR:', error);
    return fail(res, 500, 'Falha no health check do banco.', error?.message);
  }
};

/* =========================
   PUBLIC ROUTES (ANTES DO /api guard)
========================= */

// Health (público)
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
app.get('/health/db', healthDbHandler);
app.get('/api/health/db', healthDbHandler);
app.get('/health/version', healthVersionHandler);
app.get('/api/health/version', healthVersionHandler);
app.get('/version', healthVersionHandler);
app.get('/api/version', healthVersionHandler);

// Auth (público)
app.post('/api/auth/login', authRateLimitMiddleware, loginHandler);
app.post('/auth/login', authRateLimitMiddleware, loginHandler);

// Register (público)
app.post('/api/auth/register', registerHandler);
app.post('/auth/register', registerHandler);

const publicRoutes = [
  'GET /health',
  'GET /api/health',
  'GET /health/db',
  'GET /api/health/db',
  'GET /health/version',
  'GET /api/health/version',
  'GET /version',
  'GET /api/version',
  'POST /api/auth/login',
  'POST /auth/login',
  'POST /api/auth/register',
  'POST /auth/register',
];
console.log('[BOOT] Rotas públicas registradas:', publicRoutes);

/* =========================
   STATIC + SPA FALLBACK
========================= */
app.use('/comercial-propostas', requireCommercialPanelAuth);
app.use(express.static(distDir, { index: false }));
app.get('*', (req, res, next) => {
  if (
    req.path.startsWith('/api') ||
    req.path.startsWith('/auth') ||
    req.path.startsWith('/health') ||
    req.path.startsWith('/debug') ||
    req.path.startsWith('/comercial-propostas')
  ) {
    return next();
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Método não permitido.', data: null });
  }
  return res.sendFile(path.join(distDir, 'index.html'));
});

/* =========================
   PROTECTED API
========================= */
app.use('/api', requireAuth);

/* =========================
   DEBUG (token)
========================= */
app.use('/debug', requireDebugToken);

app.get('/debug/db', async (_req, res) => {
  if (!dbPool) {
    return fail(res, 503, 'Banco de dados não configurado.');
  }
  try {
    const [rows] = await dbPool.query(
      'SELECT DATABASE() AS db, @@hostname AS host, @@port AS port'
    );
    const dbInfo = rows?.[0] || {};
    return ok(res, {
      ok: true,
      db: dbInfo.db || process.env.DB_DATABASE || process.env.DB_NAME,
      host: dbInfo.host || process.env.DB_HOST,
      port: dbInfo.port || process.env.DB_PORT,
    });
  } catch (error) {
    console.error('DEBUG_DB_ERROR:', error);
    return fail(res, 500, 'Falha ao consultar banco.', error?.message);
  }
});

app.get('/debug/user', async (req, res) => {
  try {
    const email = req.query?.email?.toString().trim().toLowerCase();
    if (!email) {
      return fail(res, 400, 'Informe o e-mail.');
    }

    const rows = await safeQuery('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    const user = rows[0];
    if (!user) {
      return fail(res, 404, 'Usuário não encontrado.');
    }

    const passwordValue = user.password ? String(user.password) : null;
    const passwordPreview = passwordValue
      ? `${passwordValue.slice(0, 6)}...${passwordValue.slice(-4)}`
      : null;

    return ok(res, {
      ...sanitizeUser(user),
      password_preview: passwordPreview,
    });
  } catch (error) {
    console.error('DEBUG_USER_ERROR:', error);
    return fail(res, 500, 'Erro ao consultar usuário.');
  }
});

app.get('/api/tables', requireRole('admin'), async (_req, res) => {
  if (!ENABLE_DB_INTROSPECTION) {
    return fail(res, 404, 'Endpoint desabilitado.');
  }
  try {
    const rows = await safeQuery('SHOW TABLES');
    ok(res, rows);
  } catch (error) {
    console.error('TABLES_ERROR:', error);
    fail(res, 500, 'Erro ao listar tabelas.', error?.message);
  }
});

/* =========================
   COMPANIES
========================= */
app.get('/api/companies', requireRole('admin'), async (_req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM companies ORDER BY name ASC');
    return ok(res, rows);
  } catch (error) {
    console.error('COMPANIES_LIST_ERROR:', error);
    return fail(res, 500, 'Erro ao listar empresas.');
  }
});

app.get('/api/companies/:id', requireRole('admin'), async (req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM companies WHERE id = ? LIMIT 1', [req.params.id]);
    const company = rows[0];
    if (!company) return fail(res, 404, 'Empresa não encontrada.');
    return ok(res, company);
  } catch (error) {
    console.error('COMPANIES_GET_ERROR:', error);
    return fail(res, 500, 'Erro ao buscar empresa.');
  }
});

app.post('/api/companies', requireRole('admin'), async (req, res) => {
  try {
    const p = req.body || {};
    const company = {
      id: p.id || crypto.randomUUID(),
      name: p.name,
      cnpj: p.cnpj,
      address: p.address || null,
      email: p.email || null,
      phone: p.phone || null,
      bank_info: p.bank_info || null,
    };

    await safeQuery(
      `INSERT INTO companies (id, name, cnpj, address, email, phone, bank_info)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [company.id, company.name, company.cnpj, company.address, company.email, company.phone, company.bank_info]
    );

    return ok(res, company, 201);
  } catch (error) {
    console.error('COMPANIES_CREATE_ERROR:', error);
    return fail(res, 500, 'Erro ao criar empresa.');
  }
});

app.put('/api/companies/:id', requireRole('admin'), async (req, res) => {
  try {
    const p = req.body || {};
    await safeQuery(
      `UPDATE companies
       SET name = ?, cnpj = ?, address = ?, email = ?, phone = ?, bank_info = ?
       WHERE id = ?`,
      [p.name, p.cnpj, p.address || null, p.email || null, p.phone || null, p.bank_info || null, req.params.id]
    );

    return ok(res, { id: req.params.id });
  } catch (error) {
    console.error('COMPANIES_UPDATE_ERROR:', error);
    return fail(res, 500, 'Erro ao atualizar empresa.');
  }
});

app.delete('/api/companies/:id', requireRole('admin'), async (req, res) => {
  try {
    await safeQuery('DELETE FROM companies WHERE id = ?', [req.params.id]);
    return res.status(204).send();
  } catch (error) {
    console.error('COMPANIES_DELETE_ERROR:', error);
    return fail(res, 500, 'Erro ao remover empresa.');
  }
});

/* =========================
   SERVICES
========================= */
app.get('/api/services', requireRole('admin'), async (_req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM services ORDER BY description ASC');
    const data = rows.map((row) => ({ ...row, benefits: parseJsonArray(row.benefits) }));
    return ok(res, data);
  } catch (error) {
    console.error('SERVICES_LIST_ERROR:', error);
    return fail(res, 500, 'Erro ao listar serviços.');
  }
});

app.get('/api/services/:id', requireRole('admin'), async (req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM services WHERE id = ? LIMIT 1', [req.params.id]);
    const service = rows[0];
    if (!service) return fail(res, 404, 'Serviço não encontrado.');
    return ok(res, { ...service, benefits: parseJsonArray(service.benefits) });
  } catch (error) {
    console.error('SERVICES_GET_ERROR:', error);
    return fail(res, 500, 'Erro ao buscar serviço.');
  }
});

app.post('/api/services', requireRole('admin'), async (req, res) => {
  try {
    const p = req.body || {};
    const service = {
      id: p.id || crypto.randomUUID(),
      description: p.description,
      detailed_description: p.detailed_description || null,
      benefits: p.benefits || [],
      value: p.value || 0,
      unit: p.unit || 'fixo',
    };

    await safeQuery(
      `INSERT INTO services (id, description, detailed_description, benefits, value, unit)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [service.id, service.description, service.detailed_description, serializeJsonArray(service.benefits), service.value, service.unit]
    );

    return ok(res, service, 201);
  } catch (error) {
    console.error('SERVICES_CREATE_ERROR:', error);
    return fail(res, 500, 'Erro ao criar serviço.');
  }
});

app.put('/api/services/:id', requireRole('admin'), async (req, res) => {
  try {
    const p = req.body || {};
    await safeQuery(
      `UPDATE services
       SET description = ?, detailed_description = ?, benefits = ?, value = ?, unit = ?
       WHERE id = ?`,
      [p.description, p.detailed_description || null, serializeJsonArray(p.benefits || []), p.value || 0, p.unit || 'fixo', req.params.id]
    );

    return ok(res, { id: req.params.id });
  } catch (error) {
    console.error('SERVICES_UPDATE_ERROR:', error);
    return fail(res, 500, 'Erro ao atualizar serviço.');
  }
});

app.delete('/api/services/:id', requireRole('admin'), async (req, res) => {
  try {
    await safeQuery('DELETE FROM services WHERE id = ?', [req.params.id]);
    return res.status(204).send();
  } catch (error) {
    console.error('SERVICES_DELETE_ERROR:', error);
    return fail(res, 500, 'Erro ao remover serviço.');
  }
});

/* =========================
   OPTIONALS
========================= */
app.get('/api/optionals', requireRole('admin'), async (_req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM optionals ORDER BY description ASC');
    return ok(res, rows);
  } catch (error) {
    console.error('OPTIONALS_LIST_ERROR:', error);
    return fail(res, 500, 'Erro ao listar opcionais.');
  }
});

app.get('/api/optionals/:id', requireRole('admin'), async (req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM optionals WHERE id = ? LIMIT 1', [req.params.id]);
    const optional = rows[0];
    if (!optional) return fail(res, 404, 'Opcional não encontrado.');
    return ok(res, optional);
  } catch (error) {
    console.error('OPTIONALS_GET_ERROR:', error);
    return fail(res, 500, 'Erro ao buscar opcional.');
  }
});

app.post('/api/optionals', requireRole('admin'), async (req, res) => {
  try {
    const p = req.body || {};
    const optional = { id: p.id || crypto.randomUUID(), description: p.description, value: p.value || 0 };

    await safeQuery(`INSERT INTO optionals (id, description, value) VALUES (?, ?, ?)`, [
      optional.id,
      optional.description,
      optional.value,
    ]);

    return ok(res, optional, 201);
  } catch (error) {
    console.error('OPTIONALS_CREATE_ERROR:', error);
    return fail(res, 500, 'Erro ao criar opcional.');
  }
});

app.put('/api/optionals/:id', requireRole('admin'), async (req, res) => {
  try {
    const p = req.body || {};
    await safeQuery(`UPDATE optionals SET description = ?, value = ? WHERE id = ?`, [p.description, p.value || 0, req.params.id]);
    return ok(res, { id: req.params.id });
  } catch (error) {
    console.error('OPTIONALS_UPDATE_ERROR:', error);
    return fail(res, 500, 'Erro ao atualizar opcional.');
  }
});

app.delete('/api/optionals/:id', requireRole('admin'), async (req, res) => {
  try {
    await safeQuery('DELETE FROM optionals WHERE id = ?', [req.params.id]);
    return res.status(204).send();
  } catch (error) {
    console.error('OPTIONALS_DELETE_ERROR:', error);
    return fail(res, 500, 'Erro ao remover opcional.');
  }
});

/* =========================
   TERMS
========================= */
app.get('/api/terms', requireRole('admin'), async (_req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM terms ORDER BY title ASC');
    return ok(res, rows);
  } catch (error) {
    console.error('TERMS_LIST_ERROR:', error);
    return fail(res, 500, 'Erro ao listar termos.');
  }
});

app.get('/api/terms/:id', requireRole('admin'), async (req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM terms WHERE id = ? LIMIT 1', [req.params.id]);
    const term = rows[0];
    if (!term) return fail(res, 404, 'Termo não encontrado.');
    return ok(res, term);
  } catch (error) {
    console.error('TERMS_GET_ERROR:', error);
    return fail(res, 500, 'Erro ao buscar termo.');
  }
});

app.post('/api/terms', requireRole('admin'), async (req, res) => {
  try {
    const p = req.body || {};
    const term = { id: p.id || crypto.randomUUID(), title: p.title, content: p.content };

    await safeQuery(`INSERT INTO terms (id, title, content) VALUES (?, ?, ?)`, [term.id, term.title, term.content]);
    return ok(res, term, 201);
  } catch (error) {
    console.error('TERMS_CREATE_ERROR:', error);
    return fail(res, 500, 'Erro ao criar termo.');
  }
});

app.put('/api/terms/:id', requireRole('admin'), async (req, res) => {
  try {
    const p = req.body || {};
    await safeQuery(`UPDATE terms SET title = ?, content = ? WHERE id = ?`, [p.title, p.content, req.params.id]);
    return ok(res, { id: req.params.id });
  } catch (error) {
    console.error('TERMS_UPDATE_ERROR:', error);
    return fail(res, 500, 'Erro ao atualizar termo.');
  }
});

app.delete('/api/terms/:id', requireRole('admin'), async (req, res) => {
  try {
    await safeQuery('DELETE FROM terms WHERE id = ?', [req.params.id]);
    return res.status(204).send();
  } catch (error) {
    console.error('TERMS_DELETE_ERROR:', error);
    return fail(res, 500, 'Erro ao remover termo.');
  }
});

/* =========================
   USERS (admin crud)
   Obs: mantém como estava, mas cuidado ao criar/atualizar senha
========================= */
app.get('/api/users', requireRole('admin'), async (_req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM users ORDER BY name ASC');
    return ok(res, rows.map(sanitizeUser));
  } catch (error) {
    console.error('USERS_LIST_ERROR:', error);
    return fail(res, 500, 'Erro ao listar usuários.');
  }
});

app.get('/api/users/:id', requireRole('admin'), async (req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM users WHERE id = ? LIMIT 1', [req.params.id]);
    const user = rows[0];
    if (!user) return fail(res, 404, 'Usuário não encontrado.');
    return ok(res, sanitizeUser(user));
  } catch (error) {
    console.error('USERS_GET_ERROR:', error);
    return fail(res, 500, 'Erro ao buscar usuário.');
  }
});

app.post('/api/users', requireRole('admin'), async (req, res) => {
  try {
    const p = req.body || {};
    const id = p.id || crypto.randomUUID();

    // se vier password, já salva como bcrypt
    const passwordHash = p.password ? await bcrypt.hash(p.password, SALT_ROUNDS) : null;

    const user = {
      id,
      name: p.name,
      email: p.email,
      cnpj_access: normalizeCnpj(p.cnpj_access || ''),
      password: passwordHash,
      role: p.role || 'employee',
    };

    await safeQuery(
      'INSERT INTO users (id, name, email, cnpj_access, password, role) VALUES (?, ?, ?, ?, ?, ?)',
      [user.id, user.name, user.email, user.cnpj_access, user.password, user.role]
    );

    return ok(res, sanitizeUser(user), 201);
  } catch (error) {
    console.error('USERS_CREATE_ERROR:', error);
    return fail(res, 500, 'Erro ao criar usuário.');
  }
});

app.put('/api/users/:id', requireRole('admin'), async (req, res) => {
  try {
    const p = req.body || {};
    const passwordHash = p.password ? await bcrypt.hash(p.password, SALT_ROUNDS) : null;

    await safeQuery(
      `UPDATE users
       SET name = ?, email = ?, cnpj_access = ?, password = COALESCE(?, password), role = ?
       WHERE id = ?`,
      [p.name, p.email, normalizeCnpj(p.cnpj_access || ''), passwordHash, p.role || 'employee', req.params.id]
    );

    return ok(res, { id: req.params.id });
  } catch (error) {
    console.error('USERS_UPDATE_ERROR:', error);
    return fail(res, 500, 'Erro ao atualizar usuário.');
  }
});

app.delete('/api/users/:id', requireRole('admin'), async (req, res) => {
  try {
    await safeQuery('DELETE FROM users WHERE id = ?', [req.params.id]);
    return res.status(204).send();
  } catch (error) {
    console.error('USERS_DELETE_ERROR:', error);
    return fail(res, 500, 'Erro ao remover usuário.');
  }
});

/* =========================
   CLIENTS
========================= */
app.get('/api/clients', async (_req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM clients ORDER BY name ASC');
    return ok(res, rows);
  } catch (error) {
    console.error('CLIENTS_LIST_ERROR:', error);
    return fail(res, 500, 'Erro ao listar clientes.');
  }
});

app.get('/api/clients/:id', async (req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM clients WHERE id = ? LIMIT 1', [req.params.id]);
    const client = rows[0];
    if (!client) return fail(res, 404, 'Cliente não encontrado.');
    return ok(res, client);
  } catch (error) {
    console.error('CLIENTS_GET_ERROR:', error);
    return fail(res, 500, 'Erro ao buscar cliente.');
  }
});

app.post('/api/clients', async (req, res) => {
  try {
    const p = req.body || {};
    const client = {
      id: p.id || crypto.randomUUID(),
      name: p.name,
      document: p.document,
      address: p.address || null,
      person_name: p.person_name || null,
      job_title: p.job_title || null,
      email: p.email || null,
      phone: p.phone || null,
    };

    await safeQuery(
      `INSERT INTO clients (id, name, document, address, person_name, job_title, email, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [client.id, client.name, client.document, client.address, client.person_name, client.job_title, client.email, client.phone]
    );

    return ok(res, client, 201);
  } catch (error) {
    console.error('CLIENTS_CREATE_ERROR:', error);
    return fail(res, 500, 'Erro ao criar cliente.');
  }
});

app.put('/api/clients/:id', async (req, res) => {
  try {
    const p = req.body || {};
    await safeQuery(
      `UPDATE clients
       SET name = ?, document = ?, address = ?, person_name = ?, job_title = ?, email = ?, phone = ?
       WHERE id = ?`,
      [p.name, p.document, p.address || null, p.person_name || null, p.job_title || null, p.email || null, p.phone || null, req.params.id]
    );

    return ok(res, { id: req.params.id });
  } catch (error) {
    console.error('CLIENTS_UPDATE_ERROR:', error);
    return fail(res, 500, 'Erro ao atualizar cliente.');
  }
});

app.delete('/api/clients/:id', async (req, res) => {
  try {
    await safeQuery('DELETE FROM clients WHERE id = ?', [req.params.id]);
    return res.status(204).send();
  } catch (error) {
    console.error('CLIENTS_DELETE_ERROR:', error);
    return fail(res, 500, 'Erro ao remover cliente.');
  }
});

/* =========================
   PROPOSALS
========================= */
app.get('/api/proposals', async (_req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM proposals ORDER BY created_at DESC');
    const data = await attachProposalRelations(rows);
    return ok(res, data);
  } catch (error) {
    console.error('PROPOSALS_LIST_ERROR:', error);
    return fail(res, 500, 'Erro ao listar propostas.');
  }
});

app.get('/api/proposals/:id', async (req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM proposals WHERE id = ? LIMIT 1', [req.params.id]);
    const proposal = rows[0];
    if (!proposal) return fail(res, 404, 'Proposta não encontrada.');
    const [data] = await attachProposalRelations([proposal]);
    return ok(res, data);
  } catch (error) {
    console.error('PROPOSALS_GET_ERROR:', error);
    return fail(res, 500, 'Erro ao buscar proposta.');
  }
});

app.post('/api/proposals', async (req, res) => {
  try {
    const p = req.body || {};
    const id = p.id || crypto.randomUUID();
    const number = p.number || `PRP-${new Date().getFullYear()}-${Date.now()}`;

    await safeQuery(
      `INSERT INTO proposals
       (id, number, client_id, company_id, status, total_value, discount, deadline, portfolio_url, domain, platform, notes, expiry_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        number,
        p.client_id || null,
        p.company_id || null,
        p.status || 'rascunho',
        p.total_value || 0,
        p.discount || 0,
        p.deadline || null,
        p.portfolio_url || null,
        p.domain || null,
        p.platform || null,
        p.notes || null,
        p.expiry_date || null,
      ]
    );

    await writeProposalRelations(id, 'proposal_services', 'service_id', p.services_ids || []);
    await writeProposalRelations(id, 'proposal_terms', 'term_id', p.terms_ids || []);
    await writeProposalRelations(id, 'proposal_optionals', 'optional_id', p.optionals_ids || []);

    return ok(res, { id, number }, 201);
  } catch (error) {
    console.error('PROPOSALS_CREATE_ERROR:', error);
    return fail(res, 500, 'Erro ao criar proposta.');
  }
});

app.put('/api/proposals/:id', async (req, res) => {
  try {
    const p = req.body || {};
    const id = req.params.id;

    await safeQuery(
      `UPDATE proposals
       SET client_id = ?, company_id = ?, status = ?, total_value = ?, discount = ?, deadline = ?, portfolio_url = ?, domain = ?, platform = ?, notes = ?, expiry_date = ?
       WHERE id = ?`,
      [
        p.client_id || null,
        p.company_id || null,
        p.status || 'rascunho',
        p.total_value || 0,
        p.discount || 0,
        p.deadline || null,
        p.portfolio_url || null,
        p.domain || null,
        p.platform || null,
        p.notes || null,
        p.expiry_date || null,
        id,
      ]
    );

    await writeProposalRelations(id, 'proposal_services', 'service_id', p.services_ids || []);
    await writeProposalRelations(id, 'proposal_terms', 'term_id', p.terms_ids || []);
    await writeProposalRelations(id, 'proposal_optionals', 'optional_id', p.optionals_ids || []);

    return ok(res, { id });
  } catch (error) {
    console.error('PROPOSALS_UPDATE_ERROR:', error);
    return fail(res, 500, 'Erro ao atualizar proposta.');
  }
});

app.delete('/api/proposals/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await safeQuery('DELETE FROM proposals WHERE id = ?', [id]);
    await writeProposalRelations(id, 'proposal_services', 'service_id', []);
    await writeProposalRelations(id, 'proposal_terms', 'term_id', []);
    await writeProposalRelations(id, 'proposal_optionals', 'optional_id', []);
    return res.status(204).send();
  } catch (error) {
    console.error('PROPOSALS_DELETE_ERROR:', error);
    return fail(res, 500, 'Erro ao remover proposta.');
  }
});

app.use(['/api', '/auth', '/health', '/debug'], (_req, res) =>
  fail(res, 404, 'Rota não encontrada.')
);

const startServer = async (listenPort = port, listenHost = host) => {
  if (isDbConfigured) {
    await assertUsersSchema();
  }
  const server = app.listen(listenPort, listenHost, () => {
    console.log(`[OK] Server listening on http://${listenHost}:${listenPort}`);
    if (isDbConfigured) {
      console.log(
        `[OK] DB=${process.env.DB_DATABASE} HOST=${process.env.DB_HOST}:${process.env.DB_PORT} USER=${envSummary.dbUser}`
      );
    }
  });
  return server;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer().catch((error) => {
    console.error('[FATAL] Falha ao iniciar servidor.', error);
    process.exit(1);
  });
}

export { app, startServer };
