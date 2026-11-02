import { Link } from 'react-router-dom';
import { demoApi } from '../lib/demo.js';

// Aviso do modo demonstração: discreto, no rodapé da tela, para não competir com o produto.
export default function FaixaDemo() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-grafite px-4 py-2 text-[13px] text-white/80">
      <span>Demonstração: os dados ficam só neste navegador.</span>
      <Link className="underline underline-offset-2 hover:text-white" to="/c/demo">Fluxo do cliente</Link>
      <Link className="underline underline-offset-2 hover:text-white" to="/painel/login">Painel</Link>
      <button className="underline underline-offset-2 hover:text-white" onClick={() => { demoApi.resetar(); window.location.assign('/c/demo'); }}>Recomeçar</button>
    </div>
  );
}
