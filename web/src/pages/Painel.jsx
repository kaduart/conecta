import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { brlCurto } from '../lib/formato.js';
import PainelLayout from '../components/PainelLayout.jsx';
import { Aviso, Carregando } from '../components/ui.jsx';

const STATUS = { QUALIFICADO: 'Cadastro', CONSENTIU: 'Consentiu', DOCUMENTOS: 'Documentos', PROCESSANDO: 'Processando', CONCLUIDO: 'Pronto para contato', ERRO: 'Revisão manual', CONTRATO_ENVIADO: 'Contrato enviado', PROTOCOLADO: 'Protocolado' };

function Prazo({ dias }) {
  if (dias == null) return <span className="font-light text-sutil">—</span>;
  const urgente = dias <= 60;
  return <span className={urgente ? 'font-semibold text-ambar-texto' : 'font-light'}>{dias} dias</span>;
}

export default function Painel() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => { api.analises().then(setDados).catch((e) => setErro(e.message)); }, []);

  const itens = dados?.itens || [];
  const urgentes = itens.filter((i) => i.diasParaPrescrever != null && i.diasParaPrescrever <= 30).length;
  const aguardando = itens.filter((i) => i.status === 'CONCLUIDO').length;

  return (
    <PainelLayout>
      <h1 className="font-titulo text-[36px] leading-tight">Análises</h1>
      <Aviso>{erro}</Aviso>
      {!dados && !erro && <Carregando />}
      {dados && (
        <>
          <section className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
            <Kpi valor={dados.totais.recuperavel} formato={brlCurto} rotulo="Recuperável não prescrito" destaque />
            <Kpi valor={urgentes} rotulo="Vencem em até 30 dias" ambar={urgentes > 0} />
            <Kpi valor={aguardando} rotulo="Aguardando seu contato" />
            <Kpi valor={dados.totais.leads} rotulo="Clientes no funil" />
          </section>

          {/* Mobile: cartões. Desktop: tabela. */}
          <ul className="mt-10 space-y-3 md:hidden">
            {itens.map((i) => (
              <li key={i.id}>
                <Link to={`/painel/${i.id}`} className="vidro block p-5 transition-all duration-300 hover:bg-white/60">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate font-semibold">{i.nome}</p><p className="apoio text-sm">{i.profissao}</p></div>
                    <p className="font-bold text-esmeralda-texto">{brlCurto(i.recuperavelOnline)}</p>
                  </div>
                  <div className="mt-3 flex justify-between text-sm"><span className="apoio">{STATUS[i.status]}</span><Prazo dias={i.diasParaPrescrever} /></div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="vidro mt-10 hidden overflow-x-auto p-2 md:block">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-apoio">
                <tr>{['Cliente', 'Recuperável', 'Já prescrito', 'Próximo vencimento', 'Confiança', 'Status', ''].map((h) => <th key={h} className="px-5 pb-3 pt-5 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {itens.map((i, n) => (
                  <tr key={i.id} className={`transition-colors duration-300 hover:bg-white/50 ${n % 2 === 0 ? 'bg-white/20' : ''}`}>
                    <td className="px-5 py-6"><p className="font-semibold">{i.nome}</p><p className="apoio">{i.profissao}</p></td>
                    <td className="px-5 py-6 font-bold text-esmeralda-texto">{brlCurto(i.recuperavelOnline)}</td>
                    <td className="px-5 py-6 font-light text-sutil">{brlCurto(i.prejuizoPrescrito)}</td>
                    <td className="px-5 py-6"><Prazo dias={i.diasParaPrescrever} /></td>
                    <td className="px-5 py-6 font-light">{i.confianca === 'COMPROVADO' ? 'Comprovado' : i.confianca ? 'Estimado' : '—'}</td>
                    <td className="px-5 py-6 font-light">{STATUS[i.status]}{i.copiaPendente && <span className="ml-2 rounded bg-ambar-fundo px-1.5 py-0.5 text-xs text-ambar-texto">cópia LGPD</span>}</td>
                    <td className="px-5 py-6 text-right"><Link className="link" to={`/painel/${i.id}`}>Abrir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!itens.length && <p className="apoio mt-10 text-center">Nenhum cliente ainda. Compartilhe seu convite para começar.</p>}
        </>
      )}
    </PainelLayout>
  );
}

// Número solto na tela (sem caixa), que sobe de 0 até o valor no carregamento.
function Kpi({ valor, formato = (v) => String(Math.round(v)), rotulo, destaque, ambar }) {
  const animado = useContagem(valor ?? 0);
  return (
    <div>
      <p className={`font-corpo text-4xl font-bold tracking-tight tabular-nums sm:text-5xl ${destaque ? 'text-esmeralda-texto' : ambar ? 'text-amber-800' : 'text-grafite'}`}>
        {formato(animado)}
      </p>
      <p className="apoio mt-2 text-sm">{rotulo}</p>
    </div>
  );
}

function useContagem(alvo, ms = 1200) {
  const [v, setV] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(alvo); return undefined; }
    const inicio = performance.now();
    const passo = (t) => {
      const p = Math.min(1, (t - inicio) / ms);
      setV(alvo * (1 - (1 - p) ** 3)); // ease-out cúbico
      if (p < 1) raf.current = requestAnimationFrame(passo);
    };
    raf.current = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf.current);
  }, [alvo, ms]);
  return v;
}
