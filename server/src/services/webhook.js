// Webhook opcional para o CRM do escritório. Assina o corpo com HMAC-SHA256
// (header X-Recupera-Signature) e manda o Idempotency-Key para o receptor deduplicar.
import crypto from 'node:crypto';
import { decrypt } from './crypto.js';

export async function enviarWebhook(contador, payload) {
  if (!contador.webhook?.url) return { pulado: true };
  const corpo = JSON.stringify(payload);
  const segredo = contador.webhook.segredoEnc ? decrypt(contador.webhook.segredoEnc) : '';
  const assinatura = crypto.createHmac('sha256', segredo).update(corpo).digest('hex');
  const res = await fetch(contador.webhook.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Recupera-Event': payload.evento,
      'X-Recupera-Signature': `sha256=${assinatura}`,
      'Idempotency-Key': payload.idempotencyKey,
    },
    body: corpo,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`webhook ${res.status}`);
  return { ok: true };
}
