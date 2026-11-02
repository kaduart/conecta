// Motor de auditoria do teto do INSS para segurado com múltiplos vínculos.
// Base legal: Lei 8.212/91 arts. 12 §2º, 28 §5º e 89; CTN art. 168, I + LC 118/2005 art. 3º (prescrição);
// IN RFB 2.110/2022 (cálculo) e IN RFB 2.055/2021 (restituição via PER/DCOMP).
// Função pura: sem I/O. Recebe competências normalizadas e devolve o relatório.

import { paramsDe, ALIQUOTA_CI_RETIDA } from './params.js';

export const VERSAO_MOTOR = '1.0.0';

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const sum = (a) => a.reduce((s, x) => s + x, 0);

export function contribuicaoEmpregado(base, faixas) {
  let anterior = 0;
  let total = 0;
  for (const [limite, aliquota] of faixas) {
    const fatia = Math.min(base, limite) - anterior;
    if (fatia <= 0) break;
    total += r2(fatia * aliquota); // empregadores arredondam por faixa
    anterior = limite;
  }
  return r2(total);
}

// Data em que a competência foi recolhida: dia 20 do mês seguinte; 13º em 20/12.
export function dataRecolhimento(comp) {
  const [ano, mes] = comp.split('-').map(Number);
  if (mes === 13) return new Date(Date.UTC(ano, 11, 20));
  return new Date(Date.UTC(ano, mes, 20)); // mês JS 0-based => mes = mês seguinte
}

export function vencimentoPrescricao(comp) {
  const d = dataRecolhimento(comp);
  d.setUTCFullYear(d.getUTCFullYear() + 5);
  return d;
}

const DIA = 86400000;

// Contribuição devida no mês, com a soma de todos os vínculos limitada ao teto.
function devidoNoMes(p, vinculos) {
  const emp = vinculos.filter((v) => v.tipo === 'EMPREGADO');
  const ci = vinculos.filter((v) => v.tipo === 'CI');
  const remEmp = sum(emp.map((v) => v.remuneracao || 0));
  const remCi = sum(ci.map((v) => v.remuneracao || 0));

  if (p.teto && p.faixas) {
    const baseEmp = Math.min(remEmp, p.teto);
    // No teto, usa a cota máxima oficial (evita diferença de centavos de arredondamento).
    const devEmp = baseEmp >= p.teto ? p.cotaMaxima : contribuicaoEmpregado(baseEmp, p.faixas);
    const baseCi = Math.min(remCi, p.teto - baseEmp);
    const devCi = r2(baseCi * ALIQUOTA_CI_RETIDA);
    return { devido: r2(devEmp + devCi), metodo: 'TABELA' };
  }
  // Sem tabela da vigência: usa a cota máxima. Só é exato quando a soma das remunerações passa do teto.
  return { devido: p.cotaMaxima, metodo: 'COTA_MAXIMA' };
}

// Quanto cada fonte descontou. Real se veio do holerite/informe; senão, estimado
// como se cada fonte ignorasse as outras (é o que gera o excesso na prática).
function pagoNoMes(p, vinculos) {
  let estimado = false;
  const porVinculo = vinculos.map((v) => {
    if (v.inssDescontado != null) return { ...v, inss: r2(v.inssDescontado), origem: v.origemInss || 'DOCUMENTO' };
    estimado = true;
    let inss;
    if (v.tipo === 'CI') inss = r2(Math.min(v.remuneracao, p.teto || Infinity) * ALIQUOTA_CI_RETIDA);
    else if (p.teto && p.faixas) inss = v.remuneracao >= p.teto ? p.cotaMaxima : contribuicaoEmpregado(v.remuneracao, p.faixas);
    else inss = Math.min(p.cotaMaxima, r2(v.remuneracao * 0.14));
    return { ...v, inss, origem: 'ESTIMADO_CNIS' };
  });
  return { pago: r2(sum(porVinculo.map((v) => v.inss))), porVinculo, estimado };
}

/**
 * @param {Array<{competencia:string, vinculos:Array<{cnpj:string, nome?:string, tipo:'EMPREGADO'|'CI', remuneracao:number, inssDescontado?:number, ativo?:boolean}>}>} competencias
 * @param {{dataBase?: Date|string}} opts
 */
export function auditar(competencias, opts = {}) {
  const dataBase = new Date(opts.dataBase || Date.now());
  const ordenadas = [...competencias].sort((a, b) => a.competencia.localeCompare(b.competencia));

  const meses = ordenadas.map(({ competencia, vinculos }) => {
    const p = paramsDe(competencia);
    const { devido, metodo } = devidoNoMes(p, vinculos);
    const { pago, porVinculo, estimado } = pagoNoMes(p, vinculos);
    const excesso = Math.max(0, r2(pago - devido));
    const vence = vencimentoPrescricao(competencia);
    return {
      competencia,
      teto: p.teto,
      cotaMaxima: p.cotaMaxima,
      parametroConfirmado: p.confirmado,
      metodo,
      pago,
      devido,
      excesso,
      prescrito: vence < dataBase,
      vencimentoPrescricao: vence.toISOString().slice(0, 10),
      qtdVinculos: vinculos.length,
      confianca: estimado ? 'ESTIMADO' : 'COMPROVADO',
      vinculos: porVinculo.map(({ cnpj, nome, tipo, remuneracao, inss, origem }) => ({ cnpj, nome, tipo, remuneracao, inss, origem })),
    };
  });

  const validos = meses.filter((m) => !m.prescrito && m.excesso > 0);
  const prescritos = meses.filter((m) => m.prescrito && m.excesso > 0);

  const porAno = {};
  for (const m of meses) {
    const ano = m.competencia.slice(0, 4);
    porAno[ano] ||= { ano, pago: 0, devido: 0, excessoRecuperavel: 0, excessoPrescrito: 0, meses: 0 };
    const a = porAno[ano];
    a.pago = r2(a.pago + m.pago);
    a.devido = r2(a.devido + m.devido);
    a.meses += 1;
    if (m.prescrito) a.excessoPrescrito = r2(a.excessoPrescrito + m.excesso);
    else a.excessoRecuperavel = r2(a.excessoRecuperavel + m.excesso);
  }

  return {
    versaoMotor: VERSAO_MOTOR,
    dataBase: dataBase.toISOString().slice(0, 10),
    recuperavel_online: r2(sum(validos.map((m) => m.excesso))),
    prejuizo_prescrito: r2(sum(prescritos.map((m) => m.excesso))),
    confianca: meses.some((m) => m.confianca === 'ESTIMADO') ? 'ESTIMADO' : 'COMPROVADO',
    consolidadoAnual: Object.values(porAno),
    meses,
    gatilhos: gatilhos(meses, dataBase),
    alertas: alertas(meses, ordenadas),
  };
}

function gatilhos(meses, dataBase) {
  const validos = meses.filter((m) => !m.prescrito && m.excesso > 0);
  const proxima = validos[0];
  const em12m = validos.filter((m) => new Date(m.vencimentoPrescricao) - dataBase < 365 * DIA);
  const multi = meses.find((m) => m.qtdVinculos >= 2 && m.excesso > 0);
  return {
    proximaCompetenciaAVencer: proxima?.competencia ?? null,
    valorAVencer: proxima?.excesso ?? 0,
    diasParaPrescrever: proxima ? Math.ceil((new Date(proxima.vencimentoPrescricao) - dataBase) / DIA) : null,
    perdaMediaMensalSemProtocolo: r2(sum(em12m.map((m) => m.excesso)) / 12),
    bitributacaoDesde: multi?.competencia ?? null,
    mesesComExcesso: validos.length,
  };
}

function alertas(meses, competencias) {
  const out = [];
  const ultima = meses.at(-1);
  const ultimaComp = competencias.at(-1);
  if (ultima && ultima.excesso > 0 && ultimaComp.vinculos.some((v) => v.ativo !== false)) {
    out.push({ tipo: 'DESCONTO_ATIVO', mensagem: `Vínculos ativos ainda descontam ~R$ ${ultima.excesso.toFixed(2)}/mês acima do teto. Gerar comunicação às fontes pagadoras para limitar o desconto.` });
  }
  if (meses.some((m) => !m.parametroConfirmado && !m.prescrito)) {
    out.push({ tipo: 'PARAMETRO_PENDENTE', mensagem: 'Há competências com teto/tabela ainda não conferidos na Portaria. Revisar antes do protocolo.' });
  }
  if (meses.some((m) => m.confianca === 'ESTIMADO' && m.excesso > 0)) {
    out.push({ tipo: 'COMPROVACAO', mensagem: 'Parte do cálculo usa estimativa do CNIS. Pedir contracheques ou informes para comprovar antes do PER/DCOMP.' });
  }
  return out;
}
