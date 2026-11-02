import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { brl, mesAno, dataBr, linkWhatsApp } from '../lib/formato.js';
import PainelLayout from '../components/PainelLayout.jsx';
import { Aviso, Carregando, Voltar } from '../components/ui.jsx';

function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Detalhe() {
  const { id } = useParams();
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const [verMeses, setVerMeses] = useState(false);
  const carregar = () => api.analise(id).then(setD).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function acao(fn) { try { setErro(''); await fn(); await carregar(); } catch (e) { setErro(e.message); } }

  if (!d) return <PainelLayout>{erro ? <Aviso>{erro}</Aviso> : <Carregando />}</PainelLayout>;
  const { lead, relatorio: r, alertaComercial: alerta, roteiro } = d;

  return (
    <PainelLayout>
      <Voltar to="/painel">Análises</Voltar>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-titulo text-[36px] leading-tight">{lead.nome}</h1><p className="apoio">{lead.profissao} · consentiu em {dataBr(lead.consentimento?.aceitoEm)}</p></div>
      </div>
      <div className="mt-4"><Aviso>{erro}</Aviso></div>

      {!r && <p className="apoio mt-8">Relatório ainda não gerado (status: {lead.status}).</p>}
      {r && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="cartao p-5"><p className="text-xs uppercase tracking-wider text-apoio">Recuperável</p><p className="mt-1 text-3xl font-bold text-esmeralda-texto">{brl(r.recuperavelOnline)}</p><p className="apoio mt-1 text-xs">{r.confianca === 'ESTIMADO' ? 'Estimado pelo CNIS' : 'Comprovado por documento'}</p></div>
              <div className="vidro p-5"><p className="text-xs uppercase tracking-wider text-apoio">Já prescrito</p><p className="mt-1 text-3xl font-bold text-sutil">{brl(r.prejuizoPrescrito)}</p><p className="apoio mt-1 text-xs">Data-base {dataBr(r.dataBase)}</p></div>
            </div>

            {alerta?.itens?.length > 0 && (
              <div className={`rounded-card p-5 ${alerta.prioridade === 'ALTA' ? 'border border-ambar/40 bg-ambar-fundo/40' : 'vidro'}`}>
                <p className={`text-xs font-semibold uppercase tracking-wider ${alerta.prioridade === 'ALTA' ? 'text-ambar-texto' : 'text-apoio'}`}>Prioridade {alerta.prioridade.toLowerCase()}</p>
                <ul className="mt-2 space-y-1.5 text-[15px]">{alerta.itens.map((t) => <li key={t}>• {t}</li>)}</ul>
              </div>
            )}

            {r.alertas?.length > 0 && (
              <div className="vidro p-5 text-sm"><p className="mb-2 font-semibold">Antes do protocolo</p><ul className="apoio space-y-1.5">{r.alertas.map((a) => <li key={a.tipo}>• {a.mensagem}</li>)}</ul></div>
            )}

            <div className="vidro overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-apoio"><tr>{['Ano', 'Pago', 'Devido', 'Recuperável', 'Prescrito'].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-white/70">
                  {r.consolidadoAnual.map((a) => (
                    <tr key={a.ano}><td className="px-4 py-3 font-semibold">{a.ano}</td><td className="px-4 py-3 font-light">{brl(a.pago)}</td><td className="px-4 py-3 font-light">{brl(a.devido)}</td><td className="px-4 py-3 font-semibold text-esmeralda-texto">{brl(a.excessoRecuperavel)}</td><td className="px-4 py-3 font-light text-sutil">{brl(a.excessoPrescrito)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button className="link text-sm" onClick={() => setVerMeses(!verMeses)}>{verMeses ? 'Ocultar' : 'Ver'} os {r.meses.length} meses</button>
            {verMeses && (
              <div className="vidro max-h-[420px] overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-papel/90 uppercase tracking-wider text-apoio"><tr>{['Mês', 'Vínc.', 'Teto', 'Pago', 'Devido', 'Excesso', 'Vence'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-white/70">
                    {r.meses.map((m) => (
                      <tr key={m.competencia} className={m.prescrito ? 'text-sutil line-through' : ''}>
                        <td className="px-3 py-2">{mesAno(m.competencia)}{!m.parametroConfirmado && ' *'}</td><td className="px-3 py-2">{m.qtdVinculos}</td><td className="px-3 py-2">{brl(m.teto)}</td><td className="px-3 py-2">{brl(m.pago)}</td><td className="px-3 py-2">{brl(m.devido)}</td>
                        <td className="px-3 py-2 font-semibold">{brl(m.excesso)}</td><td className="px-3 py-2">{dataBr(m.vencimentoPrescricao + 'T12:00:00')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="apoio px-3 py-2 text-xs">* parâmetro ainda não conferido na Portaria</p>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div className="cartao p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-apoio">Roteiro da abordagem</p>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed">{roteiro}</p>
              <a className="btn-primario mt-5" href={linkWhatsApp(lead.whatsapp, roteiro)} target="_blank" rel="noreferrer">Chamar no WhatsApp</a>
            </div>
            <div className="vidro space-y-2 p-5">
              <button className="btn-secundario" onClick={() => acao(async () => baixar(new Blob([await api.contrato(id)], { type: 'text/markdown' }), `contrato-${lead.nome}.md`))}>Gerar contrato de êxito</button>
              <button className="btn-secundario" onClick={() => acao(async () => baixar(await api.baixarCsv(id), `perdcomp-${lead.nome}.csv`))}>Planilha para o PER/DCOMP</button>
              {lead.status !== 'PROTOCOLADO' && <button className="btn-secundario" onClick={() => acao(() => api.mudarStatus(id, 'PROTOCOLADO'))}>Marcar como protocolado</button>}
            </div>
          </aside>
        </div>
      )}
    </PainelLayout>
  );
}
