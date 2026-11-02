import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCnis, parseInforme, normalizar } from '../src/parsers/index.js';

const CNIS = `
Seq. 1  12.345.678/0001-90  NTT DATA BRASIL  Empregado
Data Início 01/07/2022
Competência Remuneração
07/2022 12.000,00   08/2022 12.000,00
Seq. 2  98.765.432/0001-10  COOPERATIVA COOPERSYSTEM Contribuinte Individual
06/2022 6.000,00
07/2022 6.000,00
`;

test('parseCnis lê vínculos, tipo e remuneração por competência', () => {
  const v = parseCnis(CNIS);
  assert.equal(v.length, 2);
  assert.equal(v[0].tipo, 'EMPREGADO');
  assert.equal(v[0].competencias['2022-08'], 12000);
  assert.equal(v[1].tipo, 'CI');
  assert.equal(v[1].competencias['2022-06'], 6000);
});

test('parseInforme lê CNPJ, ano e INSS anual', () => {
  const r = parseInforme('Fonte Pagadora 98.765.432/0001-10\nAno-calendário: 2022\n1. Contribuição previdenciária oficial ........ 1.320,00');
  assert.deepEqual(r, { cnpj: '98.765.432/0001-10', ano: '2022', inssAnual: 1320 });
});

test('normalizar rateia o informe pelos meses e agrupa por competência', () => {
  const v = parseCnis(CNIS);
  const comps = normalizar(v, [{ cnpj: '98.765.432/0001-10', ano: '2022', inssAnual: 1320 }]);
  const jul = comps.find((c) => c.competencia === '2022-07');
  assert.equal(jul.vinculos.length, 2);
  assert.equal(jul.vinculos.find((x) => x.tipo === 'CI').inssDescontado, 660);
});
