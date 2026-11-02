// Cria um contador parceiro com senha.
// Uso: node scripts/seed-contador.js "Escritório X" "Fulano" "CRC-DF 012345/O-1" email@x.com 5561999999999 escritorio-x "senha-com-10+"
import mongoose from 'mongoose';
import { conectar } from '../src/db.js';
import { Contador } from '../src/models/index.js';
import { hashSenha } from '../src/services/senha.js';

const [nome_escritorio, nome_responsavel, crc, email, whatsapp, slug_link, senha] = process.argv.slice(2);
if (!senha) { console.error('Faltam argumentos. Veja o cabeçalho do script.'); process.exit(1); }
await conectar();
await Contador.create({ nome_escritorio, nome_responsavel, crc, email, whatsapp, slug_link, password_hash: await hashSenha(senha) });
console.log(`Contador criado. Link do convite: /c/${slug_link}`);
await mongoose.disconnect();
