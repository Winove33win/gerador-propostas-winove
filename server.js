import express from 'express';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env.PORT || 3000;
const distDir = path.join(__dirname, 'dist');

const app = express();
app.use(express.json({ limit: '1mb' }));

const dbPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USERNAME || process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || process.env.DB_NAME || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const normalizeCnpj = (value = '') => value.replace(/\D/g, '');

const safeQuery = async (sql, params = []) => {
  const [rows] = await dbPool.execute(sql, params);
  return rows;
};

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
};

app.post('/auth/login', async (req, res) => {
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
         AND REPLACE(REPLACE(REPLACE(cnpj_access, '.', ''), '/', ''), '-', '') = ?
       LIMIT 1`,
      [email, normalizedCnpj]
    );

    const user = rows[0];
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno ao autenticar.' });
  }
});

app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, cnpj_access: cnpjAccess, password } = req.body || {};
    if (!name || !email || !cnpjAccess || !password) {
      return res.status(400).json({ error: 'Dados obrigatórios ausentes.' });
    }

    const existing = await safeQuery('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'E-mail já cadastrado.' });
    }

    const id = crypto.randomUUID();
    await safeQuery(
      'INSERT INTO users (id, name, email, cnpj_access, password, role) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, email, cnpjAccess, password, 'employee']
    );

    return res.status(201).json({
      user: sanitizeUser({ id, name, email, cnpj_access: cnpjAccess, role: 'employee' }),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno ao registrar.' });
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

app.post('/api/clients', async (req, res) => {
  try {
    const payload = req.body || {};
    const id = payload.id || crypto.randomUUID();
    await safeQuery(
      `INSERT INTO clients (id, name, document, address, person_name, job_title, email, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        payload.name,
        payload.document,
        payload.address || null,
        payload.person_name || null,
        payload.job_title || null,
        payload.email || null,
        payload.phone || null,
      ]
    );
    return res.status(201).json({ id });
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
    return res.json({ id });
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
    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar propostas.' });
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

    return res.status(201).json({ id, number });
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

    return res.json({ id });
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
