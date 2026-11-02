// Escritório de contabilidade parceiro. Cada um tem um link /c/:slug_link para os clientes.
import mongoose from 'mongoose';

const ContadorSchema = new mongoose.Schema({
  nome_escritorio: { type: String, required: true, trim: true },
  nome_responsavel: { type: String, required: true, trim: true },
  crc: { type: String, required: true, unique: true, trim: true },              // 'CRC-DF 012345/O-1'
  cnpj: { type: String, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true, select: false },              // scrypt (services/senha.js)
  whatsapp: { type: String, required: true, match: /^55\d{10,11}$/ },          // 5561999990000
  slug_link: { type: String, required: true, unique: true, lowercase: true, match: /^[a-z0-9-]{3,40}$/ },
  chave_pix_cifrada: { type: String, select: false },                          // AES-256-GCM (services/crypto.js)
  honorarios_percentual: { type: Number, default: 30, min: 0, max: 30 },
  whatsapp_provider: {                                                         // envio do alerta ao contador
    tipo: { type: String, enum: ['evolution', 'zapi', 'nenhum'], default: 'nenhum' },
    instancia: String,
    token_cifrado: { type: String, select: false },
  },
  webhook: { url: String, segredo_cifrado: { type: String, select: false } },  // opcional: CRM do escritório
  status: { type: String, enum: ['ATIVO', 'SUSPENSO'], default: 'ATIVO', index: true },
}, { timestamps: true, collection: 'contadores' });

// unique: true já cria índice em crc, email e slug_link.
export const Contador = mongoose.models.Contador || mongoose.model('Contador', ContadorSchema);
