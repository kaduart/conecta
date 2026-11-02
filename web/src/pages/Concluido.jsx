import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { api, sessaoLead } from '../lib/api.js';
import { Aviso, Icone, Tela } from '../components/ui.jsx';
import { proximaPrescricao } from '../lib/prazo.js';
import Regua from '../components/Regua.jsx';

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
  const quando = prazo.dias === 0 ? 'Hoje' : `Em ${prazo.dias} ${prazo.dias === 1 ? 'dia' : 'dias'}`;

  const editorial = (
    <>
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-esmeralda/15 text-esmeralda-texto" aria-hidden>
        <Icone nome="check" className="h-6 w-6" />
      </span>
      <h1 className="titulo-hero mt-6 max-w-[14ch]">{comIndicio ? 'Há indício de INSS a recuperar.' : 'Análise concluída.'}</h1>
      <p className="mt-5 max-w-[44ch] text-lg leading-relaxed text-apoio">
        {comIndicio
          ? 'Encontramos meses com desconto acima do teto. Esse valor pode ser pedido de volta à Receita Federal.'
          : 'Não encontramos desconto acima do teto nos documentos enviados. Seu contador pode revisar com outros comprovantes.'}
      </p>
      {comIndicio && (
        <div className="mt-10 rounded-xl border border-amber-200/40 bg-amber-50/40 p-8 text-amber-900 backdrop-blur-xl sm:p-10">
          <p className="font-titulo text-[28px] font-medium leading-tight">{quando}, {prazo.competencia} sai do prazo.</p>
          <p className="mt-2 text-[15px] leading-relaxed text-amber-900/80">Todo dia 20, o mês mais antigo deixa de poder ser pedido de volta.</p>
          <Regua className="mt-8" compacta />
        </div>
      )}
    </>
  );

  return (
    <Tela lateral={editorial} rodape="Seus dados ficam criptografados e seguem a LGPD.">
      <div className="cartao space-y-5 p-7 sm:p-10">
        <h2 className="font-titulo text-2xl font-medium">Próximo passo</h2>
        <p className="text-[16px] leading-relaxed">
          O relatório com os meses e valores já está com <strong>{s.escritorio}</strong>. O especialista vai falar com você pelo WhatsApp.
        </p>
        <Aviso>{erro}</Aviso>
        {copia ? (
          <p className="rounded-xl bg-esmeralda/6 px-4 py-3 text-[15px] text-esmeralda-texto">Pedido registrado. Você recebe a cópia até {copia.prazoAte.split('-').reverse().join('/')}.</p>
        ) : (
          <button className="btn-secundario border border-grafite/10" onClick={pedirCopia}>Pedir cópia do relatório</button>
        )}
      </div>
    </Tela>
  );
}
