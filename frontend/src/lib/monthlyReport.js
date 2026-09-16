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

/** Seções da ficha, com a indicação de quais são individuais. */
export const SHEET_SECTIONS = [
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
  {
    key: 'autonomia',
    label: 'Nível de autonomia',
    hint: 'Higiene, alimentação e atividades — específico de cada um.',
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
  sections.forEach((key) => {
    if (key === 'autonomia') {
      CAMPOS_AUTONOMIA.forEach((c) => { recorte[c] = origem[c] || ''; });
    } else {
      recorte[key] = origem[key] || '';
    }
  });

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
