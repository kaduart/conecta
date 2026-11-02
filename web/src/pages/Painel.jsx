import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { Search, MessageCircle, ChevronRight, FileWarning } from 'lucide-react';
import { api, sessaoContador } from '../lib/api.js';
import { brl, brlCurto, dataBr, linkWhatsApp } from '../lib/formato.js';
import { proximaPrescricao } from '../lib/prazo.js';
import PainelLayout from '../components/PainelLayout.jsx';
import { Aviso, Carregando } from '../components/ui.jsx';

// Painel do escritório: a carteira inteira numa tela. Resumo, funil, o que vence agora e a lista filtrável.

const ETAPAS = [
  { k: 'entrada', t: 'Entrada', status: ['QUALIFICADO', 'CONSENTIU'] },
  { k: 'documentos', t: 'Documentos', c: 'Docs', status: ['DOCUMENTOS', 'PROCESSANDO'] },
  { k: 'contatar', t: 'A contatar', c: 'Contatar', status: ['CONCLUIDO'] },
  { k: 'contrato', t: 'Contrato enviado', c: 'Contrato', status: ['CONTRATO_ENVIADO'] },
  { k: 'protocolado', t: 'Protocolado', c: 'Protoc.', status: ['PROTOCOLADO'] },
];
const REVISAO = ['ERRO'];
const STATUS = { QUALIFICADO: 'Cadastro', CONSENTIU: 'Autorizou', DOCUMENTOS: 'Enviando PDFs', PROCESSANDO: 'Calculando', CONCLUIDO: 'A contatar', ERRO: 'Revisão manual', CONTRATO_ENVIADO: 'Contrato enviado', PROTOCOLADO: 'Protocolado' };
const ORDENS = [['valor', 'Maior valor'], ['prazo', 'Prazo mais curto'], ['recentes', 'Mais recentes']];

const iniciais = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const etapaDe = (s) => ETAPAS.find((e) => e.status.includes(s))?.k || (REVISAO.includes(s) ? 'revisao' : 'entrada');

export default function Painel() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [etapa, setEtapa] = useState('todas');
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState('valor');
  useEffect(() => { api.analises().then(setDados).catch((e) => setErro(e.message)); }, []);

  const itens = dados?.itens || [];
  const prox = proximaPrescricao();
  const comExcessoAVencer = itens.filter((i) => i.valorAVencer > 0 && ['CONCLUIDO', 'CONTRATO_ENVIADO'].includes(i.status));
  const somaAVencer = comExcessoAVencer.reduce((s, i) => s + i.valorAVencer, 0);
  const prescrito = itens.reduce((s, i) => s + (i.prejuizoPrescrito || 0), 0);
  const aContatar = itens.filter((i) => i.status === 'CONCLUIDO');
  const contagem = Object.fromEntries([...ETAPAS.map((e) => [e.k, 0]), ['revisao', 0]]);
  itens.forEach((i) => { contagem[etapaDe(i.status)] += 1; });

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const f = itens.filter((i) => (etapa === 'todas' || etapaDe(i.status) === etapa) && (!q || `${i.nome} ${i.profissao}`.toLowerCase().includes(q)));
    const nulo = (v, alto) => (v == null ? alto : v);
    if (ordem === 'prazo') return [...f].sort((a, b) => nulo(a.diasParaPrescrever, 1e9) - nulo(b.diasParaPrescrever, 1e9) || nulo(b.recuperavelOnline, -1) - nulo(a.recuperavelOnline, -1));
    if (ordem === 'recentes') return [...f].sort((a, b) => String(b.atualizadoEm).localeCompare(String(a.atualizadoEm)));
    return [...f].sort((a, b) => nulo(b.recuperavelOnline, -1) - nulo(a.recuperavelOnline, -1));
  }, [itens, etapa, busca, ordem]);
  const maior = Math.max(...itens.map((i) => (i.recuperavelOnline || 0) + (i.prejuizoPrescrito || 0)), 1);

  return (
    <PainelLayout>
      <MotionConfig reducedMotion="user">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="titulo">Carteira</h1>
            <p className="apoio mt-2">{sessaoContador.get()?.escritorio} · posição de {dataBr(new Date().toISOString())}</p>
          </div>
        </div>
        <Aviso>{erro}</Aviso>
        {!dados && !erro && <Carregando />}

        {dados && (
          <div className="mt-8 space-y-10">
            {/* O que vence agora: a única faixa âmbar da tela */}
            {comExcessoAVencer.length > 0 && (
              <section className="flex flex-col gap-4 rounded-xl border border-amber-200/70 bg-amber-50/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <p className="font-semibold text-amber-900">Em {prox.dias} dias, {prox.competencia} sai do prazo.</p>
                  <p className="mt-1 text-[15px] text-amber-900/80">
                    {comExcessoAVencer.length} {comExcessoAVencer.length === 1 ? 'cliente ainda não protocolado perde' : 'clientes ainda não protocolados perdem'} {brl(somaAVencer)} no dia {prox.vence}.
                  </p>
                </div>
                <button onClick={() => { setEtapa('todas'); setOrdem('prazo'); document.getElementById('lista')?.scrollIntoView({ behavior: 'smooth' }); }}
                  className="shrink-0 rounded-xl bg-amber-900 px-4 py-3 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-950">
                  Ver por prazo
                </button>
              </section>
            )}

            {/* Resumo */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi rotulo="Recuperável na carteira" valor={dados.totais.recuperavel} formato={brlCurto} nota="não prescrito, sem Selic" solido />
              <Kpi rotulo="A contatar" valor={aContatar.length} nota={aContatar.length ? `${brlCurto(aContatar.reduce((s, i) => s + (i.recuperavelOnline || 0), 0))} em análises prontas` : 'nenhuma análise parada'} />
              <Kpi rotulo="Clientes" valor={dados.totais.leads} nota={`${contagem.protocolado} protocolado${contagem.protocolado === 1 ? '' : 's'}`} />
              <Kpi rotulo="Já perdido por prazo" valor={prescrito} formato={brlCurto} nota="excesso que prescreveu" apagado />
            </section>

            {/* Funil: cada etapa é um filtro */}
            <section>
              <h2 className="font-titulo text-2xl font-medium">Funil</h2>
              <div className="vidro mt-4 p-2">
                <div className="grid grid-cols-5 items-start gap-1">
                  {ETAPAS.map((e) => {
                    const ativo = etapa === e.k;
                    return (
                      <button key={e.k} onClick={() => setEtapa(ativo ? 'todas' : e.k)}
                        className={`relative rounded-lg px-2 py-3 text-left sm:px-4 sm:py-4 transition-colors duration-300 ${ativo ? '' : 'hover:bg-white/40'}`}>
                        {ativo && <motion.span layoutId="etapa-ativa" className="absolute inset-0 rounded-lg bg-white shadow-[0_8px_24px_-12px_rgba(31,42,46,0.25)]" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
                        <span className="relative block text-xl font-bold tabular-nums sm:text-3xl">{contagem[e.k]}</span>
                        <span className={`relative mt-1 block text-[11px] leading-tight sm:text-sm ${e.k === 'contatar' && contagem[e.k] ? 'font-semibold text-esmeralda-texto' : 'text-apoio'}`}><span className="sm:hidden">{e.c || e.t}</span><span className="hidden sm:inline">{e.t}</span></span>
                      </button>
                    );
                  })}
                </div>
                <Fluxo contagem={contagem} total={itens.length} />
              </div>
              {contagem.revisao > 0 && (
                <button onClick={() => setEtapa(etapa === 'revisao' ? 'todas' : 'revisao')} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-red-800">
                  <FileWarning className="h-4 w-4" strokeWidth={1.5} /> {contagem.revisao} em revisão manual: o PDF não foi lido com segurança
                </button>
              )}
            </section>

            {/* Lista */}
            <section id="lista" className="scroll-mt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-titulo text-2xl font-medium">
                  Clientes{etapa !== 'todas' && <span className="text-apoio"> · {ETAPAS.find((e) => e.k === etapa)?.t || 'Revisão manual'}</span>}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="vidro flex w-full items-center gap-2 px-3 py-2 sm:w-auto">
                    <Search className="h-4 w-4 text-sutil" strokeWidth={1.5} />
                    <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome ou profissão" className="w-full bg-transparent text-[15px] outline-hidden sm:w-52" />
                  </label>
                  <div className="vidro flex p-1">
                    {ORDENS.map(([k, t]) => (
                      <button key={k} onClick={() => setOrdem(k)} className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${ordem === k ? 'bg-grafite text-white' : 'text-apoio hover:text-grafite'}`}>{t}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Desktop */}
              <div className="vidro mt-4 hidden overflow-hidden md:block">
                <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_150px_minmax(0,1.5fr)_88px] gap-4 px-6 pb-3 pt-5 text-sm text-apoio">
                  <span>Cliente</span><span>Recuperável · prescrito</span><span>Prazo</span><span>Situação</span><span />
                </div>
                <motion.ul layout>
                  <AnimatePresence initial={false}>
                    {lista.map((i, n) => (
                      <motion.li key={i.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                        className={`group grid grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_150px_minmax(0,1.5fr)_88px] items-center gap-4 px-6 py-4 transition-colors hover:bg-white/50 ${n % 2 === 0 ? 'bg-white/20' : ''}`}>
                        <Link to={`/painel/${i.id}`} className="flex min-w-0 items-center gap-3">
                          <Avatar nome={i.nome} />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{i.nome}</span>
                            <span className="block truncate text-sm text-apoio">{i.profissao} · {dataBr(i.atualizadoEm)}</span>
                          </span>
                        </Link>
                        <Valor i={i} maior={maior} />
                        <span><Prazo i={i} /></span>
                        <span className="flex flex-wrap items-center gap-1.5"><Situacao i={i} /></span>
                        <span className="flex items-center justify-end gap-1">
                          {i.whatsapp && <a href={linkWhatsApp(i.whatsapp, `Olá, ${i.nome.split(' ')[0]}!`)} target="_blank" rel="noreferrer" title="Chamar no WhatsApp" className="rounded-lg p-2 text-apoio transition-colors hover:bg-esmeralda/10 hover:text-esmeralda-texto"><MessageCircle className="h-[18px] w-[18px]" strokeWidth={1.5} /></a>}
                          <Link to={`/painel/${i.id}`} title="Abrir análise" className="rounded-lg p-2 text-apoio transition-colors hover:bg-white hover:text-grafite"><ChevronRight className="h-[18px] w-[18px]" strokeWidth={1.5} /></Link>
                        </span>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </motion.ul>
                {!lista.length && <Vazio filtro={etapa !== 'todas' || busca} />}
              </div>

              {/* Celular */}
              <ul className="mt-4 space-y-2 md:hidden">
                {lista.map((i) => (
                  <li key={i.id}>
                    <Link to={`/painel/${i.id}`} className="vidro block p-4 transition-colors hover:bg-white/60">
                      <div className="flex items-center gap-3">
                        <Avatar nome={i.nome} />
                        <div className="min-w-0 flex-1"><p className="truncate font-semibold">{i.nome}</p><p className="truncate text-sm text-apoio">{i.profissao}</p></div>
                        <p className="font-bold tabular-nums text-esmeralda-texto">{brlCurto(i.recuperavelOnline)}</p>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5"><Situacao i={i} /><Prazo i={i} /></div>
                    </Link>
                  </li>
                ))}
                {!lista.length && <li className="vidro"><Vazio filtro={etapa !== 'todas' || busca} /></li>}
              </ul>
            </section>
          </div>
        )}
      </MotionConfig>
    </PainelLayout>
  );
}

// Faixa contínua com a proporção de clientes em cada etapa.
function Fluxo({ contagem, total }) {
  if (!total) return null;
  const cores = { entrada: 'bg-grafite/15', documentos: 'bg-grafite/30', contatar: 'bg-esmeralda', contrato: 'bg-esmeralda-escuro/70', protocolado: 'bg-esmeralda-escuro' };
  return (
    <div className="mx-2 mb-2 mt-1 flex h-1.5 overflow-hidden rounded-full bg-grafite/5">
      {ETAPAS.map((e) => <span key={e.k} className={`${cores[e.k]} transition-[width] duration-500`} style={{ width: `${(contagem[e.k] / total) * 100}%` }} />)}
    </div>
  );
}

function Avatar({ nome }) {
  return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-grafite/[0.06] text-sm font-semibold text-grafite/80">{iniciais(nome)}</span>;
}

function Valor({ i, maior }) {
  if (i.recuperavelOnline == null) return <span className="text-sm font-light text-sutil">Aguardando cálculo</span>;
  const rec = (i.recuperavelOnline / maior) * 100;
  const pre = ((i.prejuizoPrescrito || 0) / maior) * 100;
  return (
    <span className="min-w-0">
      <span className="flex items-baseline gap-2">
        <span className="font-bold tabular-nums text-esmeralda-texto">{brlCurto(i.recuperavelOnline)}</span>
        {i.prejuizoPrescrito > 0 && <span className="text-sm tabular-nums text-sutil line-through">{brlCurto(i.prejuizoPrescrito)}</span>}
      </span>
      <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-grafite/5">
        <span className="bg-esmeralda" style={{ width: `${rec}%` }} />
        <span className="bg-red-700/40" style={{ width: `${pre}%` }} />
      </span>
    </span>
  );
}

function Prazo({ i }) {
  if (i.status === 'PROTOCOLADO') return <span className="rounded-full bg-esmeralda/10 px-2.5 py-1 text-[12px] font-semibold text-esmeralda-texto">Prazo interrompido</span>;
  const d = i.diasParaPrescrever;
  if (d == null) return <span className="text-sm font-light text-sutil">—</span>;
  if (d <= 30) return <span className="rounded-full bg-amber-100/80 px-2.5 py-1 text-[12px] font-semibold text-amber-900">Vence em {d} dias</span>;
  return <span className="rounded-full bg-grafite/[0.06] px-2.5 py-1 text-[12px] font-semibold text-apoio">{d} dias</span>;
}

function Situacao({ i }) {
  const cor = {
    CONCLUIDO: 'bg-esmeralda text-esmeralda-tinta', CONTRATO_ENVIADO: 'bg-esmeralda/15 text-esmeralda-escuro', PROTOCOLADO: 'bg-esmeralda-escuro text-white',
    ERRO: 'bg-red-50 text-red-800',
  }[i.status] || 'bg-grafite/[0.06] text-apoio';
  return (
    <>
      <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${cor}`}>{STATUS[i.status] || i.status}</span>
      {i.confianca === 'ESTIMADO' && <span className="rounded-full border border-grafite/10 px-2.5 py-1 text-[12px] text-apoio" title="Parte dos valores estimada pelo CNIS">estimado</span>}
      {i.copiaPendente && <span className="rounded-full bg-ambar-fundo px-2.5 py-1 text-[12px] font-semibold text-ambar-texto" title="O cliente pediu cópia dos dados (LGPD)">cópia LGPD</span>}
    </>
  );
}

function Vazio({ filtro }) {
  return (
    <p className="px-6 py-12 text-center text-apoio">
      {filtro ? 'Nenhum cliente neste filtro.' : 'Nenhum cliente ainda. Use "Compartilhar convite" para enviar seu link.'}
    </p>
  );
}

function Kpi({ rotulo, valor, formato = (v) => String(Math.round(v)), nota, solido, apagado }) {
  const animado = useContagem(valor ?? 0);
  return (
    <div className={`rounded-xl p-5 ${solido ? 'bg-esmeralda-escuro text-white shadow-[0_25px_50px_-12px_rgba(6,95,70,0.35)]' : 'vidro'}`}>
      <p className={`text-sm ${solido ? 'text-white/75' : 'text-apoio'}`}>{rotulo}</p>
      <p className={`mt-2 text-[28px] font-bold leading-none tracking-tight tabular-nums sm:text-[32px] ${apagado ? 'text-sutil' : ''}`}>{formato(animado)}</p>
      {nota && <p className={`mt-2 text-[13px] ${solido ? 'text-white/70' : 'text-apoio'}`}>{nota}</p>}
    </div>
  );
}

function useContagem(alvo, ms = 1100) {
  const [v, setV] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(alvo); return undefined; }
    const inicio = performance.now();
    const passo = (t) => {
      const p = Math.min(1, (t - inicio) / ms);
      setV(alvo * (1 - (1 - p) ** 3));
      if (p < 1) raf.current = requestAnimationFrame(passo);
    };
    raf.current = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf.current);
  }, [alvo, ms]);
  return v;
}
