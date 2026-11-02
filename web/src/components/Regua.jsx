import { proximaPrescricao, reguaMeses } from '../lib/prazo.js';

/**
 * Elemento-assinatura do RECUPERA: os 60 meses que ainda podem voltar, um traço por mês.
 * O primeiro (âmbar) é o próximo a sair do prazo. Desenha da esquerda para a direita uma vez, no carregamento.
 */
export default function Regua({ className = '', compacta = false }) {
  const meses = reguaMeses();
  const p = proximaPrescricao();
  const anos = meses.filter((m) => m.mes === 0); // marca só as viradas de ano
  return (
    <figure className={className} aria-label={`60 meses de contribuição ainda recuperáveis. ${p.competencia} sai do prazo em ${p.vence}.`}>
      <div className="flex h-16 items-end gap-[3px] sm:h-20" aria-hidden>
        {meses.map((m, i) => (
          <span
            key={m.rotulo}
            className={`regua-traco block flex-1 rounded-full ${i === 0 ? 'regua-primeiro bg-amber-600' : m.mes === 0 ? 'bg-grafite/70' : 'bg-grafite/20'}`}
            style={{ height: i === 0 ? '100%' : m.mes === 0 ? '70%' : '45%', animationDelay: `${i * 12}ms` }}
          />
        ))}
      </div>
      <div className="relative mt-2 h-4 text-[12px] tabular-nums text-apoio" aria-hidden>
        {anos.map((m) => {
          const i = meses.indexOf(m);
          return <span key={m.rotulo} className="absolute -translate-x-0" style={{ left: `${(i / 60) * 100}%` }}>{m.ano}</span>;
        })}
      </div>
      {!compacta && (
        <figcaption className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-apoio">
          Cada traço é um mês de INSS que ainda pode voltar. O primeiro, <span className="font-medium text-amber-800">{p.competencia}</span>, sai do prazo em {p.vence}.
        </figcaption>
      )}
    </figure>
  );
}
