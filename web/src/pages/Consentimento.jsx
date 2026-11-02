import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, sessaoLead } from '../lib/api.js';
import { Aviso, Icone, Tela } from '../components/ui.jsx';

export default function Consentimento() {
  const { slug } = useParams();
  const nav = useNavigate();
  const s = sessaoLead.get();
  const [aceito, setAceito] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  if (!s?.leadId) return <Navigate to={`/c/${slug}`} replace />;

  const itens = [
    ['olho', 'Só o seu contador vê', `Compartilhado apenas com ${s.escritorio}.`],
    ['relogio', 'Arquivos apagados em 30 dias', 'Descarte seguro depois da análise.'],
    ['escudo', 'Seus direitos garantidos', 'Cópia, correção ou exclusão quando quiser (LGPD, art. 18).'],
  ];

  async function continuar() {
    setEnviando(true); setErro('');
    try {
      await api.consentir(s.leadId, { aceito: true });
      nav(`/c/${slug}/documentos`);
    } catch (e) { setErro(e.message); } finally { setEnviando(false); }
  }

  const editorial = (
    <>
      <h1 className="titulo-hero max-w-[16ch]">Seus documentos servem a uma coisa só.</h1>
      <p className="mt-5 max-w-[44ch] text-lg leading-relaxed text-apoio">Calcular o INSS pago acima do teto e os ajustes no seu IRPF. Nada além disso.</p>
      <ul className="vidro mt-10 space-y-6 p-8 sm:p-10">
        {itens.map(([icone, t, d]) => (
          <li key={t} className="flex gap-4">
            <span className="mt-0.5 text-esmeralda-texto"><Icone nome={icone} className="h-6 w-6" /></span>
            <div><p className="font-semibold">{t}</p><p className="mt-0.5 text-[15px] leading-relaxed text-apoio">{d}</p></div>
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <Tela etapa="Etapa 1 de 3" lateral={editorial}>
      <div className="card-acao space-y-6 p-7 sm:p-10">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 rounded-sm accent-esmeralda" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
          <span className="text-[16px] leading-snug">Li e autorizo o uso dos meus documentos para a análise tributária.</span>
        </label>
        <Aviso>{erro}</Aviso>
        <button className="btn-primario" disabled={!aceito || enviando} onClick={continuar}>{enviando ? 'Registrando…' : 'Autorizar e continuar'}</button>
        <p className="text-center text-[14px] font-light text-apoio">Você pode pedir cópia ou exclusão dos dados a qualquer momento. <a className="link" href="/privacidade" target="_blank" rel="noreferrer">Política de privacidade</a></p>
      </div>
    </Tela>
  );
}
