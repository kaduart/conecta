import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditar, contribuicaoEmpregado, vencimentoPrescricao } from '../src/engine/teto.js';
import { PARAMS } from '../src/engine/params.js';

const BASE = '2026-11-02';

test('cota máxima calculada pela tabela bate com a Portaria (±R$0,05)', () => {
  for (const p of PARAMS.filter((x) => x.faixas && x.confirmado)) {
    const calc = contribuicaoEmpregado(p.teto, p.faixas);
    assert.ok(Math.abs(calc - p.cotaMaxima) <= 0.05, `${p.de}: calculado ${calc} x tabela ${p.cotaMaxima}`);
  }
});

test('prescrição conta da data do recolhimento: out/2021 ainda vale em 02/11/2026, set/2021 não', () => {
  assert.equal(vencimentoPrescricao('2021-10').toISOString().slice(0, 10), '2026-11-20');
  const r = auditar([
    { competencia: '2021-09', vinculos: [{ cnpj: 'A', tipo: 'EMPREGADO', remuneracao: 9000 }, { cnpj: 'B', tipo: 'CI', remuneracao: 6000 }] },
    { competencia: '2021-10', vinculos: [{ cnpj: 'A', tipo: 'EMPREGADO', remuneracao: 9000 }, { cnpj: 'B', tipo: 'CI', remuneracao: 6000 }] },
  ], { dataBase: BASE });
  assert.equal(r.meses[0].prescrito, true);
  assert.equal(r.meses[1].prescrito, false);
  assert.equal(r.gatilhos.proximaCompetenciaAVencer, '2021-10');
  assert.equal(r.gatilhos.diasParaPrescrever, 18);
});

test('CLT no teto + cooperativa: todo o INSS da cooperativa é excesso', () => {
  const r = auditar([
    { competencia: '2024-05', vinculos: [
      { cnpj: 'NTT', tipo: 'EMPREGADO', remuneracao: 15000, inssDescontado: 908.85 },
      { cnpj: 'COOP', tipo: 'CI', remuneracao: 10000, inssDescontado: 856.46 },
    ] },
  ], { dataBase: BASE });
  assert.equal(r.meses[0].excesso, 856.46);
  assert.equal(r.recuperavel_online, 856.46);
  assert.equal(r.meses[0].confianca, 'COMPROVADO');
});

test('vínculo único abaixo do teto não gera excesso', () => {
  const r = auditar([{ competencia: '2022-03', vinculos: [{ cnpj: 'A', tipo: 'EMPREGADO', remuneracao: 5000 }] }], { dataBase: BASE });
  assert.equal(r.meses[0].excesso, 0);
});

test('separa recuperável e prejuízo prescrito; detecta início da bitributação', () => {
  const coop = { cnpj: 'COOP', tipo: 'CI', remuneracao: 6000 };
  const ntt = { cnpj: 'NTT', tipo: 'EMPREGADO', remuneracao: 12000 };
  const comps = [];
  for (let m = 1; m <= 12; m++) comps.push({ competencia: `2021-${String(m).padStart(2, '0')}`, vinculos: [coop] });
  for (let m = 1; m <= 6; m++) comps.push({ competencia: `2022-${String(m).padStart(2, '0')}`, vinculos: [coop] });
  for (let m = 7; m <= 12; m++) comps.push({ competencia: `2022-${String(m).padStart(2, '0')}`, vinculos: [coop, ntt] });
  const r = auditar(comps, { dataBase: BASE });
  assert.equal(r.gatilhos.bitributacaoDesde, '2022-07');
  assert.equal(r.prejuizo_prescrito, 0); // cooperativa sozinha não passa do teto
  assert.ok(r.recuperavel_online > 0);
  assert.equal(r.meses.find((m) => m.competencia === '2022-07').excesso, 660); // 11% de 6.000
});
