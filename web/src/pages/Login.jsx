import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, sessaoContador, DEMO } from '../lib/api.js';
import { CREDENCIAIS_DEMO } from '../lib/demo.js';
import { Aviso, Tela } from '../components/ui.jsx';

export default function Login() {
  const nav = useNavigate();
  const [form, setForm] = useState(DEMO ? CREDENCIAIS_DEMO : { email: '', senha: '' });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [primeiro, setPrimeiro] = useState(false);
  useEffect(() => { api.primeiroAcessoDisponivel().then((r) => setPrimeiro(r.disponivel)).catch(() => {}); }, []);

  async function entrar(e) {
    e.preventDefault(); setEnviando(true); setErro('');
    try { sessaoContador.set(await api.login(form)); nav('/painel'); } catch (e2) { setErro(e2.message); } finally { setEnviando(false); }
  }

  return (
    <Tela>
      <h1 className="titulo">Painel do contador</h1>
      <p className="apoio mt-3">Acesse as auditorias dos seus clientes.</p>
      <form onSubmit={entrar} className="vidro mt-8 space-y-5 p-5">
        <div><label className="rotulo" htmlFor="em">E-mail</label><input id="em" type="email" autoComplete="username" className="campo" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><label className="rotulo" htmlFor="k">Senha</label><input id="k" type="password" autoComplete="current-password" className="campo" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} /></div>
        <Aviso>{erro}</Aviso>
        <button className="btn-primario" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
      {primeiro && <p className="mt-6 text-center text-sm"><Link className="link" to="/painel/primeiro-acesso">Primeiro acesso: cadastrar o escritório</Link></p>}
    </Tela>
  );
}
