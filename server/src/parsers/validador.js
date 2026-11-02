// Score de confiança da extração dos PDFs (0 a 100).
// Não decide se há crédito: só diz se a LEITURA parece confiável. Abaixo do limite,
// o lead vai para REVISAO_MANUAL e o contador confere os dados antes de abordar o cliente.

export const LIMITE_REVISAO = 70;
const MIN_REMUNERACAO = 100;        // abaixo disso quase sempre é leitura errada (ex.: pegou um índice)
const MAX_REMUNERACAO = 300000;     // acima disso também

/** Valida os dígitos verificadores do CNPJ. */
export function cnpjValido(cnpj) {
  const d = String(cnpj).replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dv = (base) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = [...base].reduce((s, n, i) => s + Number(n) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(d.slice(0, 12)) === Number(d[12]) && dv(d.slice(0, 13)) === Number(d[13]);
}

/**
 * @param {{vinculos: Array, informes?: Array, hoje?: Date}} entrada
 *   vinculos: saída do parseCnis; informes: saídas do parseInforme
 * @returns {{score:number, revisaoManual:boolean, motivos:string[]}}
 */
export function avaliarExtracao({ vinculos = [], informes = [], hoje = new Date() }) {
  const motivos = [];
  let score = 100;
  const tirar = (pontos, motivo) => { score -= pontos; motivos.push(motivo); };

  const comCompetencias = vinculos.filter((v) => Object.keys(v.competencias || {}).length > 0);
  if (!comCompetencias.length) {
    return { score: 0, revisaoManual: true, motivos: ['Nenhum vínculo com remunerações foi lido no CNIS.'] };
  }

  // 1) CNPJs dos vínculos
  const invalidos = comCompetencias.filter((v) => v.cnpj !== 'CI' && !cnpjValido(v.cnpj));
  if (invalidos.length) tirar(Math.min(30, 15 * invalidos.length), `CNPJ com dígito inválido: ${invalidos.map((v) => v.cnpj).join(', ')}.`);

  // 2) Competências e valores plausíveis
  const anoAtual = hoje.getFullYear();
  let fora = 0; let futuras = 0; let total = 0;
  for (const v of comCompetencias) {
    for (const [comp, valor] of Object.entries(v.competencias)) {
      total += 1;
      const [ano, mes] = comp.split('-').map(Number);
      if (ano > anoAtual || (ano === anoAtual && mes > hoje.getMonth() + 1 && mes !== 13) || ano < 1990 || mes < 1 || mes > 13) futuras += 1;
      if (!(valor >= MIN_REMUNERACAO && valor <= MAX_REMUNERACAO)) fora += 1;
    }
  }
  if (futuras) tirar(20, `${futuras} competência(s) com data impossível (futura ou fora de 1990–${anoAtual}).`);
  if (fora) tirar(Math.min(30, Math.ceil((fora / total) * 100)), `${fora} de ${total} remunerações fora da faixa plausível (R$ ${MIN_REMUNERACAO} a R$ ${MAX_REMUNERACAO}).`);

  // 3) Informes de rendimentos
  if (!informes.length) {
    tirar(10, 'Sem informe de rendimentos: o INSS descontado será estimado pelo CNIS.');
  }
  for (const inf of informes) {
    if (!inf.cnpj || !inf.ano || inf.inssAnual == null) { tirar(15, `Informe incompleto (CNPJ, ano ou INSS não encontrados).`); continue; }
    const vinc = comCompetencias.find((v) => v.cnpj === inf.cnpj);
    if (!vinc) { tirar(15, `Informe do CNPJ ${inf.cnpj} não corresponde a nenhum vínculo do CNIS.`); continue; }
    const remAno = Object.entries(vinc.competencias).filter(([c]) => c.startsWith(inf.ano)).reduce((s, [, r]) => s + r, 0);
    if (!remAno) { tirar(10, `Informe ${inf.ano} do CNPJ ${inf.cnpj} sem remuneração correspondente no CNIS.`); continue; }
    // INSS retido costuma ficar entre ~3% (salários altos, cota no teto) e 14% da remuneração.
    const taxa = inf.inssAnual / remAno;
    if (inf.inssAnual === 0 || taxa < 0.02 || taxa > 0.15) tirar(20, `INSS do informe ${inf.ano} (${inf.cnpj}) incoerente com a remuneração do CNIS (${(taxa * 100).toFixed(1)}%).`);
  }

  score = Math.max(0, Math.min(100, score));
  return { score, revisaoManual: score < LIMITE_REVISAO, motivos };
}
