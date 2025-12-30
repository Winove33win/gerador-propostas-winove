import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { isDbConfigured, pool as dbPool } from '../db.js';

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS || 12);

const isBcryptHash = (value = '') =>
  value.startsWith('$2a$') || value.startsWith('$2b$') || value.startsWith('$2y$');

const run = async () => {
  if (!isDbConfigured || !dbPool) {
    console.error('[hash-legacy-passwords] Banco de dados não configurado.');
    process.exit(1);
  }

  const [rows] = await dbPool.query(
    "SELECT id, email, password FROM users WHERE password IS NOT NULL AND password NOT LIKE '$2%'"
  );

  const legacyUsers = rows.filter((row) => !isBcryptHash(row.password || ''));

  if (legacyUsers.length === 0) {
    console.log('[hash-legacy-passwords] Nenhuma senha legada encontrada.');
    await dbPool.end();
    return;
  }

  console.log(
    `[hash-legacy-passwords] Hashing de ${legacyUsers.length} senha(s) legada(s).`
  );

  for (const user of legacyUsers) {
    const newHash = await bcrypt.hash(user.password, SALT_ROUNDS);
    await dbPool.execute('UPDATE users SET password = ? WHERE id = ?', [newHash, user.id]);
    console.log(`[hash-legacy-passwords] Atualizado: ${user.email}`);
  }

  await dbPool.end();
};

run().catch((error) => {
  console.error('[hash-legacy-passwords] Falha ao migrar senhas:', error);
  process.exit(1);
});
