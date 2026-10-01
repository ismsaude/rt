/**
 * Importação de lançamentos a partir de células coladas da planilha.
 *
 * O que se cola é só a tabela de lançamentos — o morador e o mês já
 * estão escolhidos na tela. O leitor não depende de cabeçalho: cada
 * linha é reconhecida pela DATA (dd/mm/aaaa) e as colunas seguintes são
 * lidas em ordem, como na planilha da supervisão:
 *
 *   [ITEM] DATA  DESCRIÇÃO  ENTRADA  SAÍDA  OBS  [SALDO]
 *
 * Linhas sem data (cabeçalho, títulos, totais) são ignoradas.
 * A linha "Saldo inicial" não vira lançamento: dá o saldo de abertura.
 */

import { lerValor } from './ledger';

/** Divide texto colado (tabulação do Sheets) ou CSV em linhas de células. */
export function lerCelulas(texto) {
  const bruto = String(texto || '').replace(/\r/g, '');
  const delimitador = bruto.includes('\t') ? '\t' : (bruto.includes(';') ? ';' : ',');

  const linhas = [];
  let linha = [];
  let celula = '';
  let aspas = false;

  for (let i = 0; i < bruto.length; i += 1) {
    const c = bruto[i];
    if (aspas) {
      if (c === '"' && bruto[i + 1] === '"') { celula += '"'; i += 1; }
      else if (c === '"') aspas = false;
      else celula += c;
    } else if (c === '"') {
      aspas = true;
    } else if (c === delimitador) {
      linha.push(celula); celula = '';
    } else if (c === '\n') {
      linha.push(celula); linhas.push(linha); linha = []; celula = '';
    } else {
      celula += c;
    }
  }
  linha.push(celula);
  linhas.push(linha);

  return linhas.map((l) => l.map((c) => c.trim()));
}

/** "02/01/2026" ou "02/01/26" → "2026-01-02" (null se inválida). */
export function lerData(texto) {
  const m = String(texto || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(ano, mes - 1, dia);
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

const ehData = (c) => /^\d{1,2}\/\d{1,2}\/(\d{2}|\d{4})$/.test(c);

/**
 * Lê o texto colado.
 *
 * @returns {{ linhas: Array, saldoInicial: number|null, ignoradas: number }}
 *   cada linha: { n, data, descricao, tipo, cents, obs, saldoPlanilha, problemas[] }
 */
export function lerPlanilha(texto) {
  const celulas = lerCelulas(texto);
  const linhas = [];
  let saldoInicial = null;
  let ignoradas = 0;

  celulas.forEach((cels, idx) => {
    if (cels.every((c) => !c)) return;

    const d = cels.findIndex(ehData);
    if (d === -1) { ignoradas += 1; return; }

    const descricao = cels[d + 1] || '';
    const entrada = cels[d + 2] || '';
    const saida = cels[d + 3] || '';
    const obs = cels[d + 4] || '';
    const saldoTxt = cels[d + 5] || '';
    const saldoPlanilha = saldoTxt ? lerValor(saldoTxt) : null;

    if (/^saldo\s+inicial/i.test(descricao)) {
      saldoInicial = saldoPlanilha;
      return;
    }

    const problemas = [];
    const data = lerData(cels[d]);
    if (!data) problemas.push('data inválida');
    if (!descricao) problemas.push('sem descrição');

    let tipo = null;
    let cents = null;
    const temEntrada = entrada !== '';
    const temSaida = saida !== '';

    if (temEntrada && temSaida) {
      problemas.push('entrada e saída na mesma linha');
    } else if (temEntrada || temSaida) {
      cents = lerValor(temEntrada ? entrada : saida);
      tipo = temEntrada ? 'entrada' : 'saida';
      if (cents === null) problemas.push('valor ilegível');
      else if (cents < 0) cents = -cents; // a planilha marca saída com "-R$"
      if (cents === 0) problemas.push('valor zerado');
    } else {
      problemas.push('sem valor');
    }

    linhas.push({
      n: idx + 1, data, descricao, tipo, cents, obs, saldoPlanilha, problemas,
    });
  });

  return { linhas, saldoInicial, ignoradas };
}

const chave = (data, tipo, cents, descricao) =>
  `${data}|${tipo}|${cents}|${String(descricao).trim().toLowerCase()}`;

/**
 * Marca as linhas que já existem na conta (mesma data, tipo, valor e
 * descrição). Cada lançamento existente "cobre" uma linha só, então duas
 * compras iguais no mesmo dia continuam sendo duas.
 */
export function marcarDuplicadas(linhas, existentes) {
  const contagem = new Map();
  existentes.forEach((l) => {
    const k = chave(l.entry_date, l.kind, l.cents, l.description);
    contagem.set(k, (contagem.get(k) || 0) + 1);
  });

  return linhas.map((l) => {
    if (l.problemas.length) return { ...l, duplicada: false };
    const k = chave(l.data, l.tipo, l.cents, l.descricao);
    const restantes = contagem.get(k) || 0;
    if (restantes > 0) {
      contagem.set(k, restantes - 1);
      return { ...l, duplicada: true };
    }
    return { ...l, duplicada: false };
  });
}

/**
 * Confere o saldo corrente da planilha com o recalculado.
 * Devolve o número (n) da primeira linha em que divergem, ou null.
 */
export function primeiraDivergencia(linhas, saldoInicial) {
  if (saldoInicial == null) return null;
  let saldo = saldoInicial;

  for (const l of linhas) {
    if (l.problemas.length) return null; // sem dados confiáveis para continuar
    saldo += l.tipo === 'entrada' ? l.cents : -l.cents;
    if (l.saldoPlanilha != null && l.saldoPlanilha !== saldo) {
      return { n: l.n, planilha: l.saldoPlanilha, calculado: saldo };
    }
  }
  return null;
}
