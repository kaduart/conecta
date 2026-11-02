import { useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, sessaoLead } from '../lib/api.js';
import { ArrowRight } from 'lucide-react';
import { Aviso, Icone, Tela } from '../components/ui.jsx';
import { FOTO_DOCUMENTOS } from '../lib/imagens.js';

const BLOCOS = [
  { tipo: 'CNIS', titulo: 'Extrato CNIS', ajuda: 'Baixe o PDF em 1 minuto no app Meu INSS', multiplo: false, obrigatorio: true },
  { tipo: 'INFORME', titulo: 'Informes de rendimentos', ajuda: 'PDFs de cada fonte pagadora, dos últimos 5 anos', multiplo: true, obrigatorio: true },
  { tipo: 'IRPF', titulo: 'Declarações do IRPF (opcional)', ajuda: 'Recibo ou declaração em PDF', multiplo: true, obrigatorio: false },
];
const MAX = 10 * 1024 * 1024;

function Bloco({ bloco, arquivos, onChange }) {
  const ref = useRef(null);
  const [sobre, setSobre] = useState(false); // arquivo sendo arrastado por cima
  const feito = arquivos.length > 0;
  const resumo = arquivos.length === 1 ? `${arquivos[0].name} anexado` : `${arquivos.length} arquivos anexados`;
  const soltar = (e) => {
    e.preventDefault(); setSobre(false);
    const lista = [...e.dataTransfer.files];
    if (lista.length) onChange(bloco.multiplo ? lista : lista.slice(0, 1));
  };
  const estilo = feito
    ? 'border border-esmeralda/30 bg-esmeralda/4'
    : sobre
      ? 'border border-dashed border-esmeralda/60 bg-white/70 shadow-neon'
      : 'border border-white/70 bg-white/40 hover:bg-white/70';
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
      onDragLeave={() => setSobre(false)}
      onDrop={soltar}
      onClick={() => !feito && ref.current.click()}
      className={`rounded-xl p-5 transition-all duration-300 ${feito ? '' : 'cursor-pointer'} ${estilo}`}
    >
      <input ref={ref} type="file" accept="application/pdf" multiple={bloco.multiplo} className="hidden"
        onChange={(e) => { onChange([...e.target.files]); e.target.value = ''; }} />
      <div className="flex items-center gap-4">
        <span className={`shrink-0 ${feito ? 'text-esmeralda' : 'text-esmeralda-texto/70'}`}>
          <Icone nome={feito ? 'check' : sobre ? 'subir' : 'documento'} className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{bloco.titulo}</p>
          <p className={`truncate text-sm ${feito ? 'text-esmeralda-texto' : 'apoio'}`}>{feito ? resumo : sobre ? 'Solte o PDF aqui' : bloco.ajuda}</p>
        </div>
        <button type="button" onClick={(e) => { e.stopPropagation(); feito ? onChange([]) : ref.current.click(); }}
          className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 ${feito ? 'text-apoio hover:text-grafite' : 'bg-esmeralda/10 text-esmeralda-texto hover:bg-esmeralda/15'}`}>
          {feito ? 'Remover' : 'Anexar'}
        </button>
      </div>
    </div>
  );
}

const MASCARA_FOTO = {
  maskImage: 'linear-gradient(to bottom, transparent, #000 35%, #000 60%, transparent), linear-gradient(to right, transparent, #000 22%, #000 78%, transparent)',
  WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 35%, #000 60%, transparent), linear-gradient(to right, transparent, #000 22%, #000 78%, transparent)',
  maskComposite: 'intersect',
  WebkitMaskComposite: 'source-in',
};

export default function Upload() {
  const { slug } = useParams();
  const nav = useNavigate();
  const s = sessaoLead.get();
  const [arquivos, setArquivos] = useState({ CNIS: [], INFORME: [], IRPF: [] });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [fotoOk, setFotoOk] = useState(true);
  if (!s?.leadId) return <Navigate to={`/c/${slug}`} replace />;

  const pronto = arquivos.CNIS.length > 0 && arquivos.INFORME.length > 0;

  function definir(tipo, lista) {
    const grandes = lista.filter((f) => f.size > MAX || f.type !== 'application/pdf');
    setErro(grandes.length ? 'Envie apenas PDFs de até 10 MB.' : '');
    setArquivos((a) => ({ ...a, [tipo]: lista.filter((f) => f.size <= MAX && f.type === 'application/pdf') }));
  }

  async function enviar() {
    setEnviando(true); setErro('');
    try {
      const form = new FormData();
      for (const [tipo, lista] of Object.entries(arquivos)) for (const f of lista) { form.append('arquivos', f); form.append('tipos', tipo); }
      await api.enviarDocs(s.leadId, form);
      await api.processar(s.leadId);
      nav(`/c/${slug}/processando`);
    } catch (e) { setErro(e.message); } finally { setEnviando(false); }
  }

  // Título flutuando sobre a foto, que se funde ao off-white por baixo e pelas laterais.
  const editorial = (
    <div className="relative isolate flex min-h-[460px] flex-col sm:min-h-[520px] lg:min-h-[640px]">
      <div aria-hidden className="absolute -left-10 -top-10 -z-10 h-72 w-72 rounded-full bg-esmeralda-brilho/10 blur-[120px]" />
      <div className="relative z-10 max-w-lg space-y-6">
        <h1 className="font-titulo text-4xl font-normal leading-[1.1] tracking-tight text-grafite lg:text-5xl">Três PDFs e a<br />conta está feita.</h1>
        <p className="text-base font-light leading-relaxed text-apoio lg:text-lg">O CNIS mostra quanto cada empresa recolheu por mês. Os informes confirmam os valores. O IRPF é opcional.</p>
        <a href="https://meu.inss.gov.br" target="_blank" rel="noreferrer" className="group inline-flex items-center text-sm font-medium text-esmeralda-texto transition-colors duration-200 hover:text-esmeralda">
          Como baixar o CNIS no Meu INSS
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
        </a>
      </div>
      {fotoOk && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[60%] opacity-85 lg:h-[55%]">
          {/* Máscara (e não sobreposição de cor): funde a foto ao fundo sem deixar borda de caixa. */}
          <img src={FOTO_DOCUMENTOS} alt="" onError={() => setFotoOk(false)} decoding="async" className="h-full w-full object-cover object-top" style={MASCARA_FOTO} />
        </div>
      )}
    </div>
  );

  return (
    <Tela etapa="Etapa 2 de 3" lateral={editorial}>
      <div className="space-y-4 rounded-xl border border-white/60 bg-white/40 p-6 shadow-[0_8px_32px_0_rgba(31,42,46,0.03)] backdrop-blur-xl sm:p-10">
        {BLOCOS.map((b) => <Bloco key={b.tipo} bloco={b} arquivos={arquivos[b.tipo]} onChange={(l) => definir(b.tipo, l)} />)}
        <div className="space-y-3 pt-4">
          <Aviso>{erro}</Aviso>
          <button className="btn-primario" disabled={!pronto || enviando} onClick={enviar}>{enviando ? 'Enviando com criptografia…' : 'Enviar para análise'}</button>
          {!pronto && <p className="text-center text-[14px] font-light text-apoio">Falta anexar o CNIS e os informes.</p>}
        </div>
      </div>
    </Tela>
  );
}
