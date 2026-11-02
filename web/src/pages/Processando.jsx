import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, sessaoLead } from '../lib/api.js';
import { Aviso, Icone, Tela } from '../components/ui.jsx';

const ETAPAS = ['Validando a integridade dos PDFs', 'Mapeando vínculos simultâneos', 'Cruzando cada mês com o teto do ano', 'Consolidando o relatório do especialista'];

export default function Processando() {
  const { slug } = useParams();
  const nav = useNavigate();
  const s = sessaoLead.get();
  const [pct, setPct] = useState(4);
  const [erro, setErro] = useState('');

  // Barra avança sozinha até 90% e só fecha quando o servidor confirma.
  useEffect(() => {
    const t = setInterval(() => setPct((p) => (p < 90 ? p + 2 : p)), 400);
    return () => clearInterval(t);
  }, []);

  // Polling com backoff leve (2s → 6s), para no fim ou no erro.
  useEffect(() => {
    if (!s?.leadId) return undefined;
    let ativo = true; let espera = 2000;
    const tick = async () => {
      try {
        const r = await api.status(s.leadId);
        if (!ativo) return;
        if (r.status === 'CONCLUIDO' || r.status === 'CONTRATO_ENVIADO' || r.status === 'PROTOCOLADO') {
          sessaoLead.set({ indicio: r.indicio });
          setPct(100);
          setTimeout(() => nav(`/c/${slug}/concluido`), 600);
          return;
        }
        if (r.status === 'ERRO') { setErro('Não conseguimos ler o CNIS. Seu contador vai revisar o arquivo e falar com você.'); return; }
      } catch (e) { setErro(e.message); return; }
      espera = Math.min(espera * 1.3, 6000);
      setTimeout(() => ativo && tick(), espera);
    };
    tick();
    return () => { ativo = false; };
  }, [s?.leadId, slug, nav]);

  if (!s?.leadId) return <Navigate to={`/c/${slug}`} replace />;
  const atual = Math.min(ETAPAS.length - 1, Math.floor(pct / 25));

  const editorial = (
    <>
      <p className="font-titulo text-[88px] font-medium leading-none tracking-tight text-esmeralda-texto tabular-nums sm:text-[120px]">{pct}%</p>
      <h1 className="titulo mt-6 max-w-[16ch]">Analisando mês a mês as suas contribuições.</h1>
      <p className="mt-4 text-lg text-apoio">Leva de 30 a 90 segundos. Pode manter a tela aberta.</p>
    </>
  );

  return (
    <Tela etapa="Etapa 3 de 3" lateral={editorial}>
      <div className="h-[2px] w-full rounded-full bg-grafite/6">
        <div className="fio-brilho h-full rounded-full bg-esmeralda transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <ol className="vidro mt-8 space-y-5 p-8 sm:p-10">
        {ETAPAS.map((e, i) => {
          const feito = i < atual || pct === 100; const ativo = i === atual && pct < 100;
          return (
            <li key={e} className={`flex items-center gap-3 transition-opacity duration-700 ${ativo ? 'font-medium text-esmeralda-texto' : ''} ${!ativo && !feito ? 'opacity-25' : ''} ${feito ? 'opacity-45' : ''}`}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center ${feito ? 'text-esmeralda' : ''}`}>
                {feito ? <Icone nome="check" className="h-4 w-4" /> : <span className={`h-2 w-2 rounded-full ${ativo ? 'pulso bg-esmeralda' : 'bg-grafite/30'}`} />}
              </span>
              {e}
            </li>
          );
        })}
      </ol>
      <p className="mt-6 px-2 text-[14px] font-light leading-relaxed text-apoio">O prazo de 5 anos conta da data de cada pagamento. O que já passou dele não entra no pedido.</p>
      <div className="mt-4"><Aviso>{erro}</Aviso></div>
    </Tela>
  );
}
