// Workers: processar (PDF -> JSON -> motor -> relatório), notificar (WhatsApp + webhook) e limpeza LGPD.
// Rodar em processo separado: npm run worker
import { Worker } from 'bullmq';
import { conectar } from '../db.js';
import { config } from '../config.js';
import { log } from '../logger.js';
import { connection, enfileirarNotificacao, agendarLimpeza } from './index.js';
import { Contador, Lead, Relatorio } from '../models/index.js';
import { ler, apagar } from '../services/storage.js';
import { textoDoPdf, parseCnis, parseInforme, normalizar } from '../parsers/index.js';
import { auditar } from '../engine/teto.js';
import { mensagemContador, payloadWebhook } from '../services/notificacao.js';
import { enviarTexto } from '../services/whatsapp.js';
import { enviarWebhook } from '../services/webhook.js';

export async function processarLead({ leadId, idempotencyKey }) {
  // Idempotência: relatório já gerado com a mesma chave? Só garante a notificação.
  const existente = await Relatorio.findOne({ idempotencyKey });
  if (existente) {
    await Lead.updateOne({ _id: leadId }, { status: 'CONCLUIDO', relatorioId: existente._id });
    if (!existente.notificadoEm) await enfileirarNotificacao(existente._id);
    return { relatorioId: existente._id, reaproveitado: true };
  }

  const lead = await Lead.findById(leadId);
  if (!lead) throw new Error(`lead ${leadId} não existe`);

  let vinculos = [];
  const informes = [];
  for (const doc of lead.documentos) {
    try {
      if (doc.status !== 'EXTRAIDO') {
        const texto = await textoDoPdf(await ler(doc.storageKey));
        doc.extraido = doc.tipo === 'CNIS' ? { vinculos: parseCnis(texto) } : parseInforme(texto);
        doc.status = 'EXTRAIDO';
      }
      if (doc.tipo === 'CNIS') vinculos = vinculos.concat(doc.extraido.vinculos || []);
      else if (doc.extraido?.inssAnual != null) informes.push(doc.extraido);
    } catch (e) {
      doc.status = 'ERRO';
      doc.erro = e.message.slice(0, 200);
      log.warn({ leadId, doc: doc._id, err: e.message }, 'falha na extração');
    }
  }
  lead.markModified('documentos');

  if (!vinculos.length) {
    lead.status = 'ERRO';
    await lead.save();
    log.warn({ leadId }, 'CNIS sem vínculos legíveis: revisão manual');
    return { erro: 'CNIS_ILEGIVEL' }; // não lança: repetir não resolve PDF ilegível
  }

  const resultado = auditar(normalizar(vinculos, informes), { dataBase: config.dataBase || undefined });

  const rel = await Relatorio.findOneAndUpdate(
    { idempotencyKey },
    {
      $setOnInsert: {
        leadId: lead._id, contadorId: lead.contadorId, idempotencyKey,
        versaoMotor: resultado.versaoMotor, dataBase: resultado.dataBase,
        recuperavelOnline: resultado.recuperavel_online, prejuizoPrescrito: resultado.prejuizo_prescrito,
        confianca: resultado.confianca, consolidadoAnual: resultado.consolidadoAnual, meses: resultado.meses,
        gatilhos: resultado.gatilhos, alertas: resultado.alertas,
      },
    },
    { upsert: true, new: true },
  );
  lead.relatorioId = rel._id;
  lead.status = 'CONCLUIDO';
  await lead.save();
  await enfileirarNotificacao(rel._id);
  log.info({ leadId, relatorioId: rel._id, recuperavel: rel.recuperavelOnline }, 'auditoria concluída');
  return { relatorioId: rel._id };
}

export async function notificarContador({ relatorioId }) {
  const rel = await Relatorio.findById(relatorioId);
  if (!rel || rel.notificadoEm) return { pulado: true };
  const [lead, contador] = await Promise.all([Lead.findById(rel.leadId), Contador.findById(rel.contadorId)]);
  const painelUrl = `${config.webOrigin}/painel/${lead._id}`;
  const args = { lead, relatorio: rel, contador, painelUrl };

  await enviarWebhook(contador, payloadWebhook(args));
  const { texto } = mensagemContador(args);
  await enviarTexto(contador.whatsappProvider, contador.whatsapp, texto);

  // Marca só depois de enviar; o update condicional evita envio duplo em corrida.
  await Relatorio.updateOne({ _id: rel._id, notificadoEm: null }, { notificadoEm: new Date() });
  return { ok: true };
}

export async function limparVencidos() {
  const agora = new Date();
  const leads = await Lead.find({ 'documentos.apagarEm': { $lte: agora } });
  let apagados = 0;
  for (const lead of leads) {
    const manter = [];
    for (const d of lead.documentos) {
      if (d.apagarEm <= agora) { await apagar(d.storageKey); apagados += 1; } else manter.push(d);
    }
    lead.documentos = manter;
    await lead.save();
  }
  log.info({ apagados }, 'limpeza LGPD');
  return { apagados };
}

const opcoes = { connection, concurrency: 4 };
const handlers = { 'processar-auditoria': processarLead, 'notificar-contador': notificarContador, 'limpeza-lgpd': limparVencidos };

if (import.meta.url === `file://${process.argv[1]}`) {
  await conectar();
  await agendarLimpeza();
  for (const [fila, fn] of Object.entries(handlers)) {
    const w = new Worker(fila, (job) => fn(job.data), opcoes);
    w.on('failed', (job, err) => log.error({ fila, jobId: job?.id, tentativa: job?.attemptsMade, err: err.message }, 'job falhou'));
    w.on('completed', (job) => log.info({ fila, jobId: job.id }, 'job ok'));
  }
  log.info('workers no ar');
}
