// Envio de WhatsApp via Evolution API ou Z-API. Conferir os endpoints na documentação
// da versão que você usa: as duas APIs mudam rotas entre versões.
import { config } from '../config.js';
import { decrypt } from './crypto.js';
import { log } from '../logger.js';

const soDigitos = (n) => String(n).replace(/\D/g, '');

async function post(url, headers, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    const err = new Error(`WhatsApp ${res.status}: ${txt.slice(0, 200)}`);
    err.retry = res.status >= 500 || res.status === 429; // 4xx de payload não adianta repetir
    throw err;
  }
  return res.json().catch(() => ({}));
}

/** @param {{tipo:'evolution'|'zapi'|'nenhum', instancia?:string, tokenEnc?:string}} provider */
export async function enviarTexto(provider, numero, texto) {
  const token = provider?.tokenEnc ? decrypt(provider.tokenEnc) : null;
  const numeroLimpo = soDigitos(numero);

  if (provider?.tipo === 'evolution') {
    // Evolution API v2: POST /message/sendText/{instance}, header apikey
    if (!config.evolutionUrl) throw new Error('EVOLUTION_URL não configurada');
    return post(`${config.evolutionUrl}/message/sendText/${encodeURIComponent(provider.instancia)}`, { apikey: token }, { number: numeroLimpo, text: texto });
  }
  if (provider?.tipo === 'zapi') {
    // Z-API: POST /instances/{id}/token/{token}/send-text, header Client-Token
    return post(`${config.zapiUrl}/instances/${provider.instancia}/token/${token}/send-text`, { 'Client-Token': config.zapiClientToken }, { phone: numeroLimpo, message: texto });
  }
  log.warn({ numero: numeroLimpo.slice(-4) }, 'whatsapp: provedor não configurado, mensagem não enviada');
  return { pulado: true };
}
