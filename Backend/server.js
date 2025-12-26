import express from 'express';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = Number(process.env.PORT || 3000);
const host = '0.0.0.0';
const distDir = path.join(__dirname, 'dist');

/* =========================
   ENV / DB CONFIG
========================= */
const DB_DATABASE = process.env.DB_DATABASE || process.env.DB_NAME || 'propostas-winove';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USERNAME || process.env.DB_USER;
const DB_PASS = process.env.DB_PASSWORD ?? process.env.DB_PASS;

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const SALT_ROUNDS = Number(process.env.SALT_ROUNDS || 12);

const missingEnv = [];
if (!DB_USER) missingEnv.push('DB_USERNAME/DB_USER');
if (DB_PASS === undefined) missingEnv.push('DB_PASSWORD/DB_PASS');
if (!JWT_SECRET) missingEnv.push('JWT_SECRET');

if (missingEnv.length > 0) {
  console.warn(`[WARN] Variáveis de ambiente ausentes: ${missingEnv.join(', ')}.`);
}

const app = express();
app.use(express.json({ limit: '1mb' }));

const dbPool =
  DB_USER && DB_PASS !== undefined
    ? mysql.createPool({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASS,
        database: DB_DATABASE,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      })
    : null;

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

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (!token || scheme?.toLowerCase() !== 'bearer') {
    return fail(res, 401, 'Token ausente.');
  }

  if (!JWT_SECRET) {
    return fail(res, 500, 'JWT_SECRET não definido no ambiente.');
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return fail(res, 403, 'Token inválido ou expirado.');
  }
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
const loginHandler = async (req, res) => {
  try {
    const body = req.body?.auth || req.body || {};
    const email = body?.email?.trim();
    const cnpjAccess = body?.cnpj_access;
    const password = body?.password;

    if (!email || !cnpjAccess || !password) {
      return fail(res, 400, 'Credenciais incompletas.');
    }

    const normalizedCnpj = normalizeCnpj(cnpjAccess);

    // busca usuário por email
    const rows = await safeQuery(
      `SELECT id, name, email, cnpj_access, password, role
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    const user = rows[0];
    if (!user) return fail(res, 401, 'Credenciais inválidas.');

    // valida CNPJ (tripla validação)
    if (normalizeCnpj(user.cnpj_access) !== normalizedCnpj) {
      return fail(res, 401, 'Credenciais inválidas.');
    }

    // valida senha (bcrypt ou texto puro)
    const stored = user.password || '';
    const okPass = isBcryptHash(stored)
      ? await bcrypt.compare(password, stored)
      : stored === password;

    if (!okPass) return fail(res, 401, 'Credenciais inválidas.');

    // migra senha texto puro -> bcrypt no 1º login bem sucedido
    if (!isBcryptHash(stored)) {
      const newHash = await bcrypt.hash(password, SALT_ROUNDS);
      await safeQuery('UPDATE users SET password = ? WHERE id = ?', [newHash, user.id]);
      user.password = newHash;
    }

    const token = signToken(user);

    // ✅ PADRÃO para o front: sempre data
    return ok(res, { token, user: sanitizeUser(user) });
  } catch (error) {
    console.error('AUTH_LOGIN_ERROR:', error);
    return fail(res, 500, 'Erro interno ao autenticar.');
  }
};

const registerHandler = async (req, res) => {
  try {
    console.log('➡️ REGISTER payload:', req.body);

    const payload = req.body?.auth || req.body;

    const name = payload?.name?.trim();
    const email = payload?.email?.trim();
    const cnpjAccess = payload?.cnpj_access;
    const password = payload?.password;

    if (!name || !email || !cnpjAccess || !password) {
      console.warn('❌ Dados ausentes');
      return fail(res, 400, 'Dados obrigatórios ausentes.');
    }

    const cnpjNormalized = normalizeCnpj(cnpjAccess);

    const existing = await safeQuery(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (existing.length > 0) {
      console.warn('⚠️ Email já cadastrado:', email);
      return fail(res, 409, 'E-mail já cadastrado.');
    }

    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    console.log('📝 Inserindo usuário:', {
      id,
      name,
      email,
      cnpjNormalized,
    });

    await safeQuery(
      `INSERT INTO users (id, name, email, cnpj_access, password, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [id, name, email, cnpjNormalized, passwordHash, 'employee']
    );

    console.log('✅ Usuário criado com sucesso:', email);

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
    return fail(res, 500, 'Erro interno ao registrar.', error.message);
  }
};

app.post('/auth/login', loginHandler);
app.post('/auth/register', registerHandler);

app.use('/api', requireAuth);

/* =========================
   HEALTH
========================= */
const healthHandler = (_req, res) => ok(res, { ok: true });

const healthDbHandler = async (_req, res) => {
  if (!dbPool) {
    return fail(res, 503, 'Banco de dados não configurado.');
  }
  try {
    const [rows] = await dbPool.query('SELECT DATABASE() AS db');
    return ok(res, { ok: true, db: rows?.[0]?.db });
  } catch (error) {
    console.error('HEALTH_DB_ERROR:', error);
    return fail(res, 500, 'Falha no health check do banco.', error?.message);
  }
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
app.get('/health/db', healthDbHandler);
app.get('/api/health/db', healthDbHandler);
app.get('/auth/health', (_req, res) => ok(res, { ok: true }));

/* =========================
   COMPANIES
========================= */
app.get('/api/companies', async (_req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM companies ORDER BY name ASC');
    return ok(res, rows);
  } catch (error) {
    console.error('COMPANIES_LIST_ERROR:', error);
    return fail(res, 500, 'Erro ao listar empresas.');
  }
});

app.get('/api/companies/:id', async (req, res) => {
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

app.post('/api/companies', async (req, res) => {
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

app.put('/api/companies/:id', async (req, res) => {
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

app.delete('/api/companies/:id', async (req, res) => {
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
app.get('/api/services', async (_req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM services ORDER BY description ASC');
    const data = rows.map((row) => ({ ...row, benefits: parseJsonArray(row.benefits) }));
    return ok(res, data);
  } catch (error) {
    console.error('SERVICES_LIST_ERROR:', error);
    return fail(res, 500, 'Erro ao listar serviços.');
  }
});

app.get('/api/services/:id', async (req, res) => {
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

app.post('/api/services', async (req, res) => {
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

app.put('/api/services/:id', async (req, res) => {
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

app.delete('/api/services/:id', async (req, res) => {
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
app.get('/api/optionals', async (_req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM optionals ORDER BY description ASC');
    return ok(res, rows);
  } catch (error) {
    console.error('OPTIONALS_LIST_ERROR:', error);
    return fail(res, 500, 'Erro ao listar opcionais.');
  }
});

app.get('/api/optionals/:id', async (req, res) => {
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

app.post('/api/optionals', async (req, res) => {
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

app.put('/api/optionals/:id', async (req, res) => {
  try {
    const p = req.body || {};
    await safeQuery(`UPDATE optionals SET description = ?, value = ? WHERE id = ?`, [p.description, p.value || 0, req.params.id]);
    return ok(res, { id: req.params.id });
  } catch (error) {
    console.error('OPTIONALS_UPDATE_ERROR:', error);
    return fail(res, 500, 'Erro ao atualizar opcional.');
  }
});

app.delete('/api/optionals/:id', async (req, res) => {
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
app.get('/api/terms', async (_req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM terms ORDER BY title ASC');
    return ok(res, rows);
  } catch (error) {
    console.error('TERMS_LIST_ERROR:', error);
    return fail(res, 500, 'Erro ao listar termos.');
  }
});

app.get('/api/terms/:id', async (req, res) => {
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

app.post('/api/terms', async (req, res) => {
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

app.put('/api/terms/:id', async (req, res) => {
  try {
    const p = req.body || {};
    await safeQuery(`UPDATE terms SET title = ?, content = ? WHERE id = ?`, [p.title, p.content, req.params.id]);
    return ok(res, { id: req.params.id });
  } catch (error) {
    console.error('TERMS_UPDATE_ERROR:', error);
    return fail(res, 500, 'Erro ao atualizar termo.');
  }
});

app.delete('/api/terms/:id', async (req, res) => {
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
app.get('/api/users', async (_req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM users ORDER BY name ASC');
    return ok(res, rows.map(sanitizeUser));
  } catch (error) {
    console.error('USERS_LIST_ERROR:', error);
    return fail(res, 500, 'Erro ao listar usuários.');
  }
});

app.get('/api/users/:id', async (req, res) => {
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

app.post('/api/users', async (req, res) => {
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

app.put('/api/users/:id', async (req, res) => {
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

app.delete('/api/users/:id', async (req, res) => {
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

/* =========================
   STATIC + SPA FALLBACK
========================= */
app.use(['/api', '/auth'], (_req, res) => fail(res, 404, 'Rota não encontrada.'));

app.use(express.static(distDir));
app.get('*', (_req, res) => {
  if (_req.path.startsWith('/api') || _req.path.startsWith('/auth')) {
    return res.status(404).json({ error: 'Rota não encontrada.', data: null });
  }
  if (_req.method !== 'GET' && _req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Método não permitido.', data: null });
  }
  return res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, host, () => {
  console.log(`[OK] Server listening on http://${host}:${port}`);
  console.log(`[OK] DB=${DB_DATABASE} HOST=${DB_HOST}:${DB_PORT} USER=${DB_USER}`);
});
