// Extração de dados dos PDFs. As regex são heurísticas: calibrar com PDFs reais
// (o layout do CNIS do Meu INSS e dos informes varia por emissor). Sempre que a
// extração falhar ou vier incompleta, o lead cai na fila de revisão manual do painel.

const num = (s) => Number(s.replace(/\./g, '').replace(',', '.'));
const RE_CNPJ = /\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/;
const RE_COMP_VALOR = /\b(0[1-9]|1[0-3])\/(\d{4})\s+(?:R\$\s*)?([\d.]+,\d{2})/g;

export async function textoDoPdf(buffer) {
  const { default: pdf } = await import('pdf-parse/lib/pdf-parse.js'); // lazy: evita carregar em testes
  const { text } = await pdf(buffer);
  return text;
}

/** CNIS (Extrato de Contribuição) -> vínculos com remuneração mês a mês */
export function parseCnis(texto) {
  const linhas = texto.split(/\r?\n/);
  const vinculos = [];
  let atual = null;
  for (const linha of linhas) {
    const cnpj = linha.match(RE_CNPJ);
    const ehCi = /contribuinte individual|cooperativa|prestador de servi/i.test(linha);
    if (cnpj || (ehCi && !atual?.ci)) {
      atual = {
        cnpj: cnpj ? cnpj[1] : 'CI',
        nome: linha.replace(RE_CNPJ, '').replace(/\s+/g, ' ').trim().slice(0, 80),
        tipo: ehCi ? 'CI' : 'EMPREGADO',
        ativo: true,
        competencias: {},
      };
      vinculos.push(atual);
      continue;
    }
    if (!atual) continue;
    if (/data fim|rescis/i.test(linha) && /\d{2}\/\d{2}\/\d{4}/.test(linha)) atual.ativo = false;
    for (const m of linha.matchAll(RE_COMP_VALOR)) {
      const comp = `${m[2]}-${m[1]}`;
      atual.competencias[comp] = (atual.competencias[comp] || 0) + num(m[3]);
    }
  }
  return vinculos.filter((v) => Object.keys(v.competencias).length > 0);
}

/** Informe de rendimentos -> INSS retido no ano por fonte pagadora */
export function parseInforme(texto) {
  const cnpj = texto.match(RE_CNPJ)?.[1] ?? null;
  const ano = texto.match(/ano[- ]calend[áa]rio\D{0,10}(\d{4})/i)?.[1] ?? null;
  const inss = texto.match(/contribui[çc][ãa]o previdenci[áa]ria oficial\D{0,40}([\d.]+,\d{2})/i)?.[1];
  return { cnpj, ano, inssAnual: inss ? num(inss) : null };
}

/**
 * Junta CNIS + informes no formato do motor.
 * Informe anual é rateado pelos meses do CNIS proporcionalmente à remuneração.
 */
export function normalizar(vinculosCnis, informes = []) {
  const porComp = new Map();
  for (const v of vinculosCnis) {
    const comps = Object.entries(v.competencias);
    const porAno = {};
    for (const [comp, rem] of comps) (porAno[comp.slice(0, 4)] ||= []).push([comp, rem]);

    for (const [ano, lista] of Object.entries(porAno)) {
      const inf = informes.find((i) => i.cnpj === v.cnpj && i.ano === ano && i.inssAnual != null);
      const remAno = lista.reduce((s, [, r]) => s + r, 0);
      for (const [comp, rem] of lista) {
        const item = { cnpj: v.cnpj, nome: v.nome, tipo: v.tipo, remuneracao: rem, ativo: v.ativo };
        if (inf && remAno > 0) {
          item.inssDescontado = Math.round((inf.inssAnual * rem / remAno) * 100) / 100;
          item.origemInss = 'INFORME_RATEADO';
        }
        if (!porComp.has(comp)) porComp.set(comp, []);
        porComp.get(comp).push(item);
      }
    }
  }
  return [...porComp.entries()].map(([competencia, vinculos]) => ({ competencia, vinculos }));
}
