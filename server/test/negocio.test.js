import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.MONGO_URL ||= 'mongodb://x';
process.env.JWT_SECRET ||= 'teste';
process.env.ENC_KEY ||= crypto.randomBytes(32).toString('base64');

const { auditar } = await import('../src/engine/teto.js');
const { mensagemContador, payloadWebhook, alertaComercial, tratamento } = await import('../src/services/notificacao.js');
const { gerarContrato } = await import('../src/services/contrato.js');
const { perdcompCsv } = await import('../src/services/perdcomp.js');
const { encrypt } = await import('../src/services/crypto.js');

// 2 vínculos de out/2021 a out/2026 (empregado no teto + CI)
const comps = [];
for (let a = 2021; a <= 2026; a++) for (let m = 1; m <= 12; m++) {
  const c = `${a}-${String(m).padStart(2, '0')}`;
  if (c < '2021-10' || c > '2026-09') continue;
  comps.push({ competencia: c, vinculos: [
    { cnpj: '12.345.678/0001-90', tipo: 'EMPREGADO', remuneracao: 15000, ativo: true },
    { cnpj: '98.765.432/0001-10', tipo: 'CI', remuneracao: 6000, ativo: true },
  ] });
}
const r = auditar(comps, { dataBase: '2026-11-02' });
const relatorio = { ...r, recuperavelOnline: r.recuperavel_online, prejuizoPrescrito: r.prejuizo_prescrito, idempotencyKey: 'k1' };
const lead = { _id: 'L1', nome: 'Ana Souza', profissao: 'Médica', whatsapp: '5561999990000', cpfEnc: encrypt('12345678901'), consentimento: { versaoTermo: '2026-11', aceitoEm: new Date('2026-11-01T13:00:00Z'), ip: '200.1.2.3' } };
const contador = { _id: 'C1', escritorio: 'Contábil Alfa', responsavel: 'Carlos Lima', crc: 'CRC-DF 012345/O-1', email: 'c@alfa.com', honorariosPercentual: 35 };

test('alerta ALTA quando a próxima competência prescreve em até 60 dias', () => {
  const a = alertaComercial(relatorio);
  assert.equal(relatorio.gatilhos.proximaCompetenciaAVencer, '2021-10');
  assert.equal(a.prioridade, 'ALTA');
  assert.match(a.itens[0], /prescreve em 18 dias/);
});

test('mensagem ao contador traz nome, profissão, valores e roteiro com título', () => {
  const { texto, roteiro } = mensagemContador({ lead, relatorio, contador, painelUrl: 'https://app/painel/L1' });
  assert.match(texto, /Ana Souza \(Médica\)/);
  assert.match(texto, /Recuperável/);
  assert.match(roteiro, /^Olá, Dr\(a\)\. Ana, sou Carlos Lima, seu contador parceiro do RECUPERA\./);
  assert.match(roteiro, /indício/);
  assert.equal(tratamento('João Silva', 'Engenheiro'), 'João');
});

test('payload do webhook não expõe CPF', () => {
  const p = payloadWebhook({ lead, relatorio, contador, painelUrl: 'x' });
  assert.equal(p.evento, 'auditoria.concluida');
  assert.ok(!JSON.stringify(p).includes('12345678901'));
  assert.ok(!('cpfEnc' in p.lead));
});

test('contrato limita honorários a 30% e mascara o CPF', () => {
  const md = gerarContrato({ lead, contador, relatorio });
  assert.match(md, /\*\*30% \(trinta por cento\)\*\*/);
  assert.match(md, /123\.\*\*\*\.\*\*\*-01/);
  assert.match(md, /200\.1\.2\.3/);
  assert.ok(!md.includes('{{'));
});

test('CSV do PER/DCOMP só leva competências não prescritas', () => {
  const csv = perdcompCsv(relatorio);
  assert.ok(csv.includes('"2021-10"'));
  assert.ok(!csv.includes('"2021-09"'));
});
