export const brl = (v) => (v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
export const brlCurto = (v) => (v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const mesAno = (c) => {
  if (!c) return '—';
  const [a, m] = c.split('-');
  return m === '13' ? `13º/${a}` : `${MESES[Number(m) - 1]}/${a}`;
};
export const dataBr = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');
export const linkWhatsApp = (numero, texto) => `https://wa.me/${String(numero).replace(/\D/g, '')}?text=${encodeURIComponent(texto || '')}`;
