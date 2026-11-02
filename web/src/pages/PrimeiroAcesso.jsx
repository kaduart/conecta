import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, sessaoContador } from '../lib/api.js';
import { Aviso, Tela, Voltar } from '../components/ui.jsx';

// Cadastro do primeiro escritório. A API só aceita enquanto não existe nenhum contador.
const CAMPOS = [
  ['nome_escritorio', 'Escritório', 'text', 'organization'],
  ['nome_responsavel', 'Responsável', 'text', 'name'],
  ['crc', 'CRC', 'text', 'off'],
  ['email', 'E-mail', 'email', 'username'],
  ['whatsapp', 'WhatsApp', 'tel', 'tel-national'],
  ['slug_link', 'Link do convite (ex.: silva)', 'text', 'off'],
  ['senha', 'Senha (mínimo 10 caracteres)', 'password', 'new-password'],
];

export default function PrimeiroAcesso() {
  const nav = useNavigate();
  const [form, setForm] = useState(Object.fromEntries(CAMPOS.map(([k]) => [k, ''])));
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function salvar(e) {
    e.preventDefault(); setEnviando(true); setErro('');
    try { sessaoContador.set(await api.primeiroAcesso(form)); nav('/painel'); } catch (e2) {
      setErro(e2.campos ? `Confira: ${Object.keys(e2.campos).join(', ')}.` : e2.message);
    } finally { setEnviando(false); }
  }

  return (
    <Tela>
      <Voltar to="/painel/login">Entrar</Voltar>
      <h1 className="titulo mt-4">Cadastrar o escritório</h1>
      <p className="apoio mt-3">Este cadastro só funciona uma vez, para o primeiro acesso.</p>
      <form onSubmit={salvar} className="vidro mt-8 space-y-4 p-5">
        {CAMPOS.map(([k, rotulo, tipo, auto]) => (
          <div key={k}>
            <label className="rotulo" htmlFor={k}>{rotulo}</label>
            <input id={k} type={tipo} autoComplete={auto} className="campo" value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: k === 'slug_link' ? e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') : e.target.value })} />
          </div>
        ))}
        <Aviso>{erro}</Aviso>
        <button className="btn-primario" disabled={enviando}>{enviando ? 'Criando…' : 'Criar e entrar'}</button>
      </form>
    </Tela>
  );
}
