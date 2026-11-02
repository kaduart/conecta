import { useState } from 'react';
import { Eye, Clock, ShieldCheck, FileText, Check, Upload } from 'lucide-react';
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
    <main className={`seguro mx-auto flex min-h-dvh w-full flex-col px-5 sm:px-8 ${largo ? 'max-w-6xl' : 'max-w-md sm:max-w-lg'}`}>
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
const ICONES = { olho: Eye, relogio: Clock, escudo: ShieldCheck, documento: FileText, check: Check, subir: Upload };
/** Ícones lucide-react com traço fino (1.5) para combinar com a tipografia. */
export function Icone({ nome, className = 'h-5 w-5' }) {
  const C = ICONES[nome] || Check;
  return <C className={className} strokeWidth={1.5} aria-hidden />;
}

/** Foto editorial com moldura e véu suave; some sozinha se a imagem não carregar. */
export function Foto({ src, alt = '', className = '', children }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <figure className={`relative overflow-hidden rounded-2xl bg-grafite/5 shadow-[0_30px_60px_-24px_rgba(31,42,46,0.35)] ${className}`}>
      <img src={src} alt={alt} onError={() => setOk(false)} className="absolute inset-0 h-full w-full object-cover" decoding="async" />
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-grafite/45 via-transparent to-transparent" />
      {children}
    </figure>
  );
}
