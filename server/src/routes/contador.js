// Painel do contador (JWT). Aqui aparecem os valores, o contrato e a planilha do PER/DCOMP.
import { Router } from 'express';
import { z } from 'zod';
import { Contador, Lead, RelatorioAuditoria } from '../models/index.js';
import { config } from '../config.js';
import { conferirSenha, hashSenha } from '../services/senha.js';
import { gerarContrato } from '../services/contrato.js';
import { perdcompCsv } from '../services/perdcomp.js';
import { roteiroCliente, alertaComercial } from '../services/notificacao.js';
import { relatorioParaApi } from '../engine/mapear.js';
import { assinarToken, exigirContador, HttpError, wrap } from '../middleware/auth.js';

export const contador = Router();

// Nomes que o front já usa (o banco usa os do briefing)
const STATUS_FRONT = { CADASTRO: 'QUALIFICADO', CONSENTIDO: 'CONSENTIU', UPLOAD_CONCLUIDO: 'DOCUMENTOS', EM_PROCESSAMENTO: 'PROCESSANDO', PROCESSADO: 'CONCLUIDO', REVISAO_MANUAL: 'ERRO' };
const statusFront = (s) => STATUS_FRONT[s] || s;

contador.post('/login', wrap(async (req, res) => {
  const body = z.object({ email: z.string().email(), senha: z.string().min(1).optional(), apiKey: z.string().optional() }).parse(req.body);
  const senha = body.senha ?? body.apiKey; // o front antigo manda "apiKey"
  const c = await Contador.findOne({ email: body.email.toLowerCase(), status: 'ATIVO' }).select('+password_hash');
  if (!c || !(await conferirSenha(senha, c.password_hash))) throw new HttpError(401, 'CREDENCIAIS_INVALIDAS');
  res.json({ token: assinarToken(c), escritorio: c.nome_escritorio, slugLink: c.slug_link });
}));

// Primeiro acesso: cria o PRIMEIRO contador pela tela, sem script nem variável.
// Só funciona enquanto o banco não tem nenhum contador; depois disso responde 403.
export function gerarSlug(txt) {
  return String(txt).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
}

contador.get('/primeiro-acesso', wrap(async (_req, res) => {
  res.json({ disponivel: (await Contador.estimatedDocumentCount()) === 0 });
}));

contador.post('/primeiro-acesso', wrap(async (req, res) => {
  const b = z.object({
    nome_escritorio: z.string().min(2).max(120),
    nome_responsavel: z.string().min(2).max(120),
    crc: z.string().min(4).max(40),
    email: z.string().email(),
    whatsapp: z.string().transform((s) => s.replace(/\D/g, '')).transform((s) => (s.startsWith('55') ? s : `55${s}`)).refine((s) => /^55\d{10,11}$/.test(s), 'WhatsApp inválido'),
    slug_link: z.string().optional().default(''),
    senha: z.string().min(10).max(200),
  }).parse(req.body);
  // Link vazio: gera a partir do nome do escritório ("Kadu Art Systems" -> "kadu-art-systems").
  b.slug_link = gerarSlug(b.slug_link || b.nome_escritorio);
  if (!/^[a-z0-9-]{3,40}$/.test(b.slug_link)) throw new HttpError(422, 'VALIDACAO', { campos: { slug_link: ['Use de 3 a 40 letras, números ou hífen'] } });
  if ((await Contador.countDocuments()) > 0) throw new HttpError(403, 'PRIMEIRO_ACESSO_ENCERRADO');
  const { senha, ...dados } = b;
  const c = await Contador.create({ ...dados, password_hash: await hashSenha(senha) });
  res.status(201).json({ token: assinarToken(c), escritorio: c.nome_escritorio, slugLink: c.slug_link });
}));

contador.use(exigirContador);

// Troca de senha do próprio contador (exige a senha atual).
contador.patch('/senha', wrap(async (req, res) => {
  const b = z.object({ senha_atual: z.string().min(1), senha_nova: z.string().min(10).max(200) }).parse(req.body);
  const c = await Contador.findById(req.contadorId).select('+password_hash');
  if (!c || !(await conferirSenha(b.senha_atual, c.password_hash))) throw new HttpError(403, 'SENHA_ATUAL_INCORRETA') // 403, não 401: o front desloga em 401;
  c.password_hash = await hashSenha(b.senha_nova);
  await c.save();
  res.json({ ok: true });
}));

// Troca o final do link de convite (/c/:slug). O link antigo deixa de funcionar.
const SLUGS_RESERVADOS = new Set(['demo', 'painel', 'api', 'admin', 'www']);
contador.patch('/link', wrap(async (req, res) => {
  const { slug } = z.object({ slug: z.string().min(1).max(80) }).parse(req.body);
  const novo = gerarSlug(slug);
  if (!/^[a-z0-9-]{3,40}$/.test(novo) || SLUGS_RESERVADOS.has(novo)) {
    throw new HttpError(422, 'VALIDACAO', { campos: { slug: ['Use de 3 a 40 letras, números ou hífen'] } });
  }
  const dono = await Contador.findOne({ slug_link: novo }, { _id: 1 }).lean();
  if (dono && String(dono._id) !== String(req.contadorId)) throw new HttpError(409, 'LINK_EM_USO');
  await Contador.updateOne({ _id: req.contadorId }, { $set: { slug_link: novo } });
  res.json({ slugLink: novo });
}));

async function carregar(req, extraLead = '') {
  const lead = await Lead.findOne({ _id: req.params.id, contador_id: req.contadorId }).select(extraLead);
  if (!lead) throw new HttpError(404, 'LEAD_NAO_ENCONTRADO');
  const doc = lead.relatorio_id ? await RelatorioAuditoria.findById(lead.relatorio_id).lean() : null;
  const c = await Contador.findById(req.contadorId);
  return { lead, relatorio: relatorioParaApi(doc), contador: c };
}

contador.get('/analises', wrap(async (req, res) => {
  const leads = await Lead.find({ contador_id: req.contadorId }, { documentos: 0 }).sort({ updatedAt: -1 }).limit(500).lean();
  const rels = await RelatorioAuditoria.find({ lead_id: { $in: leads.map((l) => l._id) } }, { cronograma_mensal: 0 }).lean();
  const porLead = new Map(rels.map((r) => [String(r.lead_id), r]));
  const itens = leads.map((l) => {
    const r = porLead.get(String(l._id));
    const g = r?.gatilhos_detectados;
    return {
      id: l._id, nome: l.nome, profissao: l.profissao, whatsapp: l.whatsapp, status: statusFront(l.status_jornada), atualizadoEm: l.updatedAt,
      recuperavelOnline: r?.resumo_financeiro.total_recuperavel ?? null,
      prejuizoPrescrito: r?.resumo_financeiro.total_prescrito_perdido ?? null,
      confianca: r ? (r.resumo_financeiro.grau_confianca === 'ALTO' ? 'COMPROVADO' : 'ESTIMADO') : null,
      grauConfianca: r?.resumo_financeiro.grau_confianca ?? null,
      diasParaPrescrever: g?.dias_para_prescrever ?? null,
      valorAVencer: g?.valor_a_vencer ?? null,
      prioridade: r ? alertaComercial({ gatilhos: { diasParaPrescrever: g.dias_para_prescrever }, alertas: [] }).prioridade : null,
      copiaPendente: (l.solicitacoes_titular || []).some((s) => s.tipo === 'COPIA' && !s.atendida_em),
    };
  }).sort((a, b) => (b.recuperavelOnline ?? -1) - (a.recuperavelOnline ?? -1));
  const totais = itens.reduce((t, i) => ({ recuperavel: t.recuperavel + (i.recuperavelOnline || 0), leads: t.leads + 1 }), { recuperavel: 0, leads: 0 });
  res.json({ totais, itens });
}));

contador.get('/analises/:id', wrap(async (req, res) => {
  const { lead, relatorio, contador: c } = await carregar(req);
  res.json({
    lead: {
      id: lead._id, nome: lead.nome, profissao: lead.profissao, whatsapp: lead.whatsapp, status: statusFront(lead.status_jornada),
      consentimento: { aceito: lead.consentimento_lgpd?.aceito, aceitoEm: lead.consentimento_lgpd?.data_hora, ip: lead.consentimento_lgpd?.ip_origem, versaoTermo: lead.consentimento_lgpd?.versao_termo },
      documentos: lead.documentos.map((d) => ({ tipo: d.tipo, status: d.status, erro: d.erro })),
    },
    relatorio,
    alertaComercial: relatorio ? alertaComercial(relatorio) : null,
    roteiro: relatorio ? roteiroCliente({ lead, relatorio, contador: c }) : null,
  });
}));

contador.get('/analises/:id/contrato', wrap(async (req, res) => {
  const { lead, relatorio, contador: c } = await carregar(req, '+cpf_cifrado');
  if (!relatorio) throw new HttpError(409, 'RELATORIO_PENDENTE');
  const md = gerarContrato({ lead, contador: c, relatorio, cidade: req.query.cidade, retencaoDias: config.retencaoDias });
  if (lead.status_jornada === 'PROCESSADO') { lead.status_jornada = 'CONTRATO_ENVIADO'; await lead.save(); }
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
  lead.status_jornada = status;
  await lead.save();
  res.json({ status });
}));

contador.post('/analises/:id/copia-entregue', wrap(async (req, res) => {
  const { lead } = await carregar(req);
  for (const s of lead.solicitacoes_titular) if (s.tipo === 'COPIA' && !s.atendida_em) s.atendida_em = new Date();
  await lead.save();
  res.json({ ok: true });
}));
