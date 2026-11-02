// Converte a saída de auditar() para o formato do model RelatorioAuditoria.
import { LIMITE_REVISAO } from '../parsers/validador.js';

export function grauConfianca(resultado, extracao) {
  if (extracao && extracao.score < LIMITE_REVISAO) return 'BAIXO';
  if (resultado.confianca === 'ESTIMADO' || (extracao && extracao.score < 90)) return 'MEDIO';
  return 'ALTO';
}

export function paraRelatorio(resultado, { extracao, honorariosPercentual = 30 } = {}) {
  const g = resultado.gatilhos;
  return {
    versao_motor: resultado.versaoMotor,
    data_base: resultado.dataBase,
    resumo_financeiro: {
      total_recuperavel: resultado.recuperavel_online,
      total_prescrito_perdido: resultado.prejuizo_prescrito,
      honorarios_estimados: Math.round(resultado.recuperavel_online * Math.min(honorariosPercentual, 30)) / 100,
      grau_confianca: grauConfianca(resultado, extracao),
    },
    extracao: extracao ? { score: extracao.score, motivos: extracao.motivos } : undefined,
    gatilhos_detectados: {
      multiplos_vinculos: Boolean(g.bitributacaoDesde),
      mes_inicio_bitributacao: g.bitributacaoDesde,
      vinculo_ativo_com_excesso: resultado.alertas.some((a) => a.tipo === 'DESCONTO_ATIVO'),
      proxima_competencia_a_vencer: g.proximaCompetenciaAVencer,
      valor_a_vencer: g.valorAVencer,
      dias_para_prescrever: g.diasParaPrescrever,
      perda_media_mensal: g.perdaMediaMensalSemProtocolo,
      meses_com_excesso: g.mesesComExcesso,
    },
    alertas: resultado.alertas,
    consolidado_anual: resultado.consolidadoAnual.map((a) => ({ ano: a.ano, pago: a.pago, devido: a.devido, excesso_recuperavel: a.excessoRecuperavel, excesso_prescrito: a.excessoPrescrito, meses: a.meses })),
    cronograma_mensal: resultado.meses.map((m) => ({
      competencia: m.competencia,
      fontes_detectadas: m.vinculos.map((v) => v.nome || v.cnpj),
      total_contribuido_pago: m.pago,
      devido: m.devido,
      teto_legal_epoca: m.teto ?? 0,
      cota_maxima: m.cotaMaxima,
      parametro_confirmado: m.parametroConfirmado,
      excesso_calculado: m.excesso,
      status_prazo: m.prescrito ? 'PRESCRITO' : 'DISPONIVEL',
      vencimento_prescricao: m.vencimentoPrescricao,
      confianca: m.confianca,
      fontes: m.vinculos,
    })),
  };
}

/** Formato que o front e os serviços consomem (o mesmo contrato de antes, em camelCase). */
export function relatorioParaApi(r) {
  if (!r) return null;
  const g = r.gatilhos_detectados || {};
  return {
    id: r._id,
    versaoMotor: r.versao_motor,
    dataBase: r.data_base,
    recuperavelOnline: r.resumo_financeiro.total_recuperavel,
    prejuizoPrescrito: r.resumo_financeiro.total_prescrito_perdido,
    honorariosEstimados: r.resumo_financeiro.honorarios_estimados,
    grauConfianca: r.resumo_financeiro.grau_confianca,
    confianca: r.cronograma_mensal.some((m) => m.confianca === 'ESTIMADO') ? 'ESTIMADO' : 'COMPROVADO',
    extracao: r.extracao,
    gatilhos: {
      proximaCompetenciaAVencer: g.proxima_competencia_a_vencer,
      valorAVencer: g.valor_a_vencer,
      diasParaPrescrever: g.dias_para_prescrever,
      perdaMediaMensalSemProtocolo: g.perda_media_mensal,
      bitributacaoDesde: g.mes_inicio_bitributacao,
      mesesComExcesso: g.meses_com_excesso,
    },
    alertas: r.alertas,
    consolidadoAnual: r.consolidado_anual.map((a) => ({ ano: a.ano, pago: a.pago, devido: a.devido, excessoRecuperavel: a.excesso_recuperavel, excessoPrescrito: a.excesso_prescrito, meses: a.meses })),
    meses: r.cronograma_mensal.map((m) => ({
      competencia: m.competencia, teto: m.teto_legal_epoca, cotaMaxima: m.cota_maxima, parametroConfirmado: m.parametro_confirmado,
      pago: m.total_contribuido_pago, devido: m.devido, excesso: m.excesso_calculado, prescrito: m.status_prazo === 'PRESCRITO',
      vencimentoPrescricao: m.vencimento_prescricao, qtdVinculos: m.fontes?.length || m.fontes_detectadas.length, confianca: m.confianca, vinculos: m.fontes,
    })),
    idempotencyKey: r.idempotency_key,
  };
}
