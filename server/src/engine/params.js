// Parâmetros previdenciários por vigência.
// teto = limite máximo do salário de contribuição (Lei 8.212/91, art. 28, §5º).
// cotaMaxima = contribuição máxima do segurado empregado (tabela progressiva aplicada ao teto).
// ATENÇÃO: conferir cada vigência na Portaria Interministerial MPS/MF do ano antes de produção.
// Valores marcados confirmado:false vieram do briefing e ainda não foram conferidos.

export const PARAMS = [
  { de: '2019-01', ate: '2020-02', teto: 5839.45, faixas: null, cotaMaxima: 642.34, confirmado: false, nota: 'Antes da EC 103/2019: alíquota única por faixa (11% no teto). Usado só para prejuízo prescrito.' },
  { de: '2020-03', ate: '2020-12', teto: 6101.06, faixas: [[1045.00, 0.075], [2089.60, 0.09], [3134.40, 0.12], [6101.06, 0.14]], cotaMaxima: 713.10, confirmado: false },
  { de: '2021-01', ate: '2021-12', teto: 6433.57, faixas: [[1100.00, 0.075], [2203.48, 0.09], [3305.22, 0.12], [6433.57, 0.14]], cotaMaxima: 751.99, confirmado: true },
  { de: '2022-01', ate: '2022-12', teto: 7087.22, faixas: [[1212.00, 0.075], [2427.35, 0.09], [3641.03, 0.12], [7087.22, 0.14]], cotaMaxima: 828.38, confirmado: true },
  { de: '2023-01', ate: '2023-04', teto: 7507.49, faixas: [[1302.00, 0.075], [2571.29, 0.09], [3856.94, 0.12], [7507.49, 0.14]], cotaMaxima: 877.24, confirmado: true },
  { de: '2023-05', ate: '2023-12', teto: 7507.49, faixas: [[1320.00, 0.075], [2571.29, 0.09], [3856.94, 0.12], [7507.49, 0.14]], cotaMaxima: 876.95, confirmado: true },
  { de: '2024-01', ate: '2024-12', teto: 7786.02, faixas: [[1412.00, 0.075], [2666.68, 0.09], [4000.03, 0.12], [7786.02, 0.14]], cotaMaxima: 908.85, confirmado: true },
  { de: '2025-01', ate: '2025-12', teto: 8157.41, faixas: [[1518.00, 0.075], [2793.88, 0.09], [4190.83, 0.12], [8157.41, 0.14]], cotaMaxima: 951.62, confirmado: true },
  // 2026: só a cota máxima veio do briefing. Teto e faixas: preencher com a Portaria de jan/2026.
  { de: '2026-01', ate: '2026-12', teto: null, faixas: null, cotaMaxima: 991.43, confirmado: false },
];

export const ALIQUOTA_CI_RETIDA = 0.11; // contribuinte individual que presta serviço a PJ (Lei 10.666/2003, art. 4º)

export function paramsDe(comp) {
  const base = comp.slice(0, 7); // 13º ("2024-13") usa os parâmetros de dezembro
  const key = base.endsWith('-13') ? base.slice(0, 4) + '-12' : base;
  const p = PARAMS.find((x) => key >= x.de && key <= x.ate);
  if (!p) throw new Error(`Sem parâmetros para a competência ${comp}`);
  return p;
}
