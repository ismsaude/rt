/**
 * Recursos do morador: livro-caixa e saldo.
 *
 * Todo cálculo é feito em CENTAVOS inteiros. Somar reais em ponto
 * flutuante gera diferenças de um centavo (0,1 + 0,2), e o relatório
 * existe justamente para provar que o saldo bate com o extrato.
 *
 * O saldo de cada linha não é gravado: é recalculado na leitura a
 * partir do saldo inicial do mês. Corrigir ou apagar um lançamento
 * nunca deixa saldo errado para trás.
 */

import { supabase } from './supabase';
import { uid } from './id';
import { toISODate } from './format';

/* ------------------------------------------------------------------ */
/* Valores                                                            */
/* ------------------------------------------------------------------ */

/**
 * Lê um valor digitado em reais e devolve centavos (ou null se inválido).
 * Aceita "1.234,56", "1234,56", "1234.56" e "R$ 17,50".
 */
export function lerValor(texto) {
  if (typeof texto === 'number') return Number.isFinite(texto) ? Math.round(texto * 100) : null;

  let s = String(texto ?? '').replace(/R\$|\s/g, '');
  if (!s) return null;

  const negativo = s.startsWith('-') || s.endsWith('-');
  s = s.replace(/-/g, '');

  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;

  const centavos = Math.round(Number(s) * 100);
  return negativo ? -centavos : centavos;
}

/** Centavos → "R$ 1.234,56". */
export function formatarReais(centavos) {
  if (centavos == null) return '—';
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Centavos → "1234,56", para preencher um campo de edição. */
export function paraCampo(centavos) {
  if (centavos == null) return '';
  return (centavos / 100).toFixed(2).replace('.', ',');
}

const emCentavos = (numeric) => (numeric == null ? null : Math.round(Number(numeric) * 100));
const emNumeric = (centavos) => (centavos == null ? null : centavos / 100);

/* ------------------------------------------------------------------ */
/* Cálculo                                                            */
/* ------------------------------------------------------------------ */

export const mesDe = (dataISO) => String(dataISO).slice(0, 7);

const mesSeguinte = (monthKey) => {
  const [y, m] = monthKey.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};

/** Efeito líquido de um lançamento no saldo, em centavos. */
const efeito = (l) => (l.kind === 'entrada' ? l.cents : -l.cents);

/** Ordem do extrato: por data e, no mesmo dia, por ordem de lançamento. */
function ordenar(linhas) {
  return [...linhas].sort(
    (a, b) =>
      a.entry_date.localeCompare(b.entry_date) ||
      String(a.created_at).localeCompare(String(b.created_at))
  );
}

/**
 * Saldo inicial do mês.
 *
 * Vale o saldo informado à mão naquele mês; se não houver, o saldo
 * final do mês anterior, e assim por diante até o primeiro mês em que
 * alguém informou um saldo. Sem nenhum, não há como saber: devolve
 * `definido: false`, e a tela pede o saldo em vez de assumir zero.
 */
export function saldoInicialDoMes(monthKey, lancamentos, meses) {
  const manuais = meses
    .filter((m) => m.opening_cents != null && m.month <= monthKey)
    .map((m) => m.month)
    .sort();

  if (manuais.length === 0) return { centavos: 0, definido: false, manual: false };

  const origem = manuais[0];
  const porMes = {};
  lancamentos.forEach((l) => {
    const k = mesDe(l.entry_date);
    porMes[k] = (porMes[k] || 0) + efeito(l);
  });
  const manualDe = (k) => meses.find((m) => m.month === k)?.opening_cents ?? null;

  let saldo = manualDe(origem);
  for (let k = origem; k < monthKey; k = mesSeguinte(k)) {
    saldo += porMes[k] || 0;
    const proximo = mesSeguinte(k);
    const correcao = manualDe(proximo);
    if (correcao != null) saldo = correcao;
  }

  return {
    centavos: saldo,
    definido: true,
    manual: manualDe(monthKey) != null,
  };
}

/**
 * Monta o relatório do mês: linhas com saldo corrente e totais.
 * A linha 1 é sempre o "Saldo inicial", como no modelo oficial.
 */
export function montarRelatorio(monthKey, lancamentos, meses) {
  const inicial = saldoInicialDoMes(monthKey, lancamentos, meses);
  const doMes = ordenar(lancamentos.filter((l) => mesDe(l.entry_date) === monthKey));

  let saldo = inicial.centavos;
  let entradas = 0;
  let saidas = 0;

  const linhas = doMes.map((l, i) => {
    saldo += efeito(l);
    if (l.kind === 'entrada') entradas += l.cents;
    else saidas += l.cents;
    return { ...l, item: i + 2, saldo };
  });

  return {
    inicial,
    linhas,
    entradas,
    saidas,
    final: saldo,
  };
}

/* ------------------------------------------------------------------ */
/* Leitura e gravação                                                 */
/* ------------------------------------------------------------------ */

const paraLancamento = (row) => ({ ...row, cents: emCentavos(row.amount), receipts: row.receipts || [] });
const paraMes = (row) => ({
  ...row,
  opening_cents: emCentavos(row.opening_balance),
  bank_closing_cents: emCentavos(row.bank_closing_balance),
  statement_photos: row.statement_photos || [],
});

/** Tudo o que existe do morador: o saldo depende de todos os meses anteriores. */
export async function carregarConta(residentId) {
  const [lanc, meses] = await Promise.all([
    supabase.from('ResidentLedger').select('*').eq('resident_id', residentId),
    supabase.from('LedgerMonth').select('*').eq('resident_id', residentId),
  ]);

  const error = lanc.error || meses.error;
  return {
    error,
    lancamentos: (lanc.data || []).map(paraLancamento),
    meses: (meses.data || []).map(paraMes),
  };
}

export function novoLancamento({ residentId, dataISO, author }) {
  return {
    id: uid(),
    resident_id: residentId,
    entry_date: dataISO || toISODate(new Date()),
    description: '',
    kind: 'saida',
    cents: null,
    obs: '',
    receipts: [],
    author_name: author || null,
  };
}

/** Grava (insere ou atualiza) um lançamento. */
export async function salvarLancamento(l) {
  const payload = {
    id: l.id,
    resident_id: l.resident_id,
    entry_date: l.entry_date,
    description: l.description.trim(),
    kind: l.kind,
    amount: emNumeric(l.cents),
    obs: l.obs?.trim() || null,
    receipts: l.receipts || [],
    author_name: l.author_name,
    updated_at: new Date().toISOString(),
  };
  return supabase.from('ResidentLedger').upsert(payload, { onConflict: 'id' });
}

/**
 * Grava vários lançamentos de uma vez (importação).
 * O created_at cresce de 1 ms em 1 ms para manter a ordem da planilha
 * dentro do mesmo dia.
 */
export async function salvarLancamentos(lista) {
  const base = Date.now();
  const linhas = lista.map((l, i) => ({
    id: l.id,
    resident_id: l.resident_id,
    entry_date: l.entry_date,
    description: l.description.trim(),
    kind: l.kind,
    amount: emNumeric(l.cents),
    obs: l.obs?.trim() || null,
    receipts: [],
    author_name: l.author_name,
    created_at: new Date(base + i).toISOString(),
    updated_at: new Date().toISOString(),
  }));
  return supabase.from('ResidentLedger').insert(linhas);
}

export const apagarLancamento = (id) => supabase.from('ResidentLedger').delete().eq('id', id);

/** Grava campos do mês (saldo inicial, saldo do extrato, fotos do extrato). */
export async function salvarMes({ residentId, monthKey, campos }) {
  const payload = {
    resident_id: residentId,
    month: monthKey,
    updated_at: new Date().toISOString(),
  };
  if ('opening_cents' in campos) payload.opening_balance = emNumeric(campos.opening_cents);
  if ('bank_closing_cents' in campos) payload.bank_closing_balance = emNumeric(campos.bank_closing_cents);
  if ('statement_photos' in campos) payload.statement_photos = campos.statement_photos;

  return supabase.from('LedgerMonth').upsert(payload, { onConflict: 'resident_id,month' });
}
