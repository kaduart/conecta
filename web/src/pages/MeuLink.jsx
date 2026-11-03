import { useState } from 'react';
import { Copy, Check, MessageCircle } from 'lucide-react';
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

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:items-start">
      <div className="min-w-0">
      <div className="cartao p-5 sm:p-6">
        <p className="text-sm text-apoio">Link atual</p>
        <div className="mt-2 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate font-semibold">{link}</p>
          <button onClick={copiar} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-esmeralda px-3 py-2 text-sm font-semibold text-esmeralda-tinta">
            {copiado ? <Check className="h-4 w-4" strokeWidth={2} /> : <Copy className="h-4 w-4" strokeWidth={1.5} />}{copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>

      <form onSubmit={salvar} className="vidro mt-4 space-y-4 p-5 sm:p-6">
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
      </div>
      <Mensagem link={link} escritorio={sessao.escritorio} />
      </div>
    </PainelLayout>
  );
}

// Texto pronto para mandar no WhatsApp com o link, no formato de um balão de conversa.
function Mensagem({ link, escritorio }) {
  const [copiado, setCopiado] = useState(false);
  const texto = `Oi! Aqui é do ${escritorio || 'escritório'}. Quem trabalha em mais de um lugar costuma pagar INSS acima do teto, e o excesso dos últimos 5 anos pode ser pedido de volta. Dá para conferir pelo link abaixo: leva uns 5 minutos e você só precisa do extrato do Meu INSS.\n\n${link}`;
  async function copiar() {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { /* sem permissão */ }
  }
  return (
    <section className="min-w-0 rounded-2xl bg-[#E9E4DA]/60 p-5 sm:p-6">
      <h2 className="font-titulo text-xl font-medium">Mensagem pronta</h2>
      <p className="mt-1 text-sm text-apoio">Para mandar no WhatsApp ou no e-mail.</p>
      <div className="mt-4 rounded-2xl rounded-tl-sm bg-white p-4 text-[15px] leading-relaxed shadow-[0_8px_24px_-16px_rgba(31,42,46,0.35)]">
        <p className="whitespace-pre-line break-words">{texto}</p>
      </div>
      <button onClick={copiar} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-grafite px-4 py-2.5 text-sm font-semibold text-white">
        {copiado ? <Check className="h-4 w-4" strokeWidth={2} /> : <MessageCircle className="h-4 w-4" strokeWidth={1.5} />}{copiado ? 'Mensagem copiada' : 'Copiar mensagem'}
      </button>
    </section>
  );
}
