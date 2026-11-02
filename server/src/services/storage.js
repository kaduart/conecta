// Armazenamento de PDFs. MVP: disco local cifrado com AES-256-GCM.
// Produção: trocar por S3/GCS com SSE-KMS mantendo a mesma interface.
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { encrypt, decrypt } from './crypto.js';

export async function salvar(key, buffer) {
  const file = path.join(config.storageDir, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, encrypt(buffer.toString('base64')));
  return key;
}

export async function ler(key) {
  const enc = await fs.readFile(path.join(config.storageDir, key), 'utf8');
  return Buffer.from(decrypt(enc), 'base64');
}

export async function apagar(key) {
  await fs.rm(path.join(config.storageDir, key), { force: true });
}
