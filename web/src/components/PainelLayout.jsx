import { Link, Navigate, useNavigate } from 'react-router-dom';
import { sessaoContador } from '../lib/api.js';
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
        <div className="flex items-center gap-2">
          <button className="rounded-card bg-esmeralda px-4 py-2.5 text-sm font-semibold text-esmeralda-tinta shadow-acao"
            onClick={() => navigator.share ? navigator.share({ title: 'RECUPERA', url: convite }) : navigator.clipboard.writeText(convite)}>
            Compartilhar convite
          </button>
          <Link to="/painel/senha" className="px-2 py-2.5 text-sm font-light text-apoio">Trocar senha</Link>
          <button className="px-2 py-2.5 text-sm font-light text-apoio" onClick={() => { sessaoContador.limpar(); nav('/painel/login'); }}>Sair</button>
        </div>
      </header>
      <main className="pb-10 pt-4">{children}</main>
    </div>
  );
}
