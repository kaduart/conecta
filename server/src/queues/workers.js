// Workers: processar (PDF -> JSON -> motor -> relatório), notificar (WhatsApp + webhook) e limpeza LGPD.
// Rodar em processo separado: npm run worker
import { Worker } from 'bullmq';
import { conectar } from '../db.js';
import { config } from '../config.js';
import { log } from '../logger.js';
import { connection, enfileirarNotificacao, agendarLimpeza } from './index.js';
import { Contador, Lead, RelatorioAuditoria } from '../models/index.js';
import { ler, apagar } from '../services/storage.js';
import { textoDoPdf, parseCnis, parseInforme, normalizar } from '../parsers/index.js';
import { auditar } from '../engine/teto.js';
import { paraRelatorio, relatorioParaApi } from '../engine/mapear.js';
import { avaliarExtracao } from '../parsers/validador.js';
import { mensagemContador, payloadWebhook } from '../services/notificacao.js';
import { enviarTexto } from '../services/whatsapp.js';
import { enviarWebhook } from '../services/webhook.js';

export async function processarLead({ leadId, idempotencyKey }) {
  const lead = await Lead.findById(leadId);
  if (!lead) throw new Error(`lead ${leadId} não existe`);

  // Idempotência: relatório com a mesma chave já existe? Só garante status e notificação.
  const existente = await RelatorioAuditoria.findOne({ lead_id: lead._id, idempotency_key: idempotencyKey });
  if (existente) {
    if (!['CONTRATO_ENVIADO', 'PROTOCOLADO'].includes(lead.status_jornada)) {
      lead.status_jornada = existente.resumo_financeiro.grau_confianca === 'BAIXO' ? 'REVISAO_MANUAL' : 'PROCESSADO';
    }
    lead.relatorio_id = existente._id;
    await lead.save();
    if (!existente.notificado_em) await enfileirarNotificacao(existente._id);
    return { relatorioId: existente._id, reaproveitado: true };
  }

  let vinculos = [];
  const informes = [];
  for (const doc of lead.documentos) {
    if (doc.apagado_em) continue;
    try {
      if (doc.status !== 'EXTRAIDO') {
        const texto = await textoDoPdf(await ler(doc.s3_key));
        doc.extraido = doc.tipo === 'CNIS' ? { vinculos: parseCnis(texto) } : parseInforme(texto);
        doc.status = 'EXTRAIDO';
      }
      if (doc.tipo === 'CNIS') vinculos = vinculos.concat(doc.extraido.vinculos || []);
      else if (doc.tipo === 'INFORME') informes.push(doc.extraido);
    } catch (e) {
      doc.status = 'ERRO';
      doc.erro = e.message.slice(0, 200);
      log.warn({ leadId, doc: doc._id, err: e.message }, 'falha na extração');
    }
  }
  lead.markModified('documentos');

  // Score de confiança da leitura. Sem vínculo nenhum não há o que calcular.
  const extracao = avaliarExtracao({ vinculos, informes });
  if (!vinculos.length) {
    lead.status_jornada = 'REVISAO_MANUAL';
    await lead.save();
    log.warn({ leadId, motivos: extracao.motivos }, 'CNIS ilegível: revisão manual');
    return { erro: 'CNIS_ILEGIVEL' }; // não lança: repetir não resolve PDF ilegível
  }

  const contador = await Contador.findById(lead.contador_id);
  const resultado = auditar(normalizar(vinculos, informes.filter((i) => i.inssAnual != null)), { dataBase: config.dataBase || undefined });
  const dados = paraRelatorio(resultado, { extracao, honorariosPercentual: contador?.honorarios_percentual });

  // Um relatório por lead: reprocessar com documentos novos substitui o anterior.
  const rel = await RelatorioAuditoria.findOneAndUpdate(
    { lead_id: lead._id },
    {
      $set: {
        ...dados, contador_id: lead.contador_id, idempotency_key: idempotencyKey, notificado_em: null,
        arquivos_origem: lead.documentos.map((d) => ({ nome_arquivo: d.nome_arquivo, s3_key: d.s3_key, sha256_hash: d.sha256_hash })),
      },
    },
    { upsert: true, new: true, runValidators: true },
  );
  lead.relatorio_id = rel._id;
  lead.status_jornada = extracao.revisaoManual ? 'REVISAO_MANUAL' : 'PROCESSADO';
  await lead.save();
  await enfileirarNotificacao(rel._id);
  log.info({ leadId, relatorioId: rel._id, recuperavel: rel.resumo_financeiro.total_recuperavel, score: extracao.score }, 'auditoria concluída');
  return { relatorioId: rel._id };
}

export async function notificarContador({ relatorioId }) {
  const doc = await RelatorioAuditoria.findById(relatorioId);
  if (!doc || doc.notificado_em) return { pulado: true };
  const [lead, contador] = await Promise.all([
    Lead.findById(doc.lead_id),
    Contador.findById(doc.contador_id).select('+whatsapp_provider.token_cifrado +webhook.segredo_cifrado'),
  ]);
  const relatorio = relatorioParaApi(doc.toObject());
  const painelUrl = `${config.webOrigin}/painel/${lead._id}`;
  const args = { lead, relatorio, contador, painelUrl };

  await enviarWebhook(contador, payloadWebhook(args));
  const { texto } = mensagemContador(args);
  await enviarTexto(contador.whatsapp_provider, contador.whatsapp, texto);

  // Marca só depois de enviar; o update condicional evita envio duplo em corrida.
  await RelatorioAuditoria.updateOne({ _id: doc._id, notificado_em: null }, { notificado_em: new Date() });
  return { ok: true };
}

/** Apaga os PDFs vencidos do storage e mantém só os metadados (LGPD). */
export async function limparVencidos() {
  const agora = new Date();
  const leads = await Lead.find({ documentos: { $elemMatch: { apagar_em: { $lte: agora }, apagado_em: null } } });
  let apagados = 0;
  for (const lead of leads) {
    for (const d of lead.documentos) {
      if (d.apagar_em <= agora && !d.apagado_em) { await apagar(d.s3_key); d.apagado_em = agora; d.extraido = undefined; apagados += 1; }
    }
    await lead.save();
  }
  log.info({ apagados }, 'limpeza LGPD');
  return { apagados };
}

const opcoes = { connection, concurrency: 4 };
const handlers = { 'processar-auditoria': processarLead, 'notificar-contador': notificarContador, 'limpeza-lgpd': limparVencidos };

/** Sobe os workers. Usado pelo `npm run worker` ou dentro da API (WORKER_EMBUTIDO=1). */
export async function iniciarWorkers() {
  await agendarLimpeza();
  for (const [fila, fn] of Object.entries(handlers)) {
    const w = new Worker(fila, (job) => fn(job.data), opcoes);
    w.on('failed', (job, err) => log.error({ fila, jobId: job?.id, tentativa: job?.attemptsMade, err: err.message }, 'job falhou'));
    w.on('completed', (job) => log.info({ fila, jobId: job.id }, 'job ok'));
  }
  log.info('workers no ar');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await conectar();
  await iniciarWorkers();
}
