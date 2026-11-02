/** Design system RECUPERA: off-white, grafite, esmeralda só para ação, âmbar só para prazo. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        papel: '#F7F5F0',
        grafite: '#1F2A2E',
        apoio: '#5C666A',
        sutil: '#7A8386',
        esmeralda: { DEFAULT: '#10B981', texto: '#047857', escuro: '#065F46', tinta: '#10302A', brilho: '#6EE7B7' },
        ambar: { DEFAULT: '#D97706', texto: '#92400E', escuro: '#78350F', fundo: '#FEF3C7' },
      },
      fontFamily: {
        titulo: ['"Playfair Display"', 'Georgia', 'serif'],
        corpo: ['Figtree', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: { card: '12px' },
      boxShadow: {
        vidro: '0 8px 32px rgba(31,42,46,0.04)',
        acao: '0 25px 50px -12px rgba(31,42,46,0.08)',
        neon: '0 0 0 4px rgba(16,185,129,0.08), 0 0 28px rgba(16,185,129,0.22)',
      },
    },
  },
  plugins: [],
};
