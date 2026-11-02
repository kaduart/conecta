import { Link } from 'react-router-dom';
import { demoApi } from '../lib/demo.js';

// Aviso fixo do modo demonstração: nada vai para servidor, tudo fica neste navegador.
export default function FaixaDemo() {
  return (
    <div className="bg-ambar-fundo/70 px-4 py-2 text-center text-xs text-ambar-escuro">
      <strong>Modo demonstração</strong>: os dados ficam só neste navegador.{' '}
      <Link className="underline" to="/c/demo">Fluxo do cliente</Link> ·{' '}
      <Link className="underline" to="/painel/login">Painel</Link> ·{' '}
      <button className="underline" onClick={() => { demoApi.resetar(); window.location.assign('/c/demo'); }}>Zerar</button>
    </div>
  );
}
