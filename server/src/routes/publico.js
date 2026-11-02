// Fluxo do cliente (link do contador). O cliente nunca vê valores na tela:
// recebe a confirmação de "indício" e o relatório chega pelo contador (ver memória LGPD/CDC).
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import crypto from 'node:crypto';
import { Contador, Lead, Relatorio } from '../models/index.js';
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

async function leadDoToken(req) {
  // O id do lead viaja junto com um token de sessão (HMAC) para evitar enumeração de ids.
  const { id } = req.params;
  const token = req.headers['x-lead-token'];
  const esperado = crypto.createHmac('sha256', config.jwtSecret).update(String(id)).digest('hex');
  if (!token || token.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(esperado))) throw new HttpError(401, 'TOKEN_LEAD_INVALIDO');
  const lead = await Lead.findById(id);
  if (!lead) throw new HttpError(404, 'LEAD_NAO_ENCONTRADO');
  return lead;
}
const tokenDoLead = (id) => crypto.createHmac('sha256', config.jwtSecret).update(String(id)).digest('hex');

// Dados públicos do convite (escritório que convida)
publico.get('/i/:slug', wrap(async (req, res) => {
  const c = await Contador.findOne({ slugLink: req.params.slug.toLowerCase(), ativo: true }).lean();
  if (!c) throw new HttpError(404, 'CONVITE_INVALIDO');
  res.json({ escritorio: c.escritorio, responsavel: c.responsavel, crc: c.crc, termoVersao: config.termoVersao });
}));

// 1) Qualificação: nome, profissão, WhatsApp
publico.post('/i/:slug/leads', wrap(async (req, res) => {
  const body = z.object({ nome: z.string().min(3).max(120), profissao: z.string().min(2).max(80), whatsapp: telefone }).parse(req.body);
  const c = await Contador.findOne({ slugLink: req.params.slug.toLowerCase(), ativo: true });
  if (!c) throw new HttpError(404, 'CONVITE_INVALIDO');
  // Idempotente: o mesmo WhatsApp no mesmo contador reaproveita o lead em aberto.
  const lead = await Lead.findOneAndUpdate(
    { contadorId: c._id, whatsapp: body.whatsapp, status: { $in: ['QUALIFICADO', 'CONSENTIU', 'DOCUMENTOS', 'ERRO'] } },
    { $set: { nome: body.nome, profissao: body.profissao }, $setOnInsert: { contadorId: c._id, whatsapp: body.whatsapp } },
    { upsert: true, new: true },
  );
  res.status(201).json({ leadId: lead._id, leadToken: tokenDoLead(lead._id), status: lead.status });
}));

// 2) Consentimento LGPD (data/hora, IP, user agent, versão do termo)
publico.post('/leads/:id/consent', wrap(async (req, res) => {
  const { aceito, cpf } = z.object({ aceito: z.literal(true), cpf: z.string().regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/).optional() }).parse(req.body);
  const lead = await leadDoToken(req);
  lead.consentimento = {
    aceito,
    versaoTermo: config.termoVersao,
    aceitoEm: new Date(),
    ip: req.ip,
    userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
  };
  if (cpf) lead.cpfEnc = encrypt(cpf.replace(/\D/g, ''));
  if (lead.status === 'QUALIFICADO') lead.status = 'CONSENTIU';
  await lead.save();
  res.json({ status: lead.status, consentimento: { versaoTermo: lead.consentimento.versaoTermo, aceitoEm: lead.consentimento.aceitoEm } });
}));

// 3) Upload dos PDFs (CNIS obrigatório, informes opcionais). Duplicata (mesmo sha256) é ignorada.
publico.post('/leads/:id/documents', upload.array('arquivos', 6), wrap(async (req, res) => {
  const lead = await leadDoToken(req);
  if (!lead.consentimento?.aceito) throw new HttpError(409, 'CONSENTIMENTO_PENDENTE');
  const tipos = [].concat(req.body.tipos || []);
  if (!req.files?.length) throw new HttpError(400, 'ARQUIVO_PDF_OBRIGATORIO');
  const apagarEm = new Date(Date.now() + config.retencaoDias * 86400000);
  let novos = 0;
  for (const [i, f] of req.files.entries()) {
    const hash = sha256(f.buffer);
    if (lead.documentos.some((d) => d.sha256 === hash)) continue;
    const tipo = ['CNIS', 'INFORME', 'IRPF', 'HOLERITE'].includes(tipos[i]) ? tipos[i] : 'INFORME';
    const key = await salvar(`${lead._id}/${hash}.pdf.enc`, f.buffer);
    lead.documentos.push({ tipo, storageKey: key, sha256: hash, bytes: f.size, apagarEm });
    novos += 1;
  }
  lead.status = 'DOCUMENTOS';
  await lead.save();
  res.status(201).json({ recebidos: novos, documentos: lead.documentos.map((d) => ({ id: d._id, tipo: d.tipo, status: d.status })) });
}));

// 4) Dispara o processamento (idempotente pelo hash dos documentos + versão do motor)
publico.post('/leads/:id/process', wrap(async (req, res) => {
  const lead = await leadDoToken(req);
  if (!lead.documentos.some((d) => d.tipo === 'CNIS')) throw new HttpError(409, 'CNIS_OBRIGATORIO');
  const chave = sha256(Buffer.from([String(lead._id), ...lead.documentos.map((d) => d.sha256).sort(), VERSAO_MOTOR].join('|')));
  lead.status = 'PROCESSANDO';
  await lead.save();
  await enfileirarProcessamento(lead._id, chave);
  res.status(202).json({ status: 'PROCESSANDO' });
}));

// 5) Status para a tela de processamento. Sem valores (só o indício).
publico.get('/leads/:id/status', wrap(async (req, res) => {
  const lead = await leadDoToken(req);
  let indicio = null;
  if (lead.relatorioId) {
    const r = await Relatorio.findById(lead.relatorioId, { recuperavelOnline: 1 }).lean();
    indicio = (r?.recuperavelOnline || 0) > 0;
  }
  res.json({ status: lead.status, indicio, documentos: lead.documentos.map((d) => ({ tipo: d.tipo, status: d.status })) });
}));

// 6) Direito do titular: pedido de cópia do relatório (LGPD art. 18/19, prazo de 15 dias)
publico.post('/leads/:id/copia-relatorio', wrap(async (req, res) => {
  const lead = await leadDoToken(req);
  const aberto = lead.solicitacoesTitular.find((s) => s.tipo === 'COPIA' && !s.atendidaEm);
  if (!aberto) { lead.solicitacoesTitular.push({ tipo: 'COPIA', em: new Date() }); await lead.save(); }
  const prazo = new Date((aberto?.em || new Date()).getTime() + 15 * 86400000);
  res.status(202).json({ registrado: true, prazoAte: prazo.toISOString().slice(0, 10) });
}));
