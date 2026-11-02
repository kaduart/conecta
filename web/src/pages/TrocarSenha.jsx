import { useState } from 'react';
import { api } from '../lib/api.js';
import PainelLayout from '../components/PainelLayout.jsx';
import { Aviso, Voltar } from '../components/ui.jsx';

export default function TrocarSenha() {
  const [form, setForm] = useState({ senha_atual: '', senha_nova: '', confirmar: '' });
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function salvar(e) {
    e.preventDefault(); setErro(''); setOk(false);
    if (form.senha_nova.length < 10) return setErro('A nova senha precisa ter pelo menos 10 caracteres.');
    if (form.senha_nova !== form.confirmar) return setErro('A confirmação não bate com a nova senha.');
    setEnviando(true);
    try {
      await api.trocarSenha({ senha_atual: form.senha_atual, senha_nova: form.senha_nova });
      setOk(true); setForm({ senha_atual: '', senha_nova: '', confirmar: '' });
    } catch (e2) { setErro(e2.message); } finally { setEnviando(false); }
  }

  const campo = (k, rotulo, auto) => (
    <div>
      <label className="rotulo" htmlFor={k}>{rotulo}</label>
      <input id={k} type="password" autoComplete={auto} className="campo" value={form[k]}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </div>
  );

  return (
    <PainelLayout>
      <Voltar to="/painel">Análises</Voltar>
      <h1 className="titulo mt-4">Trocar senha</h1>
      <form onSubmit={salvar} className="vidro mt-8 max-w-md space-y-4 p-5">
        {campo('senha_atual', 'Senha atual', 'current-password')}
        {campo('senha_nova', 'Nova senha (mínimo 10 caracteres)', 'new-password')}
        {campo('confirmar', 'Confirmar nova senha', 'new-password')}
        <Aviso>{erro}</Aviso>
        {ok && <p className="text-sm text-esmeralda">Senha trocada. Use a nova no próximo login.</p>}
        <button className="btn-primario" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar'}</button>
      </form>
    </PainelLayout>
  );
}
