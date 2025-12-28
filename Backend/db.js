import mysql from 'mysql2/promise';
import { dbUser, missingDbEnv } from './env.js';

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const isDbConfigured = missingDbEnv.length === 0;

export const pool = isDbConfigured
  ? mysql.createPool({
      host: process.env.DB_HOST,
      port: toNumber(process.env.DB_PORT, 3306),
      user: dbUser,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      waitForConnections: true,
      connectionLimit: toNumber(process.env.DB_CONN_LIMIT, 10),
      queueLimit: 0,
    })
  : null;

export { missingDbEnv };
