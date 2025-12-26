import mysql from 'mysql2/promise';

const REQUIRED = ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE'];

const missing = REQUIRED.filter((key) => !process.env[key]);

if (missing.length) {
  console.error('[DB] Variáveis ausentes:', missing.join(', '));
}

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const isDbConfigured = missing.length === 0;

export const pool = isDbConfigured
  ? mysql.createPool({
      host: process.env.DB_HOST,
      port: toNumber(process.env.DB_PORT, 3306),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      waitForConnections: true,
      connectionLimit: toNumber(process.env.DB_CONN_LIMIT, 10),
      queueLimit: 0,
    })
  : null;

export const missingDbEnv = missing;
