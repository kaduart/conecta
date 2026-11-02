import { Navigate, Route, Routes } from 'react-router-dom';
import Convite from './pages/Convite.jsx';
import Consentimento from './pages/Consentimento.jsx';
import Upload from './pages/Upload.jsx';
import Processando from './pages/Processando.jsx';
import Concluido from './pages/Concluido.jsx';
import Login from './pages/Login.jsx';
import Painel from './pages/Painel.jsx';
import Detalhe from './pages/Detalhe.jsx';
import { DEMO } from './lib/api.js';
import FaixaDemo from './components/FaixaDemo.jsx';

export default function App() {
  return (
    <>
      <div className="malha" aria-hidden />
      {DEMO && <FaixaDemo />}
      <Routes>
        {/* Fluxo do cliente: link do contador /c/:slug */}
        <Route path="/c/:slug" element={<Convite />} />
        <Route path="/c/:slug/consentimento" element={<Consentimento />} />
        <Route path="/c/:slug/documentos" element={<Upload />} />
        <Route path="/c/:slug/processando" element={<Processando />} />
        <Route path="/c/:slug/concluido" element={<Concluido />} />
        {/* Painel do contador */}
        <Route path="/painel/login" element={<Login />} />
        <Route path="/painel" element={<Painel />} />
        <Route path="/painel/:id" element={<Detalhe />} />
        <Route path="*" element={<Navigate to="/painel" replace />} />
      </Routes>
    </>
  );
}
