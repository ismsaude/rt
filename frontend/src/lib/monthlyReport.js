/**
 * Ficha mensal: leitura, gravação e cópia entre moradores.
 *
 * Boa parte do que a supervisão escreve é da casa — uma obra, a visita
 * de um médico, uma festividade — e se repete em todas as fichas do
 * mês. Copiar essas seções poupa retrabalho.
 *
 * O que NÃO se copia por padrão é o que descreve a pessoa: comportamento,
 * adesão e autonomia. Repetir esse conteúdo em outro prontuário insere
 * informação falsa sobre alguém, e é o tipo de coisa que uma auditoria
 * encontra ao ver duas fichas idênticas.
 */

import { supabase } from './supabase';
import { uid } from './id';
import { calcAge, listarComE } from './format';

/** Seções da ficha, com a indicação de quais são individuais. */
export const SHEET_SECTIONS = [
  {
    key: 'observacoes',
    label: 'Condições clínicas e observações',
    hint: 'Descreve a pessoa: vem do cadastro de cada morador.',
    individual: true,
  },
  {
    key: 'intervencoes',
    label: 'Intervenções realizadas',
    hint: 'Costuma ser da casa: visitas, obras, avaliações coletivas.',
    individual: false,
  },
  {
    key: 'interacoes',
    label: 'Interações sociais e familiares',
    hint: 'Festividades e atividades coletivas valem para todos.',
    individual: false,
  },
  {
    key: 'comportamento',
    label: 'Mudanças no comportamento',
    hint: 'Descreve a pessoa. Copiar insere informação falsa.',
    individual: true,
  },
  {
    key: 'adesao',
    label: 'Adesão ao tratamento',
    hint: 'Depende da medicação e da resposta de cada morador.',
    individual: true,
  },
];

/** Seções marcadas por padrão: apenas as que não descrevem a pessoa. */
export const DEFAULT_CLONE_SECTIONS = SHEET_SECTIONS
  .filter((s) => !s.individual)
  .map((s) => s.key);

const CAMPOS_AUTONOMIA = [
  'autonomia_higiene',
  'autonomia_alimentacao',
  'autonomia_atividades',
];

/*
 * O nível de autonomia não entra na cópia, de propósito: é atributo do
 * morador, mantido na Central de Cadastros, e copiá-lo entre prontuários
 * afirma sobre uma pessoa o que foi observado em outra.
 */

/** Fichas já existentes de um mês, por morador. */
export async function loadMonthSheets(monthKey) {
  const { data, error } = await supabase
    .from('MonthlyReport')
    .select('*')
    .eq('month', monthKey);

  const porMorador = new Map((data || []).map((r) => [r.resident_id, r]));
  return { porMorador, error };
}

/** Uma ficha tem conteúdo quando alguma seção foi preenchida. */
export function hasContent(row) {
  if (!row) return false;
  const campos = ['intervencoes', 'comportamento', 'adesao', 'interacoes', ...CAMPOS_AUTONOMIA];
  return campos.some((c) => String(row[c] || '').trim());
}

/**
 * Copia as seções escolhidas da ficha de origem para outros moradores.
 *
 * @param {object}   origem      ficha de origem (o formulário atual)
 * @param {string[]} sections    chaves de SHEET_SECTIONS
 * @param {Array}    destinos    [{ id, name }]
 * @param {string}   monthKey
 * @param {object}   author      { name }
 * @returns {{ ok: number, erros: Array }}
 */
export async function cloneSheet({ origem, sections, destinos, monthKey, author }) {
  const { porMorador } = await loadMonthSheets(monthKey);

  const recorte = {};
  sections.forEach((key) => { recorte[key] = origem[key] || ''; });

  const erros = [];
  let ok = 0;

  for (const destino of destinos) {
    const existente = porMorador.get(destino.id);

    const payload = {
      ...recorte,
      resident_id: destino.id,
      resident_name: destino.name,
      month: monthKey,
      author_name: author?.name || 'Supervisão',
      updated_at: new Date().toISOString(),
    };

    // Preserva a data de emissão já escolhida na ficha de destino.
    const { error } = existente
      ? await supabase.from('MonthlyReport').update(payload).eq('id', existente.id)
      : await supabase
          .from('MonthlyReport')
          .insert([{ id: uid(), emitido_em: origem.emitido_em || null, ...payload }]);

    if (error) erros.push({ morador: destino.name, mensagem: error.message });
    else ok += 1;
  }

  return { ok, erros };
}

/**
 * Resumo clínico do morador para a seção de observações.
 *
 * As condições são lidas do cadastro exatamente como foram escritas —
 * já vêm flexionadas por morador ("Diabético" / "Diabética") — e só
 * têm a inicial reduzida para caber na frase.
 */
export function buildObservacoes(resident) {
  if (!resident) return '';

  const feminino = String(resident.sex || '').toLowerCase().startsWith('f');
  const tratamento = feminino ? 'Moradora' : 'Morador';

  const idade = calcAge(resident.dateOfBirth);
  const abertura = idade != null
    ? `${tratamento} de ${idade} anos`
    : tratamento;

  const condicoes = String(resident.conditions || resident.allergies || '')
    .split(/[,;]/)
    .map((c) => c.trim())
    .filter(Boolean)
    // Termos em caixa alta são siglas e permanecem; os demais ficam em
    // minúsculas por inteiro, para não sobrar "prolapso Vaginal" no meio
    // da frase.
    .map((c) => (c === c.toUpperCase() && c.length <= 5 ? c : c.toLowerCase()));

  if (condicoes.length === 0) {
    return `${abertura}. Sem condições clínicas registradas no cadastro.`;
  }

  return `${abertura}, ${listarComE(condicoes)}.`;
}
