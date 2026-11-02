import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, sessaoLead } from '../lib/api.js';
import { Aviso, BlocoEditorial, Carregando, Tela } from '../components/ui.jsx';
import { FOTO_CLIENTE } from '../lib/imagens.js';
import Regua from '../components/Regua.jsx';
import { proximaPrescricao } from '../lib/prazo.js';

const PROFISSOES = ['Médico(a)', 'Professor(a) universitário(a)', 'Profissional de TI', 'Engenheiro(a)', 'Diretor(a)', 'Outra'];

// Máscara simples de celular brasileiro: (61) 99999-0000
const mascara = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export default function Convite() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [convite, setConvite] = useState(null);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({ nome: '', profissao: '', outra: '', whatsapp: '' });
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.convite(slug).then(setConvite).catch((e) => setErro(e.message));
  }, [slug]);

  const profissao = form.profissao === 'Outra' ? form.outra.trim() : form.profissao;
  const valido = form.nome.trim().length >= 3 && profissao.length >= 2 && form.whatsapp.replace(/\D/g, '').length >= 10;

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true); setErro('');
    try {
      const r = await api.criarLead(slug, { nome: form.nome.trim(), profissao, whatsapp: form.whatsapp });
      sessaoLead.set({ ...r, slug, escritorio: convite.escritorio });
      nav(`/c/${slug}/consentimento`);
    } catch (e2) { setErro(e2.message); } finally { setEnviando(false); }
  }

  if (!convite && !erro) return <Tela><Carregando /></Tela>;

  const editorial = (
    <>
    <BlocoEditorial foto={FOTO_CLIENTE} className="min-h-[470px] sm:min-h-[520px] lg:min-h-[560px]">
      {convite && <p className="text-[15px] text-apoio">Convite de {convite.escritorio}, {/^crc/i.test(convite.crc) ? convite.crc : `CRC ${convite.crc}`}</p>}
      <h1 className="font-titulo text-4xl font-normal leading-[1.08] tracking-tight text-grafite sm:text-5xl lg:text-6xl">Seu <em className="relative inline-block font-semibold italic text-esmeralda-escuro">INSS<span aria-hidden className="absolute inset-x-[-0.06em] bottom-[0.08em] -z-10 h-[0.32em] rounded-sm bg-esmeralda-brilho/45" /></em> pago a mais<br className="hidden sm:block" /> tem prazo para voltar.</h1>
      <p className="max-w-[44ch] text-base font-light leading-relaxed text-apoio lg:text-lg">
        Quem trabalha em mais de uma empresa, cooperativa ou hospital costuma contribuir acima do teto. O excesso dos últimos 5 anos pode ser pedido de volta.
      </p>
    </BlocoEditorial>
    <Regua className="mt-2" compacta />
    <NotaPrazo />
    </>
  );

  return (
    <Tela lateral={editorial} rodape="Leva cerca de 5 minutos. Não pedimos sua senha do gov.br.">
      {convite && (
        <form onSubmit={enviar} className="cartao space-y-6 p-7 sm:p-10" noValidate>
          <div>
            <h2 className="font-titulo text-2xl font-medium">Começar a análise</h2>
            <p className="mt-1 text-[15px] text-apoio">Seu contador recebe o resultado.</p>
          </div>
          <div>
            <label className="rotulo" htmlFor="nome">Nome</label>
            <input id="nome" className="campo" autoComplete="name" placeholder="Como você se chama" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <label className="rotulo" htmlFor="profissao">Profissão</label>
            <select id="profissao" className="campo appearance-none" value={form.profissao} onChange={(e) => setForm({ ...form, profissao: e.target.value })}>
              <option value="" disabled>Selecione</option>
              {PROFISSOES.map((p) => <option key={p}>{p}</option>)}
            </select>
            {form.profissao === 'Outra' && (
              <input className="campo mt-2" placeholder="Qual?" value={form.outra} onChange={(e) => setForm({ ...form, outra: e.target.value })} />
            )}
          </div>
          <div>
            <label className="rotulo" htmlFor="wa">WhatsApp</label>
            <input id="wa" className="campo" inputMode="tel" autoComplete="tel-national" placeholder="(61) 99999-0000" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: mascara(e.target.value) })} />
          </div>
          <Aviso>{erro}</Aviso>
          <button className="btn-primario" disabled={!valido || enviando}>{enviando ? 'Enviando…' : 'Começar a análise'}</button>
        </form>
      )}
      {!convite && <Aviso>{erro}</Aviso>}
    </Tela>
  );
}

// Nota de rodapé: calculada pela data de hoje, nunca fixa no texto.
function NotaPrazo() {
  const p = proximaPrescricao();
  return (
    <p className="mt-4 max-w-[52ch] text-[14px] font-light leading-relaxed text-apoio">
      Cada traço da régua é um mês que ainda pode voltar. As contribuições de <span className="font-normal text-amber-800">{p.competencia}</span> saem do prazo em {p.vence}.
    </p>
  );
}

