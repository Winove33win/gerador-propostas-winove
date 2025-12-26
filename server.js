import express from 'express';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env.PORT || 3000;
const distDir = path.join(__dirname, 'dist');

const DB_DATABASE = process.env.DB_DATABASE || process.env.DB_NAME || 'propostas-winove';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USERNAME || process.env.DB_USER;
const DB_PASS = process.env.DB_PASSWORD || process.env.DB_PASS;

if (!DB_USER) {
  throw new Error('DB_USERNAME/DB_USER não definido no ambiente.');
}
if (DB_PASS === undefined) {
  throw new Error('DB_PASSWORD/DB_PASS não definido no ambiente.');
}

const app = express();
app.use(express.json({ limit: '1mb' }));

const dbPool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASS,
  database: DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const JWT_SECRET = process.env.JWT_SECRET || 'troque-isso-agora';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const SALT_ROUNDS = Number(process.env.SALT_ROUNDS || 12);

const normalizeCnpj = (value = '') => String(value).replace(/\D/g, '');

const safeQuery = async (sql, params = []) => {
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
  } catch (error) {
    return [];
  }
};

const serializeJsonArray = (value) => {
  if (!value) return null;
  return JSON.stringify(value);
};

const readRelationMap = async (table, column, proposalIds = []) => {
  if (proposalIds.length === 0) return new Map();
  try {
    const [rows] = await dbPool.query(
      `SELECT proposal_id, ${column} AS related_id FROM ${table} WHERE proposal_id IN (?)`,
      [proposalIds]
    );
    const map = new Map();
    rows.forEach((row) => {
      if (!map.has(row.proposal_id)) {
        map.set(row.proposal_id, []);
      }
      map.get(row.proposal_id).push(row.related_id);
    });
    return map;
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return new Map();
    }
    throw error;
  }
};

const attachProposalRelations = async (proposals) => {
  const ids = proposals.map((proposal) => proposal.id);
  const servicesMap = await readRelationMap('proposal_services', 'service_id', ids);
  const termsMap = await readRelationMap('proposal_terms', 'term_id', ids);
  const optionalsMap = await readRelationMap('proposal_optionals', 'optional_id', ids);

  return proposals.map((proposal) => ({
    ...proposal,
    services_ids: servicesMap.get(proposal.id) || [],
    terms_ids: termsMap.get(proposal.id) || [],
    optionals_ids: optionalsMap.get(proposal.id) || [],
  }));
};

const loginHandler = async (req, res) => {
  try {
    const payload = req.body?.auth || req.body;
    const email = payload?.email?.trim();
    const cnpjAccess = payload?.cnpj_access;
    const password = payload?.password;

    if (!email || !cnpjAccess || !password) {
      return res.status(400).json({ error: 'Credenciais incompletas.' });
    }

    const normalizedCnpj = normalizeCnpj(cnpjAccess);
    const rows = await safeQuery(
      `SELECT id, name, email, cnpj_access, password, role
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    if (normalizeCnpj(user.cnpj_access) !== normalizedCnpj) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const stored = user.password || '';
    const isBcrypt = stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$');
    const ok = isBcrypt ? await bcrypt.compare(password, stored) : stored === password;
    if (!ok) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    if (!isBcrypt) {
      const newHash = await bcrypt.hash(password, SALT_ROUNDS);
      await safeQuery('UPDATE users SET password = ? WHERE id = ?', [newHash, user.id]);
    }

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        cnpj_access: normalizeCnpj(user.cnpj_access || ''),
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno ao autenticar.' });
  }
};

const registerHandler = async (req, res) => {
  try {
    const payload = req.body?.auth || req.body;
    const name = payload?.name;
    const email = payload?.email?.trim();
    const cnpjAccess = payload?.cnpj_access;
    const password = payload?.password;
    if (!name || !email || !cnpjAccess || !password) {
      return res.status(400).json({ error: 'Dados obrigatórios ausentes.' });
    }

    const existing = await safeQuery('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'E-mail já cadastrado.' });
    }

    const id = crypto.randomUUID();
    const cnpjNormalized = normalizeCnpj(cnpjAccess);
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await safeQuery(
      'INSERT INTO users (id, name, email, cnpj_access, password, role) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, email, cnpjNormalized, passwordHash, 'employee']
    );

    return res.status(201).json({
      user: sanitizeUser({ id, name, email, cnpj_access: cnpjNormalized, role: 'employee' }),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno ao registrar.' });
  }
};

const authRouter = express.Router();
authRouter.post('/login', loginHandler);
authRouter.post('/register', registerHandler);

app.use('/auth', authRouter);
app.use('/api/auth', authRouter);

const healthDbHandler = async (_req, res) => {
  try {
    const [rows] = await dbPool.query('SELECT DATABASE() AS db');
    return res.json({ ok: true, db: rows?.[0]?.db });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
};

app.get('/health/db', healthDbHandler);
app.get('/api/health/db', healthDbHandler);

app.get('/api/companies', async (_req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM companies ORDER BY name ASC');
    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar empresas.' });
  }
});

app.get('/api/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await safeQuery('SELECT * FROM companies WHERE id = ? LIMIT 1', [id]);
    const company = rows[0];
    if (!company) {
      return res.status(404).json({ error: 'Empresa não encontrada.' });
    }
    return res.json({ data: company });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar empresa.' });
  }
});

app.post('/api/companies', async (req, res) => {
  try {
    const payload = req.body || {};
    const id = payload.id || crypto.randomUUID();
    const company = {
      id,
      name: payload.name,
      cnpj: payload.cnpj,
      address: payload.address || null,
      email: payload.email || null,
      phone: payload.phone || null,
      bank_info: payload.bank_info || null,
    };
    await safeQuery(
      `INSERT INTO companies (id, name, cnpj, address, email, phone, bank_info)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [company.id, company.name, company.cnpj, company.address, company.email, company.phone, company.bank_info]
    );
    return res.status(201).json({ data: company });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar empresa.' });
  }
});

app.put('/api/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    await safeQuery(
      `UPDATE companies
       SET name = ?, cnpj = ?, address = ?, email = ?, phone = ?, bank_info = ?
       WHERE id = ?`,
      [
        payload.name,
        payload.cnpj,
        payload.address || null,
        payload.email || null,
        payload.phone || null,
        payload.bank_info || null,
        id,
      ]
    );
    return res.json({ data: { id } });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar empresa.' });
  }
});

app.delete('/api/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await safeQuery('DELETE FROM companies WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao remover empresa.' });
  }
});

app.get('/api/services', async (_req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM services ORDER BY description ASC');
    const data = rows.map((row) => ({
      ...row,
      benefits: parseJsonArray(row.benefits),
    }));
    return res.json({ data });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar serviços.' });
  }
});

app.get('/api/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await safeQuery('SELECT * FROM services WHERE id = ? LIMIT 1', [id]);
    const service = rows[0];
    if (!service) {
      return res.status(404).json({ error: 'Serviço não encontrado.' });
    }
    return res.json({ data: { ...service, benefits: parseJsonArray(service.benefits) } });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar serviço.' });
  }
});

app.post('/api/services', async (req, res) => {
  try {
    const payload = req.body || {};
    const id = payload.id || crypto.randomUUID();
    const service = {
      id,
      description: payload.description,
      detailed_description: payload.detailed_description || null,
      benefits: payload.benefits || [],
      value: payload.value || 0,
      unit: payload.unit || 'fixo',
    };
    await safeQuery(
      `INSERT INTO services (id, description, detailed_description, benefits, value, unit)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        service.id,
        service.description,
        service.detailed_description,
        serializeJsonArray(service.benefits),
        service.value,
        service.unit,
      ]
    );
    return res.status(201).json({ data: service });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar serviço.' });
  }
});

app.put('/api/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    await safeQuery(
      `UPDATE services
       SET description = ?, detailed_description = ?, benefits = ?, value = ?, unit = ?
       WHERE id = ?`,
      [
        payload.description,
        payload.detailed_description || null,
        serializeJsonArray(payload.benefits || []),
        payload.value || 0,
        payload.unit || 'fixo',
        id,
      ]
    );
    return res.json({ data: { id } });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar serviço.' });
  }
});

app.delete('/api/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await safeQuery('DELETE FROM services WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao remover serviço.' });
  }
});

app.get('/api/optionals', async (_req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM optionals ORDER BY description ASC');
    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar opcionais.' });
  }
});

app.get('/api/optionals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await safeQuery('SELECT * FROM optionals WHERE id = ? LIMIT 1', [id]);
    const optional = rows[0];
    if (!optional) {
      return res.status(404).json({ error: 'Opcional não encontrado.' });
    }
    return res.json({ data: optional });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar opcional.' });
  }
});

app.post('/api/optionals', async (req, res) => {
  try {
    const payload = req.body || {};
    const id = payload.id || crypto.randomUUID();
    const optional = {
      id,
      description: payload.description,
      value: payload.value || 0,
    };
    await safeQuery(
      `INSERT INTO optionals (id, description, value) VALUES (?, ?, ?)`,
      [optional.id, optional.description, optional.value]
    );
    return res.status(201).json({ data: optional });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar opcional.' });
  }
});

app.put('/api/optionals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    await safeQuery(
      `UPDATE optionals SET description = ?, value = ? WHERE id = ?`,
      [payload.description, payload.value || 0, id]
    );
    return res.json({ data: { id } });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar opcional.' });
  }
});

app.delete('/api/optionals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await safeQuery('DELETE FROM optionals WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao remover opcional.' });
  }
});

app.get('/api/terms', async (_req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM terms ORDER BY title ASC');
    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar termos.' });
  }
});

app.get('/api/terms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await safeQuery('SELECT * FROM terms WHERE id = ? LIMIT 1', [id]);
    const term = rows[0];
    if (!term) {
      return res.status(404).json({ error: 'Termo não encontrado.' });
    }
    return res.json({ data: term });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar termo.' });
  }
});

app.post('/api/terms', async (req, res) => {
  try {
    const payload = req.body || {};
    const id = payload.id || crypto.randomUUID();
    const term = {
      id,
      title: payload.title,
      content: payload.content,
    };
    await safeQuery(
      `INSERT INTO terms (id, title, content) VALUES (?, ?, ?)`,
      [term.id, term.title, term.content]
    );
    return res.status(201).json({ data: term });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar termo.' });
  }
});

app.put('/api/terms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    await safeQuery(
      `UPDATE terms SET title = ?, content = ? WHERE id = ?`,
      [payload.title, payload.content, id]
    );
    return res.json({ data: { id } });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar termo.' });
  }
});

app.delete('/api/terms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await safeQuery('DELETE FROM terms WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao remover termo.' });
  }
});

app.get('/api/users', async (_req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM users ORDER BY name ASC');
    const users = rows.map((user) => sanitizeUser(user));
    return res.json({ data: users });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar usuários.' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await safeQuery('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
    const user = rows[0];
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    return res.json({ data: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar usuário.' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const payload = req.body || {};
    const id = payload.id || crypto.randomUUID();
    const user = {
      id,
      name: payload.name,
      email: payload.email,
      cnpj_access: payload.cnpj_access,
      password: payload.password,
      role: payload.role || 'employee',
    };
    await safeQuery(
      'INSERT INTO users (id, name, email, cnpj_access, password, role) VALUES (?, ?, ?, ?, ?, ?)',
      [user.id, user.name, user.email, user.cnpj_access, user.password, user.role]
    );
    return res.status(201).json({ data: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    await safeQuery(
      `UPDATE users
       SET name = ?, email = ?, cnpj_access = ?, password = COALESCE(?, password), role = ?
       WHERE id = ?`,
      [
        payload.name,
        payload.email,
        payload.cnpj_access,
        payload.password || null,
        payload.role || 'employee',
        id,
      ]
    );
    return res.json({ data: { id } });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar usuário.' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await safeQuery('DELETE FROM users WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao remover usuário.' });
  }
});

app.get('/api/clients', async (_req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM clients ORDER BY name ASC');
    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar clientes.' });
  }
});

app.get('/api/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await safeQuery('SELECT * FROM clients WHERE id = ? LIMIT 1', [id]);
    const client = rows[0];
    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }
    return res.json({ data: client });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar cliente.' });
  }
});

app.post('/api/clients', async (req, res) => {
  try {
    const payload = req.body || {};
    const id = payload.id || crypto.randomUUID();
    const client = {
      id,
      name: payload.name,
      document: payload.document,
      address: payload.address || null,
      person_name: payload.person_name || null,
      job_title: payload.job_title || null,
      email: payload.email || null,
      phone: payload.phone || null,
    };
    await safeQuery(
      `INSERT INTO clients (id, name, document, address, person_name, job_title, email, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        client.id,
        client.name,
        client.document,
        client.address,
        client.person_name,
        client.job_title,
        client.email,
        client.phone,
      ]
    );
    return res.status(201).json({ data: client });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar cliente.' });
  }
});

app.put('/api/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    await safeQuery(
      `UPDATE clients
       SET name = ?, document = ?, address = ?, person_name = ?, job_title = ?, email = ?, phone = ?
       WHERE id = ?`,
      [
        payload.name,
        payload.document,
        payload.address || null,
        payload.person_name || null,
        payload.job_title || null,
        payload.email || null,
        payload.phone || null,
        id,
      ]
    );
    return res.json({ data: { id } });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar cliente.' });
  }
});

app.delete('/api/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await safeQuery('DELETE FROM clients WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao remover cliente.' });
  }
});

const writeProposalRelations = async (proposalId, table, column, ids = []) => {
  try {
    await safeQuery(`DELETE FROM ${table} WHERE proposal_id = ?`, [proposalId]);
    if (ids.length === 0) return;
    const values = ids.map((id) => [proposalId, id]);
    await dbPool.query(
      `INSERT INTO ${table} (proposal_id, ${column}) VALUES ?`,
      [values]
    );
  } catch (error) {
    if (error?.code !== 'ER_NO_SUCH_TABLE') {
      throw error;
    }
  }
};

app.get('/api/proposals', async (_req, res) => {
  try {
    const rows = await safeQuery('SELECT * FROM proposals ORDER BY created_at DESC');
    const data = await attachProposalRelations(rows);
    return res.json({ data });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar propostas.' });
  }
});

app.get('/api/proposals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await safeQuery('SELECT * FROM proposals WHERE id = ? LIMIT 1', [id]);
    const proposal = rows[0];
    if (!proposal) {
      return res.status(404).json({ error: 'Proposta não encontrada.' });
    }
    const [data] = await attachProposalRelations([proposal]);
    return res.json({ data });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar proposta.' });
  }
});

app.post('/api/proposals', async (req, res) => {
  try {
    const payload = req.body || {};
    const id = payload.id || crypto.randomUUID();
    const number = payload.number || `PRP-${new Date().getFullYear()}-${Date.now()}`;
    await safeQuery(
      `INSERT INTO proposals
       (id, number, client_id, company_id, status, total_value, discount, deadline, portfolio_url, domain, platform, notes, expiry_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        number,
        payload.client_id || null,
        payload.company_id || null,
        payload.status || 'rascunho',
        payload.total_value || 0,
        payload.discount || 0,
        payload.deadline || null,
        payload.portfolio_url || null,
        payload.domain || null,
        payload.platform || null,
        payload.notes || null,
        payload.expiry_date || null,
      ]
    );

    await writeProposalRelations(id, 'proposal_services', 'service_id', payload.services_ids || []);
    await writeProposalRelations(id, 'proposal_terms', 'term_id', payload.terms_ids || []);
    await writeProposalRelations(id, 'proposal_optionals', 'optional_id', payload.optionals_ids || []);

    return res.status(201).json({ data: { id, number } });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar proposta.' });
  }
});

app.put('/api/proposals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    await safeQuery(
      `UPDATE proposals
       SET client_id = ?, company_id = ?, status = ?, total_value = ?, discount = ?, deadline = ?, portfolio_url = ?, domain = ?, platform = ?, notes = ?, expiry_date = ?
       WHERE id = ?`,
      [
        payload.client_id || null,
        payload.company_id || null,
        payload.status || 'rascunho',
        payload.total_value || 0,
        payload.discount || 0,
        payload.deadline || null,
        payload.portfolio_url || null,
        payload.domain || null,
        payload.platform || null,
        payload.notes || null,
        payload.expiry_date || null,
        id,
      ]
    );

    await writeProposalRelations(id, 'proposal_services', 'service_id', payload.services_ids || []);
    await writeProposalRelations(id, 'proposal_terms', 'term_id', payload.terms_ids || []);
    await writeProposalRelations(id, 'proposal_optionals', 'optional_id', payload.optionals_ids || []);

    return res.json({ data: { id } });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar proposta.' });
  }
});

app.delete('/api/proposals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await safeQuery('DELETE FROM proposals WHERE id = ?', [id]);
    await writeProposalRelations(id, 'proposal_services', 'service_id', []);
    await writeProposalRelations(id, 'proposal_terms', 'term_id', []);
    await writeProposalRelations(id, 'proposal_optionals', 'optional_id', []);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao remover proposta.' });
  }
});

app.use(express.static(distDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
