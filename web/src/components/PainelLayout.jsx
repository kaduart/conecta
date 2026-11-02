import { Link, Navigate, useNavigate } from 'react-router-dom';
import { sessaoContador } from '../lib/api.js';
import { Link2, KeyRound, LogOut, Share2 } from 'lucide-react';
import { Marca } from './ui.jsx';

export default function PainelLayout({ children }) {
  const nav = useNavigate();
  const s = sessaoContador.get();
  if (!s?.token) return <Navigate to="/painel/login" replace />;
  const convite = `${window.location.origin}/c/${s.slugLink}`;
  return (
    <div className="seguro mx-auto w-full max-w-6xl px-4 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3 py-3">
        <Link to="/painel" className="flex items-baseline gap-3"><Marca /><span className="hidden text-sm font-light text-apoio sm:inline">{s.escritorio}</span></Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <button className="inline-flex items-center gap-2 whitespace-nowrap rounded-card bg-esmeralda px-3 py-2.5 text-sm font-semibold text-esmeralda-tinta shadow-acao sm:px-4"
            onClick={() => navigator.share ? navigator.share({ title: 'RECUPERA', url: convite }) : navigator.clipboard.writeText(convite)}>
            <Share2 className="h-4 w-4" strokeWidth={1.75} /><span>Compartilhar<span className="hidden sm:inline"> convite</span></span>
          </button>
          <ItemMenu to="/painel/link" icone={Link2}>Meu link</ItemMenu>
          <ItemMenu to="/painel/senha" icone={KeyRound}>Trocar senha</ItemMenu>
          <button title="Sair" className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2.5 text-sm font-light text-apoio hover:text-grafite" onClick={() => { sessaoContador.limpar(); nav('/painel/login'); }}>
            <LogOut className="h-[18px] w-[18px] sm:hidden" strokeWidth={1.5} /><span className="hidden sm:inline">Sair</span>
          </button>
        </nav>
      </header>
      <main className="pb-10 pt-4">{children}</main>
    </div>
  );
}

// No celular só o ícone; do tablet em diante, o texto.
function ItemMenu({ to, icone: I, children }) {
  return (
    <Link to={to} title={children} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2.5 text-sm font-light text-apoio hover:text-grafite">
      <I className="h-[18px] w-[18px] sm:hidden" strokeWidth={1.5} /><span className="hidden sm:inline">{children}</span>
    </Link>
  );
}
