import { Link } from 'react-router-dom';

export function Marca({ className = '' }) {
  return (
    <span className={`font-corpo text-[13px] font-bold tracking-[0.22em] text-grafite ${className}`}>
      RECUPERA<span className="text-esmeralda">.</span>
    </span>
  );
}

/**
 * Moldura do fluxo do cliente. Celular: uma coluna. Desktop com `lateral`: duas colunas,
 * texto editorial à esquerda (alinhado à esquerda) e a ação do usuário à direita.
 */
export function Tela({ etapa, children, rodape, lateral }) {
  const largo = Boolean(lateral);
  return (
    <main className={`seguro mx-auto flex min-h-[100dvh] w-full flex-col px-5 sm:px-8 ${largo ? 'max-w-6xl' : 'max-w-md sm:max-w-lg'}`}>
      <header className="flex items-center justify-between py-4">
        <Marca />
        {etapa ? <span className="text-sm text-apoio tabular-nums">{etapa}</span> : <Selo />}
      </header>
      {largo ? (
        <div className="grid flex-1 gap-10 pt-8 lg:grid-cols-12 lg:items-center lg:gap-16 lg:pt-0">
          <div className="lg:col-span-7">{lateral}</div>
          <div className="lg:col-span-5">{children}</div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col pt-8">{children}</div>
      )}
      {rodape && <footer className="pt-10 text-sm text-apoio">{rodape}</footer>}
    </main>
  );
}

export function Selo() {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-apoio">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.2" aria-hidden><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
      Criptografado
    </span>
  );
}

export function Aviso({ children, tom = 'erro' }) {
  const cores = tom === 'erro' ? 'bg-red-50/70 text-red-800' : 'border border-amber-200/40 bg-amber-50/40 text-amber-900';
  return children ? <p role="alert" className={`rounded-xl px-4 py-3 text-sm ${cores}`}>{children}</p> : null;
}

export function Carregando({ texto = 'Carregando…' }) {
  return <p className="py-16 text-center font-light text-apoio">{texto}</p>;
}

export function Voltar({ to, children = 'Voltar' }) {
  return <Link to={to} className="text-sm font-light text-apoio hover:text-grafite">← {children}</Link>;
}

/** Ícones de linha ultrafina (traço 1.5px), no estilo Lucide. */
const TRACOS = {
  olho: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  relogio: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  escudo: <><path d="M12 3 5 6v6c0 4.4 3 8.2 7 9 4-.8 7-4.6 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
  documento: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5" /></>,
  check: <path d="M5 12l5 5L20 7" />,
  subir: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></>,
};
export function Icone({ nome, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {TRACOS[nome]}
    </svg>
  );
}
