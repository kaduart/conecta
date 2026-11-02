// Planilha de apoio ao preenchimento do PER/DCOMP Web (não é layout oficial de importação).
export function perdcompCsv(relatorio) {
  const linhas = [['competencia', 'teto', 'valor_pago', 'valor_devido', 'excesso', 'vencimento_prescricao', 'confianca', 'fontes']];
  for (const m of relatorio.meses || []) {
    if (m.prescrito || !(m.excesso > 0)) continue;
    const fontes = (m.vinculos || []).map((v) => `${v.cnpj}:${v.inss}`).join(' | ');
    linhas.push([m.competencia, m.teto ?? '', m.pago, m.devido, m.excesso, m.vencimentoPrescricao, m.confianca, fontes]);
  }
  const fmt = (v) => (typeof v === 'number' ? v.toFixed(2).replace('.', ',') : `"${String(v).replace(/"/g, '""')}"`);
  return '﻿' + linhas.map((l, i) => (i === 0 ? l.join(';') : l.map(fmt).join(';'))).join('\n');
}
