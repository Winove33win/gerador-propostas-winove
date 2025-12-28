const resolveEnvValue = (entry) => {
  if (process.env[entry.key]) return process.env[entry.key];
  if (entry.aliases) {
    for (const alias of entry.aliases) {
      if (process.env[alias]) return process.env[alias];
    }
  }
  return undefined;
};

const formatEntryLabel = (entry) => entry.label || entry.key;

const collectMissing = (entries) =>
  entries.filter((entry) => !resolveEnvValue(entry)).map(formatEntryLabel);

export const REQUIRED_ENV = [
  {
    key: 'JWT_SECRET',
    description: 'Chave usada para assinar tokens JWT',
  },
];

export const REQUIRED_DB_ENV = [
  { key: 'DB_HOST', description: 'Host do banco MySQL' },
  { key: 'DB_PORT', description: 'Porta do banco MySQL' },
  { key: 'DB_DATABASE', description: 'Nome do banco' },
  {
    key: 'DB_USERNAME',
    aliases: ['DB_USER'],
    label: 'DB_USERNAME/DB_USER',
    description: 'Usuário do banco',
  },
  { key: 'DB_PASSWORD', description: 'Senha do banco' },
];

export const OPTIONAL_ENV = [
  { key: 'PORT', description: 'Porta do servidor (default 3333)' },
  { key: 'JWT_EXPIRES_IN', description: 'Expiração do JWT (default 7d)' },
  { key: 'SALT_ROUNDS', description: 'Rounds do bcrypt (default 12)' },
  {
    key: 'REGISTER_INVITE_TOKEN',
    description: 'Token para habilitar cadastro (produção)',
  },
  {
    key: 'ENABLE_DB_INTROSPECTION',
    description: 'Habilita endpoint /api/tables (true/false)',
  },
  {
    key: 'AUTH_RATE_LIMIT_WINDOW_MS',
    description: 'Janela do rate limit de autenticação (ms)',
  },
  {
    key: 'AUTH_RATE_LIMIT_MAX_ATTEMPTS',
    description: 'Máximo de tentativas antes do lockout',
  },
  {
    key: 'AUTH_RATE_LIMIT_LOCKOUT_BASE_MS',
    description: 'Tempo base de lockout (ms)',
  },
  {
    key: 'AUTH_RATE_LIMIT_LOCKOUT_MAX_MS',
    description: 'Tempo máximo de lockout (ms)',
  },
  { key: 'NODE_ENV', description: 'Ambiente de execução (production, etc.)' },
  { key: 'DB_CONN_LIMIT', description: 'Limite de conexões do pool' },
];

export const missingRequiredEnv = collectMissing(REQUIRED_ENV);
export const missingDbEnv = collectMissing(REQUIRED_DB_ENV);
export const missingOptionalEnv = collectMissing(OPTIONAL_ENV);

export const dbUser = resolveEnvValue({
  key: 'DB_USERNAME',
  aliases: ['DB_USER'],
});

export const envSummary = {
  required: REQUIRED_ENV,
  requiredDb: REQUIRED_DB_ENV,
  optional: OPTIONAL_ENV,
  missingRequiredEnv,
  missingDbEnv,
  missingOptionalEnv,
  dbUser,
};
