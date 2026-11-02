// Cliente que entrou pelo link do contador: qualificação, consentimento LGPD e documentos.
import mongoose from 'mongoose';

const { Schema } = mongoose;

export const STATUS_JORNADA = ['CADASTRO', 'CONSENTIDO', 'UPLOAD_CONCLUIDO', 'EM_PROCESSAMENTO', 'PROCESSADO', 'REVISAO_MANUAL', 'CONTRATO_ENVIADO', 'PROTOCOLADO'];

const DocumentoSchema = new Schema({
  tipo: { type: String, enum: ['CNIS', 'INFORME', 'IRPF', 'HOLERITE'], required: true },
  nome_arquivo: String,
  s3_key: { type: String, required: true },
  sha256_hash: { type: String, required: true },                   // dedupe de arquivo repetido
  bytes: Number,
  status: { type: String, enum: ['RECEBIDO', 'EXTRAIDO', 'ERRO'], default: 'RECEBIDO' },
  extraido: Schema.Types.Mixed,                                    // JSON lido do PDF
  erro: String,
  apagar_em: { type: Date, required: true },                       // retenção curta (LGPD)
  apagado_em: Date,
}, { _id: true, timestamps: true });

const LeadSchema = new Schema({
  contador_id: { type: Schema.Types.ObjectId, ref: 'Contador', required: true, index: true },
  nome: { type: String, required: true, trim: true },
  profissao: { type: String, required: true, trim: true },
  whatsapp: { type: String, required: true, index: true },
  cpf_cifrado: { type: String, select: false },                   // opcional, AES-256-GCM
  token_seguranca: { type: String, required: true, unique: true, select: false }, // sha256 do X-Lead-Token
  consentimento_lgpd: {
    aceito: { type: Boolean, required: true, default: false },
    data_hora: Date,
    ip_origem: String,
    user_agent: String,
    versao_termo: { type: String, default: '1.0.0' },
  },
  status_jornada: { type: String, enum: STATUS_JORNADA, default: 'CADASTRO', index: true },
  documentos: [DocumentoSchema],
  relatorio_id: { type: Schema.Types.ObjectId, ref: 'RelatorioAuditoria' },
  solicitacoes_titular: [{ _id: false, tipo: { type: String, enum: ['COPIA', 'CORRECAO', 'EXCLUSAO'] }, em: Date, atendida_em: Date }],
}, { timestamps: true, collection: 'leads' });

// Painel: leads de um contador, mais recentes primeiro. Idempotência: mesmo WhatsApp no mesmo contador.
LeadSchema.index({ contador_id: 1, updatedAt: -1 });
LeadSchema.index({ contador_id: 1, whatsapp: 1 });
LeadSchema.index({ 'documentos.apagar_em': 1 }, { sparse: true });

export const Lead = mongoose.models.Lead || mongoose.model('Lead', LeadSchema);
