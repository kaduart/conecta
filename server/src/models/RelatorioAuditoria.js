// Resultado da auditoria de um lead: resumo, gatilhos e o mês a mês (base do painel e do PER/DCOMP).
import mongoose from 'mongoose';

const { Schema } = mongoose;

const FonteSchema = new Schema({
  cnpj: String, nome: String, tipo: { type: String, enum: ['EMPREGADO', 'CI'] }, remuneracao: Number, inss: Number, origem: String,
}, { _id: false });

const MesSchema = new Schema({
  competencia: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-3])$/ }, // '2024-05' | '2024-13' (13º)
  fontes_detectadas: [String],
  total_contribuido_pago: { type: Number, required: true },
  devido: Number,
  teto_legal_epoca: { type: Number, required: true },               // salário de contribuição máximo
  cota_maxima: Number,                                              // contribuição máxima do empregado
  parametro_confirmado: Boolean,
  excesso_calculado: { type: Number, required: true },
  status_prazo: { type: String, enum: ['DISPONIVEL', 'PRESCRITO'], required: true },
  vencimento_prescricao: String,
  confianca: { type: String, enum: ['COMPROVADO', 'ESTIMADO'] },
  fontes: [FonteSchema],
}, { _id: false });

const RelatorioSchema = new Schema({
  lead_id: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, unique: true },
  contador_id: { type: Schema.Types.ObjectId, ref: 'Contador', required: true, index: true },
  idempotency_key: { type: String, required: true, index: true },   // hash(documentos + versão do motor)
  versao_motor: String,
  data_base: String,
  resumo_financeiro: {
    total_recuperavel: { type: Number, required: true },
    total_prescrito_perdido: { type: Number, required: true },
    honorarios_estimados: Number,
    grau_confianca: { type: String, enum: ['ALTO', 'MEDIO', 'BAIXO'], default: 'ALTO' },
  },
  extracao: { score: Number, motivos: [String] },
  gatilhos_detectados: {
    multiplos_vinculos: { type: Boolean, default: false },
    mes_inicio_bitributacao: String,
    vinculo_ativo_com_excesso: { type: Boolean, default: false },  // ainda desconta acima do teto hoje
    proxima_competencia_a_vencer: String,
    valor_a_vencer: Number,
    dias_para_prescrever: Number,
    perda_media_mensal: Number,
    meses_com_excesso: Number,
  },
  alertas: [{ _id: false, tipo: String, mensagem: String }],
  consolidado_anual: [{ _id: false, ano: String, pago: Number, devido: Number, excesso_recuperavel: Number, excesso_prescrito: Number, meses: Number }],
  cronograma_mensal: [MesSchema],
  arquivos_origem: [{ _id: false, nome_arquivo: String, s3_key: String, sha256_hash: String }],
  notificado_em: Date,                                              // idempotência do WhatsApp
}, { timestamps: true, collection: 'relatorios_auditoria' });

// Painel: ordenar por valor recuperável dentro do contador.
RelatorioSchema.index({ contador_id: 1, 'resumo_financeiro.total_recuperavel': -1 });

export const RelatorioAuditoria = mongoose.models.RelatorioAuditoria || mongoose.model('RelatorioAuditoria', RelatorioSchema);
