// Monta o payload do webhook e o texto de WhatsApp para o CONTADOR.
// Funções puras (sem I/O) para serem testadas isoladamente.

const brl = (v) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const mesAno = (comp) => {
  if (!comp) return '';
  const [a, m] = comp.split('-');
  return m === '13' ? `13º/${a}` : `${m}/${a}`;
};
const dataBr = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const primeiroNome = (nome) => nome.trim().split(/\s+/)[0];

// Tratamento formal só para profissões em que o título é usual. Sem gênero conhecido, usa "Dr(a)."
const COM_TITULO = /m[ée]dic|dentist|odont|advog|veterin|juiz|promotor|delegad/i;
export function tratamento(nome, profissao) {
  return COM_TITULO.test(profissao || '') ? `Dr(a). ${primeiroNome(nome)}` : primeiroNome(nome);
}

/** Nível do alerta comercial. Só usa urgência real (prazo calculado), nunca contagem fictícia. */
export function alertaComercial(rel) {
  const g = rel.gatilhos || {};
  const itens = [];
  let prioridade = 'NORMAL';
  if (g.diasParaPrescrever != null && g.diasParaPrescrever <= 60) {
    prioridade = 'ALTA';
    itens.push(`${brl(g.valorAVencer)} da competência ${mesAno(g.proximaCompetenciaAVencer)} prescreve em ${g.diasParaPrescrever} dias.`);
  } else if (g.diasParaPrescrever != null && g.diasParaPrescrever <= 180) {
    prioridade = 'MEDIA';
    itens.push(`Primeira competência vence em ${g.diasParaPrescrever} dias (${mesAno(g.proximaCompetenciaAVencer)}).`);
  }
  if (g.perdaMediaMensalSemProtocolo > 0) itens.push(`Sem protocolo, perde em média ${brl(g.perdaMediaMensalSemProtocolo)} por mês nos próximos 12 meses.`);
  if (g.bitributacaoDesde) itens.push(`Desconto acima do teto desde ${mesAno(g.bitributacaoDesde)} (mais de um vínculo).`);
  if ((rel.alertas || []).some((a) => a.tipo === 'DESCONTO_ATIVO')) itens.push('O desconto em excesso continua acontecendo todo mês.');
  return { prioridade, itens };
}

/** Payload JSON do evento (webhook do escritório e log de auditoria). Sem CPF. */
export function payloadWebhook({ lead, relatorio, contador, painelUrl }) {
  const alerta = alertaComercial(relatorio);
  return {
    evento: 'auditoria.concluida',
    versao: 1,
    ocorridoEm: new Date().toISOString(),
    idempotencyKey: relatorio.idempotencyKey,
    contador: { id: String(contador._id), escritorio: contador.escritorio },
    lead: {
      id: String(lead._id),
      nome: lead.nome,
      profissao: lead.profissao,
      whatsapp: lead.whatsapp,
      consentimento: { versaoTermo: lead.consentimento?.versaoTermo, aceitoEm: lead.consentimento?.aceitoEm },
    },
    resultado: {
      recuperavelOnline: relatorio.recuperavelOnline,
      prejuizoPrescrito: relatorio.prejuizoPrescrito,
      confianca: relatorio.confianca,
      dataBase: relatorio.dataBase,
      versaoMotor: relatorio.versaoMotor,
      gatilhos: relatorio.gatilhos,
      alertas: relatorio.alertas,
    },
    alertaComercial: alerta,
    links: { painel: painelUrl },
  };
}

/** Texto para o contador (via Evolution/Z-API), com o roteiro pronto para ele mandar ao cliente. */
export function mensagemContador({ lead, relatorio, contador, painelUrl }) {
  const g = relatorio.gatilhos || {};
  const alerta = alertaComercial(relatorio);
  const estimado = relatorio.confianca === 'ESTIMADO';
  const icone = { ALTA: '🔴', MEDIA: '🟠', NORMAL: '🟢' }[alerta.prioridade];

  const cabecalho = [
    `*RECUPERA · Nova auditoria concluída* ${icone}`,
    '',
    `*Cliente:* ${lead.nome} (${lead.profissao})`,
    `*Recuperável (últimos 5 anos):* ${brl(relatorio.recuperavelOnline)}${estimado ? ' _estimado_' : ''}`,
    `*Já prescrito:* ${brl(relatorio.prejuizoPrescrito)}`,
    g.proximaCompetenciaAVencer ? `*Próximo vencimento:* ${mesAno(g.proximaCompetenciaAVencer)}, em ${g.diasParaPrescrever} dias` : null,
    '',
    `*Alerta comercial (${alerta.prioridade}):*`,
    ...alerta.itens.map((i) => `• ${i}`),
    estimado ? '• Parte do cálculo é estimada pelo CNIS. Peça holerites ou informes antes do PER/DCOMP.' : null,
    '',
    `Painel: ${painelUrl}`,
    '',
    '*Roteiro sugerido para enviar ao cliente:*',
  ].filter((l) => l !== null);

  const roteiro = roteiroCliente({ lead, relatorio, contador });
  return { texto: [...cabecalho, '', roteiro].join('\n'), roteiro };
}

/** Abordagem ao cliente. Fala em indício e prazo real; não promete resultado. */
export function roteiroCliente({ lead, relatorio, contador }) {
  const g = relatorio.gatilhos || {};
  const prazo = g.proximaCompetenciaAVencer
    ? ` O primeiro mês recuperável (${mesAno(g.proximaCompetenciaAVencer)}) prescreve em ${g.diasParaPrescrever} dias, e a cada mês sem pedido um valor deixa de poder ser recuperado.`
    : '';
  return [
    `Olá, ${tratamento(lead.nome, lead.profissao)}, sou ${contador.responsavel}, seu contador parceiro do RECUPERA.`,
    `Acabamos de rodar a auditoria digital dos seus últimos 5 anos de INSS e encontramos indício de cerca de ${brl(relatorio.recuperavelOnline)} pagos acima do teto, que podem ser pedidos de volta à Receita Federal.${prazo}`,
    'Posso te enviar o relatório detalhado e explicar em 10 minutos como funciona o pedido? Você só paga honorários se o valor for efetivamente restituído ou compensado.',
  ].join('\n\n');
}

export const _fmt = { brl, mesAno, dataBr };
