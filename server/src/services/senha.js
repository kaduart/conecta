// Hash de senha com scrypt (nativo do Node, sem dependência extra).
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const N = 16384; const KEYLEN = 64;

export async function hashSenha(senha) {
  if (!senha || senha.length < 10) throw new Error('A senha precisa ter pelo menos 10 caracteres');
  const sal = crypto.randomBytes(16);
  const hash = await scrypt(senha, sal, KEYLEN, { N });
  return `scrypt$${N}$${sal.toString('base64')}$${hash.toString('base64')}`;
}

export async function conferirSenha(senha, armazenado) {
  const [alg, n, sal, hash] = String(armazenado || '').split('$');
  if (alg !== 'scrypt') return false;
  const esperado = Buffer.from(hash, 'base64');
  const obtido = await scrypt(String(senha), Buffer.from(sal, 'base64'), esperado.length, { N: Number(n) });
  return crypto.timingSafeEqual(esperado, obtido);
}
