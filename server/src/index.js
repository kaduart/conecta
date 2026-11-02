import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { config } from './config.js';
import { conectar } from './db.js';
import { log } from './logger.js';
import { publico } from './routes/publico.js';
import { contador } from './routes/contador.js';

const app = express();
app.set('trust proxy', 1); // IP real atrás do proxy (vai para o registro de consentimento)
app.use(helmet());
app.use(cors({ origin: config.webOrigin, allowedHeaders: ['Content-Type', 'Authorization', 'X-Lead-Token'] }));
app.use(express.json({ limit: '200kb' }));
app.use('/v1', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/v1', publico);
app.use('/v1/contador', contador);

app.use((err, req, res, _next) => {
  if (err instanceof ZodError) return res.status(422).json({ erro: 'VALIDACAO', campos: err.flatten().fieldErrors });
  if (err.status) return res.status(err.status).json({ erro: err.codigo || err.message, detalhe: err.detalhe });
  log.error({ err: err.message, rota: req.path }, 'erro inesperado');
  res.status(500).json({ erro: 'ERRO_INTERNO' });
});

await conectar();
app.listen(config.port, () => log.info({ port: config.port }, 'API RECUPERA no ar'));
