import { Link } from 'react-router-dom';

export function Marca({ className = '' }) {
  return (
    <span className={`font-corpo text-[13px] font-bold tracking-[0.22em] text-grafite ${className}`}>
      RECUPERA<span className="text-esmeralda">.</span>
    </span>
  );
}

/** Moldura do fluxo do cliente: coluna única, mobile-first, centralizada no desktop. */
export function Tela({ etapa, children, rodape }) {
  return (
    <main className="seguro mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 sm:max-w-lg sm:px-8 sm:pt-10">
      <header className="flex items-center justify-between py-2">
        <Marca />
        {etapa ? <span className="text-xs font-light text-apoio">{etapa}</span> : <Selo />}
      </header>
      <div className="flex flex-1 flex-col pt-8">{children}</div>
      {rodape && <footer className="pt-8 text-center text-xs font-light text-sutil">{rodape}</footer>}
    </main>
  );
}

export function Selo() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-light text-apoio">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.2" aria-hidden><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
      Criptografado
    </span>
  );
}

export function Aviso({ children, tom = 'erro' }) {
  const cores = tom === 'erro' ? 'bg-red-50 text-red-800' : 'bg-ambar-fundo/60 text-ambar-texto';
  return children ? <p role="alert" className={`rounded-card px-4 py-3 text-sm ${cores}`}>{children}</p> : null;
}

export function Carregando({ texto = 'Carregando…' }) {
  return <p className="py-16 text-center font-light text-apoio">{texto}</p>;
}

export function Voltar({ to, children = 'Voltar' }) {
  return <Link to={to} className="text-sm font-light text-apoio hover:text-grafite">← {children}</Link>;
}
