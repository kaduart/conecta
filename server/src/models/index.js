import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// ---------- Contadores / Parceiros ----------
const ContadorSchema = new Schema({
  escritorio: { type: String, required: true, trim: true },
  responsavel: { type: String, required: true, trim: true },
  crc: { type: String, required: true, trim: true },        // ex.: "CRC-DF 012345/O-1"
  cnpj: { type: String, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  whatsapp: { type: String, required: true },              // E.164: 5561999999999
  slugLink: { type: String, required: true, unique: true, lowercase: true, match: /^[a-z0-9-]{3,40}$/ },
  chavePixEnc: { type: String },                           // AES-256-GCM (services/crypto.js)
  honorariosPercentual: { type: Number, default: 30, min: 0, max: 30 },
  whatsappProvider: {
    tipo: { type: String, enum: ['evolution', 'zapi', 'nenhum'], default: 'nenhum' },
    instancia: String,                                     // Evolution: nome da instância | Z-API: instance id
    tokenEnc: String,                                      // credencial cifrada
  },
  webhook: {                                               // opcional: CRM do escritório
    url: String,
    segredoEnc: String,                                    // assina o corpo com HMAC-SHA256
  },
  apiKeyHash: { type: String, required: true },            // login do painel (hash sha256 da chave)
  ativo: { type: Boolean, default: true },
}, { timestamps: true });

// ---------- Clientes / Leads ----------
const DocumentoSchema = new Schema({
  tipo: { type: String, enum: ['CNIS', 'INFORME', 'IRPF', 'HOLERITE'], required: true },
  storageKey: { type: String, required: true },
  sha256: { type: String, required: true },
  bytes: Number,
  extraido: { type: Schema.Types.Mixed },                  // JSON extraído do PDF
  status: { type: String, enum: ['RECEBIDO', 'EXTRAIDO', 'ERRO'], default: 'RECEBIDO' },
  erro: String,
  apagarEm: { type: Date, required: true },                // retenção curta (LGPD): 30 dias
}, { _id: true, timestamps: true });

const LeadSchema = new Schema({
  contadorId: { type: Schema.Types.ObjectId, ref: 'Contador', required: true, index: true },
  nome: { type: String, required: true, trim: true },
  profissao: { type: String, required: true },
  whatsapp: { type: String, required: true },
  cpfEnc: String,                                          // opcional, cifrado
  consentimento: {
    aceito: { type: Boolean, default: false },
    versaoTermo: String,
    aceitoEm: Date,
    ip: String,
    userAgent: String,
  },
  status: {
    type: String,
    enum: ['QUALIFICADO', 'CONSENTIU', 'DOCUMENTOS', 'PROCESSANDO', 'CONCLUIDO', 'ERRO', 'CONTRATO_ENVIADO', 'PROTOCOLADO'],
    default: 'QUALIFICADO',
    index: true,
  },
  documentos: [DocumentoSchema],
  relatorioId: { type: Schema.Types.ObjectId, ref: 'Relatorio' },
  solicitacoesTitular: [{ tipo: { type: String, enum: ['COPIA', 'CORRECAO', 'EXCLUSAO'] }, em: Date, atendidaEm: Date }],
}, { timestamps: true });

// ---------- Relatórios de Auditoria ----------
const VinculoMesSchema = new Schema({
  cnpj: String, nome: String, tipo: String, remuneracao: Number, inss: Number, origem: String,
}, { _id: false });

const MesSchema = new Schema({
  competencia: { type: String, required: true },           // "2024-05" | "2024-13" (13º)
  teto: Number,
  cotaMaxima: Number,
  metodo: { type: String, enum: ['TABELA', 'COTA_MAXIMA'] },
  pago: Number,
  devido: Number,
  excesso: Number,
  prescrito: Boolean,
  vencimentoPrescricao: String,
  qtdVinculos: Number,
  confianca: { type: String, enum: ['COMPROVADO', 'ESTIMADO'] },
  parametroConfirmado: Boolean,
  vinculos: [VinculoMesSchema],
}, { _id: false });

const RelatorioSchema = new Schema({
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
  contadorId: { type: Schema.Types.ObjectId, ref: 'Contador', required: true, index: true },
  idempotencyKey: { type: String, required: true, unique: true }, // hash(docs + dataBase + versaoMotor)
  versaoMotor: String,
  dataBase: String,
  recuperavelOnline: Number,
  prejuizoPrescrito: Number,
  confianca: String,
  consolidadoAnual: [{ _id: false, ano: String, pago: Number, devido: Number, excessoRecuperavel: Number, excessoPrescrito: Number, meses: Number }],
  meses: [MesSchema],
  gatilhos: Schema.Types.Mixed,
  alertas: [{ _id: false, tipo: String, mensagem: String }],
  notificadoEm: Date,                                      // idempotência do WhatsApp
}, { timestamps: true });

RelatorioSchema.index({ contadorId: 1, recuperavelOnline: -1 });

export const Contador = model('Contador', ContadorSchema);
export const Lead = model('Lead', LeadSchema);
export const Relatorio = model('Relatorio', RelatorioSchema);
