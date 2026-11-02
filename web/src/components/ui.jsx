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
        {etapa ? <Etapas texto={etapa} /> : <Selo />}
      </header>
      {largo ? (
        <div className="grid flex-1 grid-cols-1 gap-10 pt-8 lg:grid-cols-12 lg:items-center lg:gap-16 lg:pt-0">
          <div className="min-w-0 lg:col-span-7">{lateral}</div>
          <div className="min-w-0 lg:col-span-5">{children}</div>
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

/** "Etapa 2 de 3" com três traços: feitos em esmeralda, o atual em grafite. */
function Etapas({ texto }) {
  const [, atual, total] = String(texto).match(/(\d+)\s*de\s*(\d+)/) || [];
  return (
    <span className="flex items-center gap-3 text-sm text-apoio tabular-nums">
      {total && (
        <span className="flex gap-1" aria-hidden>
          {Array.from({ length: Number(total) }, (_, i) => (
            <span key={i} className={`h-1 w-6 rounded-full ${i + 1 < atual ? 'bg-esmeralda' : i + 1 == atual ? 'bg-grafite' : 'bg-grafite/15'}`} />
          ))}
        </span>
      )}
      {texto}
    </span>
  );
}

/** Foto que se dissolve no fundo: opacidade baixa e máscara nas bordas, sem moldura. */
export function FotoEsmaecida({ src, className = 'h-56 sm:h-72 lg:h-80', posicao = 'center 30%' }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  // Duas máscaras lineares cruzadas: some por cima, por baixo e pelas laterais, sem borda de caixa.
  const mascara = 'linear-gradient(to bottom, transparent, #000 35%, #000 62%, transparent), linear-gradient(to right, transparent, #000 30%, #000 75%, transparent)';
  return (
    <div aria-hidden className={`pointer-events-none relative mt-8 overflow-hidden lg:mt-10 ${className}`}>
      <img src={src} alt="" onError={() => setOk(false)} decoding="async"
        className="h-full w-full object-cover opacity-80 saturate-[.9]"
        style={{ objectPosition: posicao, maskImage: mascara, WebkitMaskImage: mascara, maskComposite: 'intersect', WebkitMaskComposite: 'source-in' }} />
    </div>
  );
}

const MASCARA_FUNDO = {
  maskImage: 'linear-gradient(to bottom, transparent, #000 35%, #000 60%, transparent), linear-gradient(to right, transparent, #000 22%, #000 78%, transparent)',
  WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 35%, #000 60%, transparent), linear-gradient(to right, transparent, #000 22%, #000 78%, transparent)',
  maskComposite: 'intersect',
  WebkitMaskComposite: 'source-in',
};

/**
 * Bloco editorial da esquerda: o texto flutua (z-10) e a foto fica de fundo, absoluta,
 * fundida ao off-white por máscara. `rodape` fica embaixo, por cima da foto.
 */
export function BlocoEditorial({ foto, children, rodape, className = 'min-h-[480px] sm:min-h-[540px] lg:min-h-[660px]' }) {
  const [ok, setOk] = useState(true);
  return (
    <div className={`relative isolate flex flex-col justify-between ${className}`}>
      <div aria-hidden className="absolute -left-10 -top-10 -z-10 h-72 w-72 rounded-full bg-esmeralda-brilho/10 blur-[120px]" />
      <div className="relative z-10 max-w-xl space-y-6">{children}</div>
      {rodape && <div className="relative z-10 mt-10">{rodape}</div>}
      {foto && ok && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[62%] opacity-85 lg:h-[58%]">
          <img src={foto} alt="" onError={() => setOk(false)} decoding="async" className="h-full w-full object-cover object-top" style={MASCARA_FUNDO} />
        </div>
      )}
    </div>
  );
}
