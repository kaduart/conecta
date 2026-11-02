// Preenche a minuta de honorários de êxito com os dados do lead, do contador e do relatório.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decrypt } from './crypto.js';

const MODELO = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../templates/contrato.md'), 'utf8');
export const VERSAO_MODELO = '2026.11-1';
export const TETO_HONORARIOS = 30; // limite do produto: até 30% do valor efetivamente recuperado

const brl = (v) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const UNID = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZ = ['', '', 'vinte', 'trinta'];
const extenso = (n) => (n < 20 ? UNID[n] : DEZ[Math.floor(n / 10)] + (n % 10 ? ` e ${UNID[n % 10]}` : ''));
const dataHora = (d) => (d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'não registrado');
const mascararCpf = (cpf) => (cpf ? cpf.replace(/^(\d{3})\.?\d{3}\.?\d{3}-?(\d{2})$/, '$1.***.***-$2') : '____.____.____-__');

function get(obj, chave) {
  return chave.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function dadosContrato({ lead, contador, relatorio, cidade = '________', retencaoDias = 30, mostrarCpfCompleto = false }) {
  const percentual = Math.min(Math.round(contador.honorariosPercentual ?? TETO_HONORARIOS), TETO_HONORARIOS);
  const validos = (relatorio.meses || []).filter((m) => !m.prescrito && m.excesso > 0).map((m) => m.competencia);
  const fmt = (c) => (c ? `${c.slice(5)}/${c.slice(0, 4)}` : '');
  const cpf = lead.cpfEnc ? decrypt(lead.cpfEnc) : null;
  const agora = new Date();
  return {
    geradoEm: dataHora(agora),
    versaoModelo: VERSAO_MODELO,
    cidade,
    dataExtenso: agora.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }),
    cliente: { nome: lead.nome, profissao: lead.profissao, whatsapp: lead.whatsapp, cpf: mostrarCpfCompleto ? cpf || '____' : mascararCpf(cpf) },
    contador: {
      escritorio: contador.escritorio,
      cnpjTexto: contador.cnpj ? `, CNPJ ${contador.cnpj}` : '',
      responsavel: contador.responsavel,
      crc: contador.crc,
      email: contador.email,
    },
    relatorio: {
      dataBase: relatorio.dataBase?.split('-').reverse().join('/'),
      recuperavelTexto: brl(relatorio.recuperavelOnline),
      prescritoTexto: brl(relatorio.prejuizoPrescrito),
      periodo: validos.length ? `${fmt(validos[0])} a ${fmt(validos.at(-1))}` : 'sem competências com excesso',
    },
    honorarios: {
      percentual,
      percentualExtenso: extenso(percentual),
      estimativaTexto: brl(Math.round(relatorio.recuperavelOnline * percentual) / 100),
    },
    consentimento: {
      aceitoEm: dataHora(lead.consentimento?.aceitoEm),
      ip: lead.consentimento?.ip || 'não registrado',
      versaoTermo: lead.consentimento?.versaoTermo || '-',
    },
    lgpd: { retencaoDias },
  };
}

/** Retorna o contrato em Markdown, pronto para virar PDF ou ir para assinatura eletrônica. */
export function gerarContrato(args) {
  const dados = dadosContrato(args);
  return MODELO.replace(/\{\{([\w.]+)\}\}/g, (_, chave) => {
    const v = get(dados, chave);
    return v == null ? '____' : String(v);
  });
}
