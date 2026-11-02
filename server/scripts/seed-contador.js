// Cria um contador parceiro e imprime a chave de acesso ao painel (mostrada uma vez só).
// Uso: node scripts/seed-contador.js "Escritório X" "Fulano" "CRC-DF 012345/O-1" email@x.com 5561999999999 escritorio-x
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { conectar } from '../src/db.js';
import { Contador } from '../src/models/index.js';
import { sha256 } from '../src/services/crypto.js';

const [escritorio, responsavel, crc, email, whatsapp, slugLink] = process.argv.slice(2);
if (!slugLink) { console.error('Faltam argumentos. Veja o cabeçalho do script.'); process.exit(1); }
await conectar();
const apiKey = crypto.randomBytes(24).toString('base64url');
await Contador.create({ escritorio, responsavel, crc, email, whatsapp, slugLink, apiKeyHash: sha256(Buffer.from(apiKey)) });
console.log(`Contador criado. Link do convite: /c/${slugLink}`);
console.log(`Chave do painel (guarde agora): ${apiKey}`);
await mongoose.disconnect();
