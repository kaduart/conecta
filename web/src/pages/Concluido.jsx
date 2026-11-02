import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { api, sessaoLead } from '../lib/api.js';
import { Aviso, Icone, Tela } from '../components/ui.jsx';
import { proximaPrescricao } from '../lib/prazo.js';

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
  const prazo = proximaPrescricao();
  return (
    <Tela rodape="Dados criptografados · Conforme a LGPD">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-esmeralda/15 text-esmeralda-texto" aria-hidden>
        <Icone nome="check" className="h-6 w-6" />
      </span>
      <h1 className="titulo mt-6">Análise concluída.</h1>
      <p className="apoio mt-4 text-[17px] leading-relaxed">
        {comIndicio
          ? 'Encontramos indícios de INSS descontado acima do teto, que pode ser pedido de volta à Receita Federal.'
          : 'Não encontramos desconto acima do teto nos documentos enviados. Seu contador pode revisar com outros comprovantes.'}
      </p>

      {comIndicio && (
        <div className="mt-8 rounded-xl border border-amber-200/40 bg-amber-50/40 p-8 text-amber-900 backdrop-blur-xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-800/70">Prazo legal</p>
          <p className="mt-3 font-titulo text-2xl leading-tight">{prazo.dias === 0 ? 'Hoje' : `Em ${prazo.dias} ${prazo.dias === 1 ? 'dia' : 'dias'}`}, {prazo.competencia} sai do prazo.</p>
          <p className="mt-2 text-sm font-light leading-relaxed text-amber-900/80">A cada dia 20, a competência mais antiga deixa de poder ser pedida de volta. A próxima vence em {prazo.vence}.</p>
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
