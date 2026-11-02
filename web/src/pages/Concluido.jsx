import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { api, sessaoLead } from '../lib/api.js';
import { Aviso, Tela } from '../components/ui.jsx';

// O cliente vê só o indício; os meses e valores vão para o contador (evita oferta enganosa: CDC/LGPD).
export default function Concluido() {
  const { slug } = useParams();
  const s = sessaoLead.get();
  const [copia, setCopia] = useState(null);
  const [erro, setErro] = useState('');
  if (!s?.leadId) return <Navigate to={`/c/${slug}`} replace />;

  async function pedirCopia() {
    try { setCopia(await api.pedirCopia(s.leadId)); } catch (e) { setErro(e.message); }
  }

  const comIndicio = s.indicio !== false;
  return (
    <Tela rodape="Dados criptografados · Conforme a LGPD">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-esmeralda/15" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5"><path d="M5 12l5 5L20 7" /></svg>
      </span>
      <h1 className="titulo mt-6">Análise concluída.</h1>
      <p className="apoio mt-4 text-[17px] leading-relaxed">
        {comIndicio
          ? 'Encontramos indícios de INSS descontado acima do teto, que pode ser pedido de volta à Receita Federal.'
          : 'Não encontramos desconto acima do teto nos documentos enviados. Seu contador pode revisar com outros comprovantes.'}
      </p>

      {comIndicio && (
        <div className="mt-8 rounded-card border border-ambar/40 bg-ambar-fundo/30 p-5">
          <p className="font-semibold text-ambar-escuro">O prazo corre todo mês</p>
          <p className="mt-1 text-sm text-ambar-texto">A cada virada de mês sem pedido protocolado, a competência mais antiga deixa de poder ser recuperada.</p>
        </div>
      )}

      <p className="mt-6 text-[15px] leading-relaxed">
        O relatório com os meses e valores já está com o especialista de <strong>{s.escritorio}</strong>. Ele vai falar com você em breve pelo WhatsApp.
      </p>

      <div className="mt-auto space-y-3 pt-8">
        <Aviso>{erro}</Aviso>
        {copia ? (
          <p className="rounded-card bg-white/60 px-4 py-3 text-center text-sm">Pedido registrado. Você recebe a cópia até {copia.prazoAte.split('-').reverse().join('/')}.</p>
        ) : (
          <button className="btn-secundario" onClick={pedirCopia}>Solicitar cópia do relatório</button>
        )}
      </div>
    </Tela>
  );
}
