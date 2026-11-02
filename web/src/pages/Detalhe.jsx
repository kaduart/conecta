import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { brl, mesAno, dataBr, linkWhatsApp } from '../lib/formato.js';
import PainelLayout from '../components/PainelLayout.jsx';
import { Aviso, Carregando, Voltar } from '../components/ui.jsx';

// Análise de um cliente no formato de livro-razão: resumo, filtros, por fonte, por ano e lançamentos mês a mês.

function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const soma = (lista, f) => lista.reduce((s, x) => s + (f(x) || 0), 0);
const TIPOS = { EMPREGADO: 'CLT', CI: 'Contribuinte individual', COOPERADO: 'Cooperado', SOCIO: 'Pró-labore', AVULSO: 'Avulso' };
const diasAte = (iso) => Math.round((new Date(`${iso}T12:00:00`) - new Date()) / 86400000);

export default function Detalhe() {
  const { id } = useParams();
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState('analise');
  const carregar = () => api.analise(id).then(setD).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function acao(fn) { try { setErro(''); await fn(); await carregar(); } catch (e) { setErro(e.message); } }

  if (!d) return <PainelLayout>{erro ? <Aviso>{erro}</Aviso> : <Carregando />}</PainelLayout>;
  const { lead, relatorio: r, alertaComercial: alerta, roteiro } = d;

  return (
    <PainelLayout>
      <Voltar to="/painel">Análises</Voltar>
      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="titulo">{lead.nome}</h1>
          <p className="mt-1 text-apoio">{lead.profissao}. Autorizou em {dataBr(lead.consentimento?.aceitoEm)}.{r && ` Posição em ${dataBr(r.dataBase)}.`}</p>
        </div>
        <a className="btn-primario w-auto px-6" href={linkWhatsApp(lead.whatsapp, roteiro)} target="_blank" rel="noreferrer">Chamar no WhatsApp</a>
      </header>
      <div className="mt-4"><Aviso>{erro}</Aviso></div>

      <nav className="mt-8 flex gap-1" role="tablist">
        {[['analise', 'Análise do INSS'], ['abordagem', 'Abordagem e documentos']].map(([k, t]) => (
          <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
            className={`rounded-xl px-4 py-2.5 text-[15px] font-semibold transition-all duration-300 ${aba === k ? 'bg-white text-grafite shadow-[0_8px_24px_-12px_rgba(31,42,46,0.25)]' : 'text-apoio hover:text-grafite'}`}>
            {t}
          </button>
        ))}
      </nav>

      {!r && <p className="mt-8 text-apoio">O relatório ainda não foi gerado. Status atual: {lead.status}.</p>}
      {r && aba === 'analise' && <Analise r={r} alerta={alerta} />}
      {aba === 'abordagem' && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="cartao p-8">
            <h2 className="font-titulo text-2xl font-medium">Roteiro da abordagem</h2>
            <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed">{roteiro}</p>
            <a className="btn-primario mt-6" href={linkWhatsApp(lead.whatsapp, roteiro)} target="_blank" rel="noreferrer">Chamar no WhatsApp</a>
          </div>
          <div className="vidro space-y-3 p-8">
            <h2 className="font-titulo text-xl font-medium">Documentos</h2>
            <button className="btn-secundario" onClick={() => acao(async () => baixar(new Blob([await api.contrato(id)], { type: 'text/markdown' }), `contrato-${lead.nome}.md`))}>Gerar contrato de êxito</button>
            <button className="btn-secundario" onClick={() => acao(async () => baixar(await api.baixarCsv(id), `perdcomp-${lead.nome}.csv`))}>Baixar planilha do PER/DCOMP</button>
            {lead.status !== 'PROTOCOLADO' && <button className="btn-secundario" onClick={() => acao(() => api.mudarStatus(id, 'PROTOCOLADO'))}>Marcar como protocolado</button>}
          </div>
        </div>
      )}
    </PainelLayout>
  );
}

function Analise({ r, alerta }) {
  const anos = useMemo(() => [...new Set(r.meses.map((m) => m.competencia.slice(0, 4)))], [r]);
  const fontes = useMemo(() => {
    const mapa = new Map();
    for (const m of r.meses) for (const v of m.vinculos || []) {
      const f = mapa.get(v.cnpj) || { cnpj: v.cnpj, nome: v.nome, tipo: v.tipo, meses: [] };
      f.meses.push({ ...v, competencia: m.competencia, prescrito: m.prescrito });
      mapa.set(v.cnpj, f);
    }
    return [...mapa.values()];
  }, [r]);

  const [ano, setAno] = useState('todos');
  const [fonte, setFonte] = useState('todas');
  const [verPrescritos, setVerPrescritos] = useState(false);

  const meses = r.meses.filter((m) => (ano === 'todos' || m.competencia.startsWith(ano))
    && (fonte === 'todas' || (m.vinculos || []).some((v) => v.cnpj === fonte))
    && (verPrescritos || !m.prescrito));
  const proximo = r.meses.find((m) => !m.prescrito && m.excesso > 0);
  const dias = proximo ? diasAte(proximo.vencimentoPrescricao) : null;

  const k = {
    restituivel: soma(meses.filter((m) => !m.prescrito), (m) => m.excesso),
    pago: soma(meses, (m) => m.pago),
    prescrito: soma(r.meses.filter((m) => m.prescrito && (ano === 'todos' || m.competencia.startsWith(ano))), (m) => m.excesso),
  };

  return (
    <div className="mt-6 space-y-10">
      {/* Resumo */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo">
        <div className="rounded-xl bg-esmeralda-escuro p-5 text-white shadow-[0_25px_50px_-12px_rgba(6,95,70,0.35)]">
          <p className="text-sm text-white/75">Restituível no filtro</p>
          <p className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{brl(k.restituivel)}</p>
          <p className="mt-1 text-[13px] text-white/70">principal, sem Selic</p>
        </div>
        <Resumo rotulo="INSS pago no filtro" valor={brl(k.pago)} nota="todas as fontes" />
        <Resumo rotulo="Perdido por prazo" valor={brl(k.prescrito)} nota="excesso já prescrito" apagado />
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 p-5 text-amber-900">
          <p className="text-sm text-amber-800/80">{proximo ? `Vence em ${dataBr(`${proximo.vencimentoPrescricao}T12:00:00`)}` : 'Próximo vencimento'}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{proximo ? brl(proximo.excesso) : '—'}</p>
          <p className="mt-1 text-[13px] text-amber-800/80">{proximo ? `competência ${mesAno(proximo.competencia)}, em ${dias} dias` : 'nada a vencer'}</p>
        </div>
      </section>

      {/* Filtros */}
      <section className="vidro space-y-3 p-5 sm:p-6" aria-label="Filtros">
        <Linha rotulo="Ano">
          <Chip ativo={ano === 'todos'} onClick={() => setAno('todos')}>Todos</Chip>
          {anos.map((a) => <Chip key={a} ativo={ano === a} onClick={() => setAno(a)}>{a}</Chip>)}
        </Linha>
        <Linha rotulo="Fonte">
          <Chip ativo={fonte === 'todas'} onClick={() => setFonte('todas')}>Todas</Chip>
          {fontes.map((f) => <Chip key={f.cnpj} ativo={fonte === f.cnpj} onClick={() => setFonte(f.cnpj)}>{nomeCurto(f.nome)}</Chip>)}
        </Linha>
        <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm text-apoio">
          <input type="checkbox" className="h-4 w-4 accent-esmeralda" checked={verPrescritos} onChange={(e) => setVerPrescritos(e.target.checked)} />
          Mostrar meses já prescritos
        </label>
      </section>

      {/* Por fonte */}
      <section>
        <h2 className="font-titulo text-2xl font-medium">Por fonte pagadora</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fontes.map((f) => {
            const ms = f.meses.filter((m) => (ano === 'todos' || m.competencia.startsWith(ano)) && (verPrescritos || !m.prescrito));
            const ativa = fonte === 'todas' || fonte === f.cnpj;
            return (
              <button key={f.cnpj} onClick={() => setFonte(fonte === f.cnpj ? 'todas' : f.cnpj)}
                className={`vidro p-5 text-left transition-all duration-300 hover:bg-white/60 ${ativa ? '' : 'opacity-40'} ${fonte === f.cnpj ? 'ring-1 ring-esmeralda/40' : ''}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-semibold">{nomeCurto(f.nome)}</p>
                  <span className="shrink-0 text-[13px] text-apoio">{TIPOS[f.tipo] || f.tipo}</span>
                </div>
                <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-apoio">Meses no filtro</dt><dd className="text-right tabular-nums">{ms.length}</dd>
                  <dt className="text-apoio">Período</dt><dd className="text-right tabular-nums">{ms.length ? `${mesAno(ms[0].competencia)} a ${mesAno(ms[ms.length - 1].competencia)}` : '—'}</dd>
                  <dt className="text-apoio">Remuneração</dt><dd className="text-right tabular-nums">{brl(soma(ms, (m) => m.remuneracao))}</dd>
                  <dt className="font-medium">INSS recolhido</dt><dd className="text-right font-semibold tabular-nums">{brl(soma(ms, (m) => m.inss))}</dd>
                </dl>
              </button>
            );
          })}
        </div>
      </section>

      {/* Por ano */}
      <section>
        <h2 className="font-titulo text-2xl font-medium">Por ano: devido e excesso</h2>
        <PorAno r={r} fonte={fonte} anoAtivo={ano} onAno={(a) => setAno(ano === a ? 'todos' : a)} />
      </section>

      {/* Lançamentos */}
      <section>
        <h2 className="font-titulo text-2xl font-medium">Lançamentos mês a mês</h2>
        <div className="vidro mt-4 overflow-x-auto p-2">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-apoio">
              <tr>{['Mês', 'Fontes', 'Teto', 'INSS pago', 'Devido', 'Excesso', 'Prazo'].map((h, i) => <th key={h} className={`px-4 pb-3 pt-4 font-medium ${i < 2 ? 'text-left' : 'text-right'}`}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {meses.map((m, n) => {
                const destaque = proximo && m.competencia === proximo.competencia;
                return (
                  <tr key={m.competencia} className={destaque ? 'bg-amber-50/70' : n % 2 === 0 ? 'bg-white/20' : ''}>
                    <td className="px-4 py-3.5 font-semibold tabular-nums">{mesAno(m.competencia)}{!m.parametroConfirmado && <span className="text-apoio" title="Parâmetro ainda não conferido na Portaria"> *</span>}</td>
                    <td className="max-w-[260px] truncate px-4 py-3.5 text-apoio" title={(m.vinculos || []).map((v) => v.nome).join(', ')}>{(m.vinculos || []).map((v) => nomeCurto(v.nome)).join(', ') || m.qtdVinculos}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-apoio">{brl(m.teto)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums">{brl(m.pago)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-apoio">{brl(m.devido)}</td>
                    <td className={`px-4 py-3.5 text-right font-semibold tabular-nums ${m.prescrito ? 'text-sutil line-through' : 'text-esmeralda-texto'}`}>{brl(m.excesso)}</td>
                    <td className="px-4 py-3.5 text-right"><SeloPrazo m={m} /></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="px-4 pb-4 pt-5" colSpan={3}>Total do filtro ({meses.length} meses)</td>
                <td className="px-4 pb-4 pt-5 text-right tabular-nums">{brl(k.pago)}</td>
                <td className="px-4 pb-4 pt-5 text-right tabular-nums">{brl(soma(meses, (m) => m.devido))}</td>
                <td className="px-4 pb-4 pt-5 text-right tabular-nums text-esmeralda-texto">{brl(k.restituivel)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-3 text-[13px] font-light text-apoio">O excesso é calculado por mês, somando todas as fontes. Com uma fonte filtrada, a tabela mostra os meses em que ela aparece. * parâmetro ainda não conferido na Portaria.</p>
      </section>

      {/* Notas */}
      <section className="grid gap-3 lg:grid-cols-2">
        {alerta?.itens?.length > 0 && (
          <Nota titulo={alerta.prioridade === 'ALTA' ? 'Urgente' : `Prioridade ${alerta.prioridade.toLowerCase()}`} alerta={alerta.prioridade === 'ALTA'}>
            {alerta.itens.map((t) => <li key={t}>{t}</li>)}
          </Nota>
        )}
        {r.alertas?.length > 0 && <Nota titulo="Antes do protocolo">{r.alertas.map((a) => <li key={a.tipo}>{a.mensagem}</li>)}</Nota>}
        <Nota titulo="Como o excesso é calculado">
          <li>Em cada mês, o INSS devido vai até o teto da época (somando todas as fontes). O que passar disso é excesso.</li>
          <li>Cada competência prescreve 5 anos depois do pagamento, que vence no dia 20 do mês seguinte.</li>
          <li>{r.confianca === 'ESTIMADO' ? 'Parte dos valores foi estimada pelo CNIS. Peça informes ou contracheques para comprovar.' : 'Valores comprovados pelos documentos enviados.'}</li>
        </Nota>
        <Nota titulo="Base legal">
          <li>Lei 8.212/91, art. 28 §5º (teto) e art. 89 (restituição com Selic)</li>
          <li>CTN, arts. 165 e 168, I: 5 anos contados de cada pagamento</li>
          <li>IN RFB 2.055/2021 (PER/DCOMP Web)</li>
        </Nota>
      </section>
    </div>
  );
}

function PorAno({ r, fonte, anoAtivo, onAno }) {
  const linhas = r.consolidadoAnual;
  const max = Math.max(...linhas.map((a) => a.devido + a.excessoRecuperavel + a.excessoPrescrito), 1);
  return (
    <div className="vidro mt-4 space-y-3 p-5 sm:p-8">
      {linhas.map((a) => {
        const ativo = anoAtivo === 'todos' || anoAtivo === String(a.ano);
        return (
          <button key={a.ano} onClick={() => onAno(String(a.ano))}
            className={`grid w-full grid-cols-[48px_1fr_112px] items-center gap-3 text-left text-sm transition-opacity duration-300 sm:grid-cols-[56px_1fr_140px] ${ativo ? '' : 'opacity-35'}`}>
            <span className="font-semibold tabular-nums">{a.ano}</span>
            <span className="flex h-5 overflow-hidden rounded-md bg-grafite/[0.05]">
              <span className="bg-grafite/25 transition-[width] duration-500" style={{ width: `${(a.devido / max) * 100}%` }} title={`Devido ${brl(a.devido)}`} />
              <span className="bg-esmeralda transition-[width] duration-500" style={{ width: `${(a.excessoRecuperavel / max) * 100}%` }} title={`Restituível ${brl(a.excessoRecuperavel)}`} />
              <span className="bg-red-700/45 transition-[width] duration-500" style={{ width: `${(a.excessoPrescrito / max) * 100}%` }} title={`Prescrito ${brl(a.excessoPrescrito)}`} />
            </span>
            <span className="text-right font-semibold tabular-nums text-esmeralda-texto">{brl(a.excessoRecuperavel)}</span>
          </button>
        );
      })}
      <div className="flex flex-wrap gap-x-5 gap-y-1 pt-2 text-[13px] text-apoio">
        <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-grafite/25 align-[-1px]" />INSS devido (até o teto)</span>
        <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-esmeralda align-[-1px]" />Excesso restituível</span>
        <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-red-700/45 align-[-1px]" />Excesso prescrito</span>
        {fonte !== 'todas' && <span>As barras mostram o total de todas as fontes.</span>}
      </div>
    </div>
  );
}

function SeloPrazo({ m }) {
  if (m.prescrito) return <span className="rounded-full bg-red-50 px-2.5 py-1 text-[12px] font-semibold text-red-800">Prescrito</span>;
  const dias = diasAte(m.vencimentoPrescricao);
  if (dias <= 90) return <span className="rounded-full bg-amber-100/80 px-2.5 py-1 text-[12px] font-semibold text-amber-900">Vence em {dias} dias</span>;
  return <span className="rounded-full bg-esmeralda/10 px-2.5 py-1 text-[12px] font-semibold text-esmeralda-texto">Até {dataBr(`${m.vencimentoPrescricao}T12:00:00`)}</span>;
}

function Resumo({ rotulo, valor, nota, apagado }) {
  return (
    <div className="vidro p-5">
      <p className="text-sm text-apoio">{rotulo}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums sm:text-3xl ${apagado ? 'text-sutil' : ''}`}>{valor}</p>
      <p className="mt-1 text-[13px] text-apoio">{nota}</p>
    </div>
  );
}

function Linha({ rotulo, children }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-14 shrink-0 text-sm font-medium text-apoio">{rotulo}</span>
      {children}
    </div>
  );
}

function Chip({ ativo, onClick, children }) {
  return (
    <button onClick={onClick} aria-pressed={ativo}
      className={`rounded-xl px-3 py-1.5 text-sm transition-all duration-300 ${ativo ? 'bg-esmeralda-escuro font-semibold text-white' : 'bg-white/50 text-grafite hover:bg-white'}`}>
      {children}
    </button>
  );
}

function Nota({ titulo, alerta, children }) {
  return (
    <div className={`rounded-xl p-6 ${alerta ? 'border border-amber-200/60 bg-amber-50/60 text-amber-900' : 'vidro'}`}>
      <h3 className="font-semibold">{titulo}</h3>
      <ul className={`mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed ${alerta ? '' : 'text-apoio'}`}>{children}</ul>
    </div>
  );
}

// "HOSPITAL SANTA LUZIA" -> "Hospital Santa Luzia"
function nomeCurto(nome = '') {
  return nome.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()).replace(/\b(Ltda|S\.?a\.?|Me|Epp)\b\.?/gi, '').trim();
}
