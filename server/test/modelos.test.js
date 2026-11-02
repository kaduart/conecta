// Valida os schemas sem banco (validateSync) e o mapeamento motor -> RelatorioAuditoria -> API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';

process.env.MONGO_URL ||= 'mongodb://x';
process.env.JWT_SECRET ||= 'teste';
process.env.ENC_KEY ||= crypto.randomBytes(32).toString('base64');

const { Contador, Lead, RelatorioAuditoria } = await import('../src/models/index.js');
const { auditar } = await import('../src/engine/teto.js');
const { paraRelatorio, relatorioParaApi } = await import('../src/engine/mapear.js');
const { hashSenha, conferirSenha } = await import('../src/services/senha.js');

const id = () => new mongoose.Types.ObjectId();

test('Contador exige campos obrigatórios e valida slug e WhatsApp', () => {
  const ruim = new Contador({ nome_escritorio: 'X', slug_link: 'Com Espaço', whatsapp: '61999' }).validateSync();
  for (const campo of ['nome_responsavel', 'crc', 'email', 'password_hash', 'slug_link', 'whatsapp']) assert.ok(ruim.errors[campo], campo);
  const ok = new Contador({ nome_escritorio: 'X', nome_responsavel: 'Y', crc: 'CRC-DF 1', email: 'a@b.com', password_hash: 'h', whatsapp: '5561999990000', slug_link: 'silva' });
  assert.equal(ok.validateSync(), undefined);
  assert.equal(ok.status, 'ATIVO');
});

test('Lead nasce em CADASTRO com consentimento falso', () => {
  const l = new Lead({ contador_id: id(), nome: 'Ana', profissao: 'Médica', whatsapp: '5561999990000', token_seguranca: 'h' });
  assert.equal(l.validateSync(), undefined);
  assert.equal(l.status_jornada, 'CADASTRO');
  assert.equal(l.consentimento_lgpd.aceito, false);
  assert.equal(l.consentimento_lgpd.versao_termo, '1.0.0');
});

test('saída do motor vira RelatorioAuditoria válido e volta para o formato da API', () => {
  const comps = ['2021-10', '2022-07', '2024-05'].map((c) => ({ competencia: c, vinculos: [
    { cnpj: '11.222.333/0001-81', nome: 'HOSPITAL', tipo: 'EMPREGADO', remuneracao: 15000, ativo: true },
    { cnpj: 'CI', nome: 'COOP', tipo: 'CI', remuneracao: 6000, ativo: true }] }));
  const r = auditar(comps, { dataBase: '2026-11-02' });
  const dados = paraRelatorio(r, { extracao: { score: 90, motivos: [] }, honorariosPercentual: 30 });
  const doc = new RelatorioAuditoria({ ...dados, lead_id: id(), contador_id: id(), idempotency_key: 'k' });
  assert.equal(doc.validateSync(), undefined);
  assert.equal(doc.resumo_financeiro.honorarios_estimados, Math.round(r.recuperavel_online * 30) / 100);
  assert.equal(doc.gatilhos_detectados.multiplos_vinculos, true);
  assert.equal(doc.cronograma_mensal[0].status_prazo, 'DISPONIVEL');
  assert.deepEqual(doc.cronograma_mensal[0].fontes_detectadas, ['HOSPITAL', 'COOP']);
  const api = relatorioParaApi(doc.toObject());
  assert.equal(api.recuperavelOnline, r.recuperavel_online);
  assert.equal(api.meses.length, 3);
});

test('score baixo vira grau de confiança BAIXO', () => {
  const r = auditar([{ competencia: '2024-05', vinculos: [{ cnpj: 'x', tipo: 'EMPREGADO', remuneracao: 9000 }] }], { dataBase: '2026-11-02' });
  assert.equal(paraRelatorio(r, { extracao: { score: 40, motivos: ['x'] } }).resumo_financeiro.grau_confianca, 'BAIXO');
});

test('senha: hash scrypt confere a certa e recusa a errada', async () => {
  const h = await hashSenha('senha-forte-123');
  assert.ok(h.startsWith('scrypt$'));
  assert.equal(await conferirSenha('senha-forte-123', h), true);
  assert.equal(await conferirSenha('outra-senha-123', h), false);
  await assert.rejects(() => hashSenha('curta'));
});
