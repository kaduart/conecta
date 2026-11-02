// Prescrição: 5 anos contados do pagamento, que vence no dia 20 do mês seguinte à competência.
// Logo, no dia 20 de cada mês vence a competência de (mês anterior, 5 anos atrás).
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function hojeSP() {
  const [a, m, d] = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

/** Próxima competência que sai do prazo: { competencia: 'out/2021', vence: '20/11/2026', dias: 18 } */
export function proximaPrescricao(hoje = hojeSP()) {
  let ano = hoje.getUTCFullYear(); let mes = hoje.getUTCMonth(); // 0-11
  if (hoje.getUTCDate() > 20) { mes += 1; if (mes > 11) { mes = 0; ano += 1; } }
  const vence = new Date(Date.UTC(ano, mes, 20));
  const comp = new Date(Date.UTC(ano - 5, mes - 1, 1));
  const dias = Math.round((vence - hoje) / 86400000);
  const dd = (n) => String(n).padStart(2, '0');
  return {
    competencia: `${MESES[comp.getUTCMonth()]}/${comp.getUTCFullYear()}`,
    vence: `${dd(20)}/${dd(mes + 1)}/${ano}`,
    dias,
  };
}

/**
 * Régua dos 60 meses ainda recuperáveis, do mais antigo (o próximo a sair do prazo) ao mais recente pago.
 * Cada item: { rotulo: 'out/2021', ano: 2021 }.
 */
export function reguaMeses(hoje = hojeSP()) {
  const { competencia } = proximaPrescricao(hoje);
  const [m, a] = competencia.split('/');
  let mes = MESES.indexOf(m); let ano = Number(a);
  const lista = [];
  for (let i = 0; i < 60; i += 1) {
    lista.push({ rotulo: `${MESES[mes]}/${ano}`, ano, mes });
    mes += 1; if (mes > 11) { mes = 0; ano += 1; }
  }
  return lista;
}
