// Armazenamento de PDFs, sempre cifrados com AES-256-GCM antes de sair do processo.
// Com S3_BUCKET definido usa um bucket S3 compatível (Cloudflare R2, AWS S3, etc.).
// Sem ele usa o disco local (só para desenvolvimento: no Render free o disco é apagado).
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { encrypt, decrypt } from './crypto.js';

let s3; // cliente criado sob demanda
async function cliente() {
  if (s3) return s3;
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  const c = new S3Client({
    region: config.s3.region,
    endpoint: config.s3.endpoint,
    credentials: { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey },
  });
  s3 = { c, PutObjectCommand, GetObjectCommand, DeleteObjectCommand };
  return s3;
}

export const usandoS3 = () => Boolean(config.s3.bucket);

export async function salvar(key, buffer) {
  const corpo = encrypt(buffer.toString('base64'));
  if (usandoS3()) {
    const { c, PutObjectCommand } = await cliente();
    await c.send(new PutObjectCommand({ Bucket: config.s3.bucket, Key: key, Body: corpo, ContentType: 'text/plain' }));
    return key;
  }
  const file = path.join(config.storageDir, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, corpo);
  return key;
}

export async function ler(key) {
  let enc;
  if (usandoS3()) {
    const { c, GetObjectCommand } = await cliente();
    const r = await c.send(new GetObjectCommand({ Bucket: config.s3.bucket, Key: key }));
    enc = await r.Body.transformToString('utf8');
  } else {
    enc = await fs.readFile(path.join(config.storageDir, key), 'utf8');
  }
  return Buffer.from(decrypt(enc), 'base64');
}

export async function apagar(key) {
  if (usandoS3()) {
    const { c, DeleteObjectCommand } = await cliente();
    await c.send(new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: key })); // idempotente
    return;
  }
  await fs.rm(path.join(config.storageDir, key), { force: true });
}
