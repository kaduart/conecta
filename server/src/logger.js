import pino from 'pino';

// Nunca logar CPF, valores de documento ou tokens: o redact cobre os campos mais comuns.
export const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['req.headers.authorization', '*.cpf', '*.cpfEnc', '*.token', '*.tokenEnc', '*.chavePix', '*.chavePixEnc', '*.apiKey'],
});
