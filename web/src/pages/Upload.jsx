import { useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, sessaoLead } from '../lib/api.js';
import { Aviso, Icone, Tela } from '../components/ui.jsx';

const BLOCOS = [
  { tipo: 'CNIS', titulo: 'Extrato CNIS', ajuda: 'Baixe o PDF em 1 minuto no app Meu INSS', multiplo: false, obrigatorio: true },
  { tipo: 'INFORME', titulo: 'Informes de rendimentos', ajuda: 'PDFs de cada fonte pagadora, dos últimos 5 anos', multiplo: true, obrigatorio: true },
  { tipo: 'IRPF', titulo: 'Declarações do IRPF · opcional', ajuda: 'Recibo ou declaração em PDF', multiplo: true, obrigatorio: false },
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
    ? 'border border-esmeralda/30 bg-esmeralda/[0.04]'
    : sobre
      ? 'border border-dashed border-esmeralda/60 bg-white/70 shadow-neon'
      : 'border border-dashed border-emerald-500/20 bg-white/10 hover:border-esmeralda/40 hover:bg-white/50';
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

export default function Upload() {
  const { slug } = useParams();
  const nav = useNavigate();
  const s = sessaoLead.get();
  const [arquivos, setArquivos] = useState({ CNIS: [], INFORME: [], IRPF: [] });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
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

  return (
    <Tela etapa="2 de 3">
      <h1 className="titulo">Três documentos, poucos minutos.</h1>
      <p className="apoio mt-4 text-[17px]">Toque em cada área ou arraste o PDF até ela.</p>
      <div className="cartao mt-8 space-y-4 p-6 sm:p-10">
        {BLOCOS.map((b) => <Bloco key={b.tipo} bloco={b} arquivos={arquivos[b.tipo]} onChange={(l) => definir(b.tipo, l)} />)}
      </div>
      <div className="mt-auto space-y-3 pt-8">
        <Aviso>{erro}</Aviso>
        <button className="btn-primario" disabled={!pronto || enviando} onClick={enviar}>{enviando ? 'Enviando com criptografia…' : 'Enviar para processamento'}</button>
        {!pronto && <p className="text-center text-xs font-light text-sutil">Anexe o CNIS e os informes</p>}
        <p className="text-center"><a className="link text-sm" href="https://meu.inss.gov.br" target="_blank" rel="noreferrer">Como baixar o CNIS no Meu INSS</a></p>
      </div>
    </Tela>
  );
}
