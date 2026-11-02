// Fluxo do cliente (link do contador). O cliente nunca vê valores na tela:
// recebe a confirmação de "indício" e o relatório chega pelo contador.
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import crypto from 'node:crypto';
import { Contador, Lead, RelatorioAuditoria } from '../models/index.js';
import { config } from '../config.js';
import { encrypt, sha256 } from '../services/crypto.js';
import { salvar } from '../services/storage.js';
import { enfileirarProcessamento } from '../queues/index.js';
import { VERSAO_MOTOR } from '../engine/teto.js';
import { HttpError, wrap } from '../middleware/auth.js';

export const publico = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype === 'application/pdf'),
});

const telefone = z.string().transform((s) => s.replace(/\D/g, '')).refine((s) => /^55\d{10,11}$/.test(s) || /^\d{10,11}$/.test(s), 'WhatsApp inválido')
  .transform((s) => (s.startsWith('55') ? s : `55${s}`));
const hashToken = (t) => sha256(Buffer.from(String(t)));

// O X-Lead-Token é aleatório e só o hash fica no banco (token_seguranca).
async function leadDoToken(req, extra = '') {
  const token = req.headers['x-lead-token'];
  if (!token) throw new HttpError(401, 'TOKEN_LEAD_INVALIDO');
  const lead = await Lead.findOne({ _id: req.params.id, token_seguranca: hashToken(token) }).select(extra);
  if (!lead) throw new HttpError(401, 'TOKEN_LEAD_INVALIDO');
  return lead;
}

publico.get('/i/:slug', wrap(async (req, res) => {
  const c = await Contador.findOne({ slug_link: req.params.slug.toLowerCase(), status: 'ATIVO' }).lean();
  if (!c) throw new HttpError(404, 'CONVITE_INVALIDO');
  res.json({ escritorio: c.nome_escritorio, responsavel: c.nome_responsavel, crc: c.crc, termoVersao: config.termoVersao });
}));

// 1) Qualificação. Idempotente: o mesmo WhatsApp no mesmo contador reaproveita o lead em aberto
// (e recebe um token novo, já que o anterior não fica salvo em texto puro).
publico.post('/i/:slug/leads', wrap(async (req, res) => {
  const body = z.object({ nome: z.string().min(3).max(120), profissao: z.string().min(2).max(80), whatsapp: telefone }).parse(req.body);
  const c = await Contador.findOne({ slug_link: req.params.slug.toLowerCase(), status: 'ATIVO' });
  if (!c) throw new HttpError(404, 'CONVITE_INVALIDO');
  const token = crypto.randomBytes(24).toString('base64url');
  const lead = await Lead.findOneAndUpdate(
    { contador_id: c._id, whatsapp: body.whatsapp, status_jornada: { $in: ['CADASTRO', 'CONSENTIDO', 'UPLOAD_CONCLUIDO', 'REVISAO_MANUAL'] } },
    { $set: { nome: body.nome, profissao: body.profissao, token_seguranca: hashToken(token) }, $setOnInsert: { contador_id: c._id, whatsapp: body.whatsapp } },
    { upsert: true, new: true },
  );
  res.status(201).json({ leadId: lead._id, leadToken: token, status: lead.status_jornada });
}));

// 2) Consentimento LGPD: data/hora, IP, user agent e versão do termo
publico.post('/leads/:id/consent', wrap(async (req, res) => {
  const { cpf } = z.object({ aceito: z.literal(true), cpf: z.string().regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/).optional() }).parse(req.body);
  const lead = await leadDoToken(req);
  lead.consentimento_lgpd = {
    aceito: true,
    data_hora: new Date(),
    ip_origem: req.ip,
    user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
    versao_termo: config.termoVersao,
  };
  if (cpf) lead.cpf_cifrado = encrypt(cpf.replace(/\D/g, ''));
  if (lead.status_jornada === 'CADASTRO') lead.status_jornada = 'CONSENTIDO';
  await lead.save();
  res.json({ status: lead.status_jornada, consentimento: { versaoTermo: lead.consentimento_lgpd.versao_termo, aceitoEm: lead.consentimento_lgpd.data_hora } });
}));

// 3) Upload. Duplicata (mesmo sha256) é ignorada.
publico.post('/leads/:id/documents', upload.array('arquivos', 6), wrap(async (req, res) => {
  const lead = await leadDoToken(req);
  if (!lead.consentimento_lgpd?.aceito) throw new HttpError(409, 'CONSENTIMENTO_PENDENTE');
  const tipos = [].concat(req.body.tipos || []);
  if (!req.files?.length) throw new HttpError(400, 'ARQUIVO_PDF_OBRIGATORIO');
  const apagar_em = new Date(Date.now() + config.retencaoDias * 86400000);
  let novos = 0;
  for (const [i, f] of req.files.entries()) {
    const hash = sha256(f.buffer);
    if (lead.documentos.some((d) => d.sha256_hash === hash)) continue;
    const tipo = ['CNIS', 'INFORME', 'IRPF', 'HOLERITE'].includes(tipos[i]) ? tipos[i] : 'INFORME';
    const key = await salvar(`${lead._id}/${hash}.pdf.enc`, f.buffer);
    lead.documentos.push({ tipo, nome_arquivo: f.originalname.slice(0, 120), s3_key: key, sha256_hash: hash, bytes: f.size, apagar_em });
    novos += 1;
  }
  lead.status_jornada = 'UPLOAD_CONCLUIDO';
  await lead.save();
  res.status(201).json({ recebidos: novos, documentos: lead.documentos.map((d) => ({ id: d._id, tipo: d.tipo, status: d.status })) });
}));

// 4) Processamento (idempotente pelo hash dos documentos + versão do motor)
publico.post('/leads/:id/process', wrap(async (req, res) => {
  const lead = await leadDoToken(req);
  if (!lead.documentos.some((d) => d.tipo === 'CNIS')) throw new HttpError(409, 'CNIS_OBRIGATORIO');
  const chave = sha256(Buffer.from([String(lead._id), ...lead.documentos.map((d) => d.sha256_hash).sort(), VERSAO_MOTOR].join('|')));
  lead.status_jornada = 'EM_PROCESSAMENTO';
  await lead.save();
  await enfileirarProcessamento(lead._id, chave);
  res.status(202).json({ status: lead.status_jornada });
}));

// 5) Status para a tela de processamento. Sem valores, só o indício.
//    O front recebe os nomes antigos (CONCLUIDO/ERRO) para não precisar mudar.
const STATUS_FRONT = { PROCESSADO: 'CONCLUIDO', REVISAO_MANUAL: 'ERRO', EM_PROCESSAMENTO: 'PROCESSANDO' };
publico.get('/leads/:id/status', wrap(async (req, res) => {
  const lead = await leadDoToken(req);
  let indicio = null;
  if (lead.relatorio_id) {
    const r = await RelatorioAuditoria.findById(lead.relatorio_id, { 'resumo_financeiro.total_recuperavel': 1 }).lean();
    indicio = (r?.resumo_financeiro?.total_recuperavel || 0) > 0;
  }
  res.json({ status: STATUS_FRONT[lead.status_jornada] || lead.status_jornada, indicio, documentos: lead.documentos.map((d) => ({ tipo: d.tipo, status: d.status })) });
}));

// 6) Direito do titular: cópia do relatório (LGPD art. 18/19, prazo de 15 dias)
publico.post('/leads/:id/copia-relatorio', wrap(async (req, res) => {
  const lead = await leadDoToken(req);
  const aberto = lead.solicitacoes_titular.find((s) => s.tipo === 'COPIA' && !s.atendida_em);
  if (!aberto) { lead.solicitacoes_titular.push({ tipo: 'COPIA', em: new Date() }); await lead.save(); }
  const prazo = new Date((aberto?.em || new Date()).getTime() + 15 * 86400000);
  res.status(202).json({ registrado: true, prazoAte: prazo.toISOString().slice(0, 10) });
}));
