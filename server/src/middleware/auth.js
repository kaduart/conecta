import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function assinarToken(contador) {
  return jwt.sign({ sub: String(contador._id), tipo: 'contador' }, config.jwtSecret, { expiresIn: '12h' });
}

export function exigirContador(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ erro: 'NAO_AUTENTICADO' });
  try {
    const p = jwt.verify(token, config.jwtSecret);
    if (p.tipo !== 'contador') throw new Error('tipo');
    req.contadorId = p.sub;
    next();
  } catch {
    res.status(401).json({ erro: 'TOKEN_INVALIDO' });
  }
}

/** Erros de validação/negócio com status HTTP explícito. */
export class HttpError extends Error {
  constructor(status, codigo, detalhe) { super(codigo); this.status = status; this.codigo = codigo; this.detalhe = detalhe; }
}
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
