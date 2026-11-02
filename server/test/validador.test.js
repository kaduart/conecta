import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliarExtracao, cnpjValido, LIMITE_REVISAO } from '../src/parsers/validador.js';

const hoje = new Date('2026-11-02T12:00:00Z');
const CNPJ_OK = '11.222.333/0001-81';      // dígitos válidos
const CNPJ_RUIM = '12.345.678/0001-90';    // dígitos inválidos
const comps = (de, n, valor) => Object.fromEntries(Array.from({ length: n }, (_, i) => {
  const d = new Date(Date.UTC(2024, de - 1 + i, 1)); return [`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, valor];
}));

test('cnpjValido confere os dígitos verificadores', () => {
  assert.equal(cnpjValido(CNPJ_OK), true);
  assert.equal(cnpjValido(CNPJ_RUIM), false);
  assert.equal(cnpjValido('11.111.111/1111-11'), false);
});

test('leitura limpa com informe coerente passa direto', () => {
  const vinculos = [{ cnpj: CNPJ_OK, tipo: 'EMPREGADO', competencias: comps(1, 12, 10000) }];
  const r = avaliarExtracao({ vinculos, informes: [{ cnpj: CNPJ_OK, ano: '2024', inssAnual: 10900 }], hoje });
  assert.equal(r.score, 100);
  assert.equal(r.revisaoManual, false);
});

test('CNIS sem vínculos zera o score', () => {
  const r = avaliarExtracao({ vinculos: [], hoje });
  assert.equal(r.score, 0);
  assert.equal(r.revisaoManual, true);
});

test('CNPJ inválido + informe incoerente mandam para revisão manual', () => {
  const vinculos = [{ cnpj: CNPJ_RUIM, tipo: 'EMPREGADO', competencias: comps(1, 12, 10000) }];
  const r = avaliarExtracao({ vinculos, informes: [{ cnpj: CNPJ_RUIM, ano: '2024', inssAnual: 0 }], hoje });
  assert.ok(r.score < LIMITE_REVISAO, `score ${r.score}`);
  assert.equal(r.motivos.length, 2);
});

test('valores absurdos (leitura de índice) derrubam o score', () => {
  const c = comps(1, 12, 10000); c['2024-03'] = 7.5; c['2024-04'] = 3; c['2024-05'] = 12;
  const r = avaliarExtracao({ vinculos: [{ cnpj: CNPJ_OK, tipo: 'EMPREGADO', competencias: c }], hoje });
  assert.ok(r.motivos.some((m) => m.includes('fora da faixa')));
});
