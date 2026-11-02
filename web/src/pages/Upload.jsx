import { useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, sessaoLead } from '../lib/api.js';
import { Aviso, Tela } from '../components/ui.jsx';

const BLOCOS = [
  { tipo: 'CNIS', titulo: 'Extrato CNIS', ajuda: 'Baixe o PDF em 1 minuto no app Meu INSS', multiplo: false, obrigatorio: true },
  { tipo: 'INFORME', titulo: 'Informes de rendimentos', ajuda: 'PDFs de cada fonte pagadora, dos últimos 5 anos', multiplo: true, obrigatorio: true },
  { tipo: 'IRPF', titulo: 'Declarações do IRPF · opcional', ajuda: 'Recibo ou declaração em PDF', multiplo: true, obrigatorio: false },
];
const MAX = 10 * 1024 * 1024;

function Bloco({ bloco, arquivos, onChange }) {
  const ref = useRef(null);
  const feito = arquivos.length > 0;
  const resumo = arquivos.length === 1 ? `${arquivos[0].name} anexado` : `${arquivos.length} arquivos anexados`;
  return (
    <div className={`rounded-card p-5 transition ${feito ? 'cartao' : 'border border-dashed border-esmeralda/20 bg-white/10 hover:bg-white/50 hover:shadow-neon'}`}>
      <input ref={ref} type="file" accept="application/pdf" multiple={bloco.multiplo} className="hidden"
        onChange={(e) => { onChange([...e.target.files]); e.target.value = ''; }} />
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold">{bloco.titulo}</p>
          <p className={`truncate text-sm ${feito ? 'text-esmeralda-texto' : 'apoio'}`}>{feito ? resumo : bloco.ajuda}</p>
        </div>
        <button type="button" onClick={() => (feito ? onChange([]) : ref.current.click())}
          className={`shrink-0 rounded-card px-4 py-2.5 text-sm font-semibold ${feito ? 'text-apoio hover:text-grafite' : 'bg-esmeralda/10 text-esmeralda-texto'}`}>
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
      <p className="apoio mt-4 text-[17px]">Toque em cada área para anexar.</p>
      <div className="mt-8 space-y-3">
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
