import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { api, sessaoContador } from '../lib/api.js';
import PainelLayout from '../components/PainelLayout.jsx';
import { Aviso, Voltar } from '../components/ui.jsx';

// Mesmo critério do servidor (gerarSlug): sem acento, minúsculas, hífen no lugar de espaço.
const slugDe = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export default function MeuLink() {
  const sessao = sessaoContador.get() || {};
  const [atual, setAtual] = useState(sessao.slugLink || '');
  const [texto, setTexto] = useState(sessao.slugLink || '');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const base = `${window.location.host}/c/`;
  const previa = slugDe(texto);
  const link = `${window.location.origin}/c/${atual}`;

  async function salvar(e) {
    e.preventDefault(); setErro(''); setOk(false);
    if (previa.length < 3) return setErro('Use pelo menos 3 letras ou números.');
    setEnviando(true);
    try {
      const { slugLink } = await api.trocarLink(previa);
      sessaoContador.set({ ...sessaoContador.get(), slugLink });
      setAtual(slugLink); setTexto(slugLink); setOk(true);
    } catch (e2) { setErro(e2.message); } finally { setEnviando(false); }
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { /* sem permissão */ }
  }

  return (
    <PainelLayout>
      <Voltar to="/painel">Carteira</Voltar>
      <h1 className="titulo mt-4">Meu link</h1>
      <p className="apoio mt-2 max-w-xl">É o endereço que você manda para os clientes. Quem abre cai direto na análise do seu escritório.</p>

      <div className="cartao mt-8 max-w-xl p-5 sm:p-6">
        <p className="text-sm text-apoio">Link atual</p>
        <div className="mt-2 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate font-semibold">{link}</p>
          <button onClick={copiar} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-esmeralda px-3 py-2 text-sm font-semibold text-esmeralda-tinta">
            {copiado ? <Check className="h-4 w-4" strokeWidth={2} /> : <Copy className="h-4 w-4" strokeWidth={1.5} />}{copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>

      <form onSubmit={salvar} className="vidro mt-4 max-w-xl space-y-4 p-5 sm:p-6">
        <div>
          <label className="rotulo" htmlFor="slug">Trocar o final do link</label>
          <div className="campo flex items-center gap-0 p-0 pl-4">
            <span className="shrink-0 text-sutil">{base}</span>
            <input id="slug" value={texto} onChange={(e) => setTexto(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false}
              className="min-w-0 flex-1 bg-transparent py-3.5 pr-4 outline-hidden" placeholder="seunome" />
          </div>
          <p className="mt-2 text-sm text-apoio">Curto e fácil de ditar, como o nome do escritório. Fica assim: <span className="font-semibold text-grafite">{base}{previa || '…'}</span></p>
        </div>
        <Aviso tom="ambar">O link antigo para de funcionar. Quem ainda não abriu vai precisar do novo.</Aviso>
        <Aviso>{erro}</Aviso>
        {ok && <p className="text-sm text-esmeralda-texto">Link trocado. Já pode compartilhar o novo.</p>}
        <button className="btn-primario" disabled={enviando || previa === atual}>{enviando ? 'Salvando…' : 'Salvar novo link'}</button>
      </form>
    </PainelLayout>
  );
}
