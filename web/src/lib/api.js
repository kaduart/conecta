// Cliente HTTP. Lead: X-Lead-Token (sessionStorage). Contador: Bearer JWT (localStorage).
import { demoApi } from './demo.js';

// Sem VITE_API_URL o app roda em modo demonstração (API simulada no navegador).
export const DEMO = !import.meta.env.VITE_API_URL || import.meta.env.VITE_DEMO === '1';
const BASE = import.meta.env.VITE_API_URL;

const ler = (store, k) => { try { return JSON.parse(store.getItem(k)); } catch { return null; } };
const gravar = (store, k, v) => { try { v == null ? store.removeItem(k) : store.setItem(k, JSON.stringify(v)); } catch { /* modo privado */ } };

export const sessaoLead = {
  get: () => ler(sessionStorage, 'recupera:lead'),
  set: (v) => gravar(sessionStorage, 'recupera:lead', { ...(ler(sessionStorage, 'recupera:lead') || {}), ...v }),
  limpar: () => gravar(sessionStorage, 'recupera:lead', null),
};
export const sessaoContador = {
  get: () => ler(localStorage, 'recupera:contador'),
  set: (v) => gravar(localStorage, 'recupera:contador', v),
  limpar: () => gravar(localStorage, 'recupera:contador', null),
};

const MENSAGENS = {
  CONVITE_INVALIDO: 'Este convite não é válido. Peça um novo link ao seu contador.',
  CONSENTIMENTO_PENDENTE: 'Falta autorizar o uso dos dados.',
  CNIS_OBRIGATORIO: 'Anexe o extrato CNIS para continuar.',
  VALIDACAO: 'Confira os campos destacados.',
  CREDENCIAIS_INVALIDAS: 'E-mail ou chave incorretos.',
  TOKEN_INVALIDO: 'Sua sessão expirou. Entre de novo.',
};

async function req(caminho, { metodo = 'GET', corpo, form, auth } = {}) {
  const headers = {};
  if (corpo) headers['Content-Type'] = 'application/json';
  if (auth === 'lead') headers['X-Lead-Token'] = sessaoLead.get()?.leadToken;
  if (auth === 'contador') headers.Authorization = `Bearer ${sessaoContador.get()?.token}`;
  const res = await fetch(BASE + caminho, { method: metodo, headers, body: form || (corpo && JSON.stringify(corpo)) });
  const tipo = res.headers.get('content-type') || '';
  const dados = tipo.includes('json') ? await res.json() : await res.text();
  if (!res.ok) {
    const codigo = dados?.erro || `HTTP_${res.status}`;
    if (res.status === 401 && auth === 'contador') sessaoContador.limpar();
    const e = new Error(MENSAGENS[codigo] || 'Algo deu errado. Tente de novo em instantes.');
    e.codigo = codigo; e.status = res.status; e.campos = dados?.campos;
    throw e;
  }
  return dados;
}

const apiReal = {
  convite: (slug) => req(`/i/${slug}`),
  criarLead: (slug, corpo) => req(`/i/${slug}/leads`, { metodo: 'POST', corpo }),
  consentir: (id, corpo) => req(`/leads/${id}/consent`, { metodo: 'POST', corpo, auth: 'lead' }),
  enviarDocs: (id, form) => req(`/leads/${id}/documents`, { metodo: 'POST', form, auth: 'lead' }),
  processar: (id) => req(`/leads/${id}/process`, { metodo: 'POST', auth: 'lead' }),
  status: (id) => req(`/leads/${id}/status`, { auth: 'lead' }),
  pedirCopia: (id) => req(`/leads/${id}/copia-relatorio`, { metodo: 'POST', auth: 'lead' }),

  login: (corpo) => req('/contador/login', { metodo: 'POST', corpo }),
  analises: () => req('/contador/analises', { auth: 'contador' }),
  analise: (id) => req(`/contador/analises/${id}`, { auth: 'contador' }),
  contrato: (id) => req(`/contador/analises/${id}/contrato`, { auth: 'contador' }),
  mudarStatus: (id, status) => req(`/contador/analises/${id}/status`, { metodo: 'PATCH', corpo: { status }, auth: 'contador' }),
  copiaEntregue: (id) => req(`/contador/analises/${id}/copia-entregue`, { metodo: 'POST', auth: 'contador' }),
  async baixarCsv(id) {
    const res = await fetch(`${BASE}/contador/analises/${id}/perdcomp.csv`, { headers: { Authorization: `Bearer ${sessaoContador.get()?.token}` } });
    if (!res.ok) throw new Error('Não foi possível baixar a planilha.');
    return res.blob();
  },
};

export const api = DEMO ? demoApi : apiReal;
