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

  return (
    <Tela etapa="1 de 3">
      <h1 className="titulo">Seus dados, com uma única finalidade.</h1>
      <p className="apoio mt-4 text-[17px]">Análise do seu crédito de INSS acima do teto e ajustes no IRPF. Nada além disso.</p>

      <ul className="vidro mt-8 space-y-6 p-8 sm:p-10">
        {itens.map(([icone, t, d]) => (
          <li key={t} className="flex gap-4">
            <span className="mt-0.5 text-esmeralda-texto"><Icone nome={icone} className="h-6 w-6" /></span>
            <div><p className="font-semibold">{t}</p><p className="apoio mt-0.5 text-sm leading-relaxed">{d}</p></div>
          </li>
        ))}
      </ul>

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-card p-1">
        <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 accent-esmeralda" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
        <span className="text-[15px] leading-snug">Li e autorizo o processamento dos meus documentos para fins de auditoria tributária.</span>
      </label>

      <div className="mt-auto space-y-3 pt-8">
        <Aviso>{erro}</Aviso>
        <button className="btn-primario" disabled={!aceito || enviando} onClick={continuar}>{enviando ? 'Registrando…' : 'Continuar'}</button>
        {!aceito && <p className="text-center text-xs font-light text-sutil">Marque a autorização para continuar</p>}
        <p className="text-center"><a className="link text-sm" href="/privacidade" target="_blank" rel="noreferrer">Política de Privacidade completa</a></p>
      </div>
    </Tela>
  );
}
