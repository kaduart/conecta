import 'dotenv/config';

function req(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT || 4000),
  mongoUrl: req('MONGO_URL'),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: req('JWT_SECRET'),
  encKey: req('ENC_KEY'),                   // 32 bytes em base64 (AES-256-GCM)
  storageDir: process.env.STORAGE_DIR || './storage',
  webOrigin: process.env.WEB_ORIGIN || 'http://localhost:5173',
  termoVersao: process.env.TERMO_VERSAO || '2026-11',
  retencaoDias: Number(process.env.RETENCAO_DIAS || 30),
  evolutionUrl: process.env.EVOLUTION_URL,  // ex.: https://evolution.seudominio.com
  zapiUrl: process.env.ZAPI_URL || 'https://api.z-api.io',
  zapiClientToken: process.env.ZAPI_CLIENT_TOKEN,
  // Data-base para a prescrição. Vazio = hoje. Fixar só em teste/auditoria.
  dataBase: process.env.DATA_BASE || null,
};
