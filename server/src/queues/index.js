// Filas BullMQ. Cada job tem jobId determinístico: reenfileirar o mesmo trabalho não duplica.
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config.js';

export const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

const padrao = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 }, // 2s, 4s, 8s, 16s, 32s
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

export const filas = {
  processar: new Queue('processar-auditoria', { connection, defaultJobOptions: padrao }),
  notificar: new Queue('notificar-contador', { connection, defaultJobOptions: padrao }),
  limpeza: new Queue('limpeza-lgpd', { connection, defaultJobOptions: { ...padrao, attempts: 3 } }),
};

/** Enfileira o processamento de um lead. A chave inclui o hash dos documentos. */
export function enfileirarProcessamento(leadId, idempotencyKey) {
  return filas.processar.add('processar', { leadId: String(leadId), idempotencyKey }, { jobId: `proc:${idempotencyKey}` });
}

export function enfileirarNotificacao(relatorioId) {
  return filas.notificar.add('notificar', { relatorioId: String(relatorioId) }, { jobId: `notif:${relatorioId}` });
}

/** Limpeza diária dos PDFs vencidos (retenção LGPD). */
export function agendarLimpeza() {
  return filas.limpeza.add('limpar', {}, { repeat: { pattern: '0 3 * * *', tz: 'America/Sao_Paulo' }, jobId: 'limpeza-diaria' });
}
