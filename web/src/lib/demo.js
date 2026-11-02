// Modo demonstração: simula a API no navegador (localStorage) para validar o fluxo
// sem banco. É ativado quando VITE_API_URL não está definido. Os valores do relatório
// vêm do motor real (server/src/engine), rodado sobre um caso de exemplo.
import relatorioBase from './demo-relatorio.json';
import { alertaComercial, roteiroCliente } from './notificacao.js';

const CHAVE = 'recupera:demo';
const CONTADOR = { _id: 'demo', escritorio: 'Escritório Demonstração', responsavel: 'Contador Demo', crc: 'CRC-XX 000000/O-0', email: 'demo@recupera.app', slugLink: 'demo' };
export const CREDENCIAIS_DEMO = { email: 'demo@recupera.app', apiKey: 'demo-recupera-2026' };

const espera = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const ler = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || { leads: [] }; } catch { return { leads: [] }; } };
const gravar = (db) => { try { localStorage.setItem(CHAVE, JSON.stringify(db)); } catch { /* modo privado */ } };
const erro = (codigo, msg) => Object.assign(new Error(msg), { codigo });
const id = () => Math.random().toString(36).slice(2, 10);

function lead(leadId) {
  const db = ler();
  const l = db.leads.find((x) => x.id === leadId);
  if (!l) throw erro('LEAD_NAO_ENCONTRADO', 'Sessão expirada. Comece de novo pelo link do convite.');
  return { db, l };
}
function atualizar(leadId, patch) {
  const { db, l } = lead(leadId);
  Object.assign(l, patch, { atualizadoEm: new Date().toISOString() });
  gravar(db);
  return l;
}
// Cada lead ganha o relatório de exemplo, escalado para não ficarem todos iguais.
function relatorioDe(l) {
  const f = l.fator || 1;
  const r = structuredClone(relatorioBase);
  const k = (v) => Math.round(v * f * 100) / 100;
  r.recuperavelOnline = k(r.recuperavelOnline);
  r.prejuizoPrescrito = k(r.prejuizoPrescrito);
  r.consolidadoAnual = r.consolidadoAnual.map((a) => ({ ...a, pago: k(a.pago), devido: k(a.devido), excessoRecuperavel: k(a.excessoRecuperavel), excessoPrescrito: k(a.excessoPrescrito) }));
  r.meses = r.meses.map((m) => ({ ...m, pago: k(m.pago), devido: k(m.devido), excesso: k(m.excesso) }));
  r.gatilhos = { ...r.gatilhos, valorAVencer: k(r.gatilhos.valorAVencer), perdaMediaMensalSemProtocolo: k(r.gatilhos.perdaMediaMensalSemProtocolo) };
  return r;
}

export const demoApi = {
  async convite() { await espera(); return { escritorio: CONTADOR.escritorio, responsavel: CONTADOR.responsavel, crc: CONTADOR.crc, termoVersao: 'demo' }; },
  async criarLead(_slug, { nome, profissao, whatsapp }) {
    await espera();
    const db = ler();
    const l = { id: id(), nome, profissao, whatsapp: whatsapp.replace(/\D/g, ''), status: 'QUALIFICADO', fator: 0.6 + Math.random() * 0.9, solicitacoes: [], atualizadoEm: new Date().toISOString() };
    db.leads.unshift(l); gravar(db);
    return { leadId: l.id, leadToken: 'demo', status: l.status };
  },
  async consentir(leadId) {
    await espera();
    const l = atualizar(leadId, { status: 'CONSENTIU', consentimento: { aceito: true, aceitoEm: new Date().toISOString(), ip: 'demo', versaoTermo: 'demo' } });
    return { status: l.status, consentimento: l.consentimento };
  },
  async enviarDocs(leadId, form) {
    await espera(600);
    const tipos = form.getAll('tipos');
    atualizar(leadId, { status: 'DOCUMENTOS', documentos: tipos.map((tipo) => ({ tipo, status: 'EXTRAIDO' })) });
    return { recebidos: tipos.length };
  },
  async processar(leadId) {
    await espera();
    atualizar(leadId, { status: 'PROCESSANDO', concluiEm: Date.now() + 6000 });
    return { status: 'PROCESSANDO' };
  },
  async status(leadId) {
    await espera(200);
    let { l } = lead(leadId);
    if (l.status === 'PROCESSANDO' && Date.now() >= l.concluiEm) l = atualizar(leadId, { status: 'CONCLUIDO' });
    return { status: l.status, indicio: l.status === 'PROCESSANDO' ? null : true, documentos: l.documentos || [] };
  },
  async pedirCopia(leadId) {
    await espera();
    const { l } = lead(leadId);
    atualizar(leadId, { solicitacoes: [...(l.solicitacoes || []), { tipo: 'COPIA', em: new Date().toISOString() }] });
    return { registrado: true, prazoAte: new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10) };
  },

  async login({ email, apiKey }) {
    await espera();
    if (email.toLowerCase() !== CREDENCIAIS_DEMO.email || apiKey !== CREDENCIAIS_DEMO.apiKey) throw erro('CREDENCIAIS_INVALIDAS', 'E-mail ou chave incorretos.');
    return { token: 'demo', escritorio: CONTADOR.escritorio, slugLink: CONTADOR.slugLink };
  },
  async analises() {
    await espera();
    const itens = ler().leads.map((l) => {
      const r = ['CONCLUIDO', 'CONTRATO_ENVIADO', 'PROTOCOLADO'].includes(l.status) ? relatorioDe(l) : null;
      return {
        id: l.id, nome: l.nome, profissao: l.profissao, whatsapp: l.whatsapp, status: l.status, atualizadoEm: l.atualizadoEm,
        recuperavelOnline: r?.recuperavelOnline ?? null, prejuizoPrescrito: r?.prejuizoPrescrito ?? null, confianca: r?.confianca ?? null,
        diasParaPrescrever: r?.gatilhos?.diasParaPrescrever ?? null, prioridade: r ? alertaComercial(r).prioridade : null,
        copiaPendente: (l.solicitacoes || []).length > 0,
      };
    }).sort((a, b) => (b.recuperavelOnline ?? -1) - (a.recuperavelOnline ?? -1));
    return { totais: { recuperavel: itens.reduce((s, i) => s + (i.recuperavelOnline || 0), 0), leads: itens.length }, itens };
  },
  async analise(leadId) {
    await espera();
    const { l } = lead(leadId);
    const r = ['CONCLUIDO', 'CONTRATO_ENVIADO', 'PROTOCOLADO'].includes(l.status) ? relatorioDe(l) : null;
    return {
      lead: { id: l.id, nome: l.nome, profissao: l.profissao, whatsapp: l.whatsapp, status: l.status, consentimento: l.consentimento, documentos: l.documentos || [] },
      relatorio: r, alertaComercial: r ? alertaComercial(r) : null, roteiro: r ? roteiroCliente({ lead: l, relatorio: r, contador: CONTADOR }) : null,
    };
  },
  async contrato(leadId) {
    await espera();
    const { l } = lead(leadId);
    if (l.status === 'CONCLUIDO') atualizar(leadId, { status: 'CONTRATO_ENVIADO' });
    return `# Contrato de honorários de êxito (DEMONSTRAÇÃO)\n\nContratante: ${l.nome}\nContratado: ${CONTADOR.escritorio}\n\nNo modo demonstração o contrato completo não é gerado. Com a API no ar, este botão baixa a minuta preenchida (templates/contrato.md).\n`;
  },
  async mudarStatus(leadId, status) { await espera(); atualizar(leadId, { status }); return { status }; },
  async copiaEntregue(leadId) { await espera(); atualizar(leadId, { solicitacoes: [] }); return { ok: true }; },
  async baixarCsv(leadId) {
    const { l } = lead(leadId);
    const r = relatorioDe(l);
    const linhas = ['competencia;excesso;vencimento', ...r.meses.filter((m) => !m.prescrito && m.excesso > 0).map((m) => `${m.competencia};${m.excesso.toFixed(2).replace('.', ',')};${m.vencimentoPrescricao}`)];
    return new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv' });
  },
  resetar() { try { localStorage.removeItem(CHAVE); } catch { /* */ } },
};
