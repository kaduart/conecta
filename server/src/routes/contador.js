// Painel do contador (JWT). Aqui aparecem os valores, o contrato e a planilha do PER/DCOMP.
import { Router } from 'express';
import { z } from 'zod';
import { Contador, Lead, Relatorio } from '../models/index.js';
import { config } from '../config.js';
import { sha256 } from '../services/crypto.js';
import { gerarContrato } from '../services/contrato.js';
import { perdcompCsv } from '../services/perdcomp.js';
import { roteiroCliente, alertaComercial } from '../services/notificacao.js';
import { assinarToken, exigirContador, HttpError, wrap } from '../middleware/auth.js';

export const contador = Router();

contador.post('/login', wrap(async (req, res) => {
  const { email, apiKey } = z.object({ email: z.string().email(), apiKey: z.string().min(20) }).parse(req.body);
  const c = await Contador.findOne({ email: email.toLowerCase(), ativo: true });
  if (!c || c.apiKeyHash !== sha256(Buffer.from(apiKey))) throw new HttpError(401, 'CREDENCIAIS_INVALIDAS');
  res.json({ token: assinarToken(c), escritorio: c.escritorio, slugLink: c.slugLink });
}));

contador.use(exigirContador);

async function carregar(req) {
  const lead = await Lead.findOne({ _id: req.params.id, contadorId: req.contadorId });
  if (!lead) throw new HttpError(404, 'LEAD_NAO_ENCONTRADO');
  const relatorio = lead.relatorioId ? await Relatorio.findById(lead.relatorioId).lean() : null;
  const c = await Contador.findById(req.contadorId);
  return { lead, relatorio, contador: c };
}

// Lista: lead | profissão | recuperável | prescrito | prioridade | status. Ordena por recuperável.
contador.get('/analises', wrap(async (req, res) => {
  const leads = await Lead.find({ contadorId: req.contadorId }, { cpfEnc: 0, documentos: 0 }).sort({ updatedAt: -1 }).limit(500).lean();
  const rels = await Relatorio.find({ leadId: { $in: leads.map((l) => l._id) } }).lean();
  const porLead = new Map(rels.map((r) => [String(r.leadId), r]));
  const itens = leads.map((l) => {
    const r = porLead.get(String(l._id));
    return {
      id: l._id, nome: l.nome, profissao: l.profissao, whatsapp: l.whatsapp, status: l.status, atualizadoEm: l.updatedAt,
      recuperavelOnline: r?.recuperavelOnline ?? null,
      prejuizoPrescrito: r?.prejuizoPrescrito ?? null,
      confianca: r?.confianca ?? null,
      diasParaPrescrever: r?.gatilhos?.diasParaPrescrever ?? null,
      prioridade: r ? alertaComercial(r).prioridade : null,
      copiaPendente: (l.solicitacoesTitular || []).some((s) => s.tipo === 'COPIA' && !s.atendidaEm),
    };
  }).sort((a, b) => (b.recuperavelOnline ?? -1) - (a.recuperavelOnline ?? -1));
  const totais = itens.reduce((t, i) => ({ recuperavel: t.recuperavel + (i.recuperavelOnline || 0), leads: t.leads + 1 }), { recuperavel: 0, leads: 0 });
  res.json({ totais, itens });
}));

contador.get('/analises/:id', wrap(async (req, res) => {
  const { lead, relatorio, contador: c } = await carregar(req);
  res.json({
    lead: { id: lead._id, nome: lead.nome, profissao: lead.profissao, whatsapp: lead.whatsapp, status: lead.status, consentimento: lead.consentimento, documentos: lead.documentos.map((d) => ({ tipo: d.tipo, status: d.status, erro: d.erro })) },
    relatorio,
    alertaComercial: relatorio ? alertaComercial(relatorio) : null,
    roteiro: relatorio ? roteiroCliente({ lead, relatorio, contador: c }) : null,
  });
}));

contador.get('/analises/:id/contrato', wrap(async (req, res) => {
  const { lead, relatorio, contador: c } = await carregar(req);
  if (!relatorio) throw new HttpError(409, 'RELATORIO_PENDENTE');
  const md = gerarContrato({ lead, contador: c, relatorio, cidade: req.query.cidade, retencaoDias: config.retencaoDias });
  if (lead.status === 'CONCLUIDO') { lead.status = 'CONTRATO_ENVIADO'; await lead.save(); }
  res.type('text/markdown; charset=utf-8').send(md);
}));

contador.get('/analises/:id/perdcomp.csv', wrap(async (req, res) => {
  const { relatorio } = await carregar(req);
  if (!relatorio) throw new HttpError(409, 'RELATORIO_PENDENTE');
  res.attachment(`perdcomp-${req.params.id}.csv`).type('text/csv; charset=utf-8').send(perdcompCsv(relatorio));
}));

contador.patch('/analises/:id/status', wrap(async (req, res) => {
  const { status } = z.object({ status: z.enum(['CONTRATO_ENVIADO', 'PROTOCOLADO']) }).parse(req.body);
  const { lead } = await carregar(req);
  lead.status = status;
  await lead.save();
  res.json({ status });
}));

// Marca a cópia ao titular como entregue (LGPD)
contador.post('/analises/:id/copia-entregue', wrap(async (req, res) => {
  const { lead } = await carregar(req);
  for (const s of lead.solicitacoesTitular) if (s.tipo === 'COPIA' && !s.atendidaEm) s.atendidaEm = new Date();
  await lead.save();
  res.json({ ok: true });
}));
