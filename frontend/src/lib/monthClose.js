/**
 * Fechamento do mês: as fichas da casa inteira de uma vez.
 *
 * Emitir doze fichas uma a uma é o mesmo trabalho repetido doze vezes —
 * abrir o morador, gerar os rascunhos, salvar, assinar, imprimir. Aqui
 * as três etapas acontecem para todos os moradores do mês: gerar,
 * assinar e baixar.
 *
 * Duas coisas o lote não faz, de propósito:
 *
 *   • não sobrescreve texto escrito por gente — o rascunho só entra em
 *     seção vazia, para não apagar a leitura clínica da supervisão;
 *   • não toca em ficha já assinada — o documento impresso precisa
 *     continuar sendo exatamente o que foi assinado.
 */

import { supabase } from './supabase';
import { uid } from './id';
import { toISODate } from './format';
import { buildMonthlySummary } from './shiftReports';
import { buildObservacoes, hasContent, loadMonthSheets } from './monthlyReport';
import {
  draftAdesao, draftComportamento, draftIntervencoes, draftInteracoes,
} from './sheetDrafts';

/** Situação da ficha de um morador no mês. */
export function estadoDaFicha(row) {
  if (row?.signed_by_name) return 'assinada';
  if (hasContent(row)) return 'preenchida';
  return 'vazia';
}

export const ROTULO_DO_ESTADO = {
  vazia: 'sem conteúdo',
  preenchida: 'preenchida',
  assinada: 'assinada',
};

const vazio = (valor) => !String(valor || '').trim();

/**
 * Monta a ficha de um morador a partir do que está registrado no mês.
 *
 * Devolve só os campos a gravar. O que já estava escrito permanece:
 * `manter` decide pelo conteúdo atual sempre que ele existe.
 */
export function montarRascunho({ resident, monthKey, existente, reports, events, incidents }) {
  const summary = buildMonthlySummary(reports, resident.id, monthKey);
  const atual = existente || {};
  const residentId = resident.id;

  const manter = (valorAtual, rascunho) => (vazio(valorAtual) ? rascunho : valorAtual);

  return {
    observacoes: manter(atual.observacoes, buildObservacoes(resident)),
    intervencoes: manter(atual.intervencoes, draftIntervencoes({ events, residentId, monthKey })),
    comportamento: manter(
      atual.comportamento,
      draftComportamento({ summary, incidents, residentId, monthKey })
    ),
    adesao: manter(atual.adesao, draftAdesao({ summary })),
    interacoes: manter(atual.interacoes, draftInteracoes({ events, residentId, monthKey })),
    autonomia_higiene: manter(atual.autonomia_higiene, resident.autonomy_hygiene || ''),
    autonomia_alimentacao: manter(atual.autonomia_alimentacao, resident.autonomy_food || ''),
    autonomia_atividades: manter(atual.autonomia_atividades, resident.autonomy_activities || ''),
    emitido_em: atual.emitido_em || toISODate(new Date()),
  };
}

/**
 * Gera (ou completa) as fichas do mês para os moradores escolhidos.
 *
 * @returns {{ geradas: number, assinadas: number, semDados: string[], erros: Array }}
 */
export async function gerarFichasDoMes({
  residents, monthKey, reports, events, incidents, author,
}) {
  const { porMorador } = await loadMonthSheets(monthKey);

  const erros = [];
  const semDados = [];
  let geradas = 0;
  let assinadas = 0;

  for (const resident of residents) {
    const existente = porMorador.get(resident.id);

    if (existente?.signed_by_name) {
      assinadas += 1;
      continue;
    }

    const rascunho = montarRascunho({
      resident, monthKey, existente, reports, events, incidents,
    });

    // Sem plantão, sem agenda e sem cadastro não há o que afirmar: a
    // ficha fica para preenchimento à mão em vez de nascer em branco.
    if (!hasContent(rascunho)) {
      semDados.push(resident.name);
      continue;
    }

    const payload = {
      ...rascunho,
      resident_id: resident.id,
      resident_name: resident.name,
      month: monthKey,
      author_name: author?.name || 'Supervisão',
      updated_at: new Date().toISOString(),
    };

    const { error } = existente
      ? await supabase.from('MonthlyReport').update(payload).eq('id', existente.id)
      : await supabase.from('MonthlyReport').insert([{ id: uid(), ...payload }]);

    if (error) erros.push({ morador: resident.name, mensagem: error.message });
    else geradas += 1;
  }

  return { geradas, assinadas, semDados, erros };
}

/**
 * Aplica a mesma assinatura às fichas escolhidas.
 *
 * A senha é confirmada uma vez, na tela; aqui só se grava o que aquela
 * confirmação produziu — mesmo instante, mesmo IP, mesmo aparelho para
 * todas as fichas do lote, que é o que de fato aconteceu.
 *
 * @param {Array}  fichas      registros de MonthlyReport já gravados
 * @param {object} assinatura  vinda de `assinar()`
 */
export async function assinarFichasDoMes({ fichas, assinatura }) {
  const erros = [];
  let ok = 0;

  for (const ficha of fichas) {
    if (!ficha?.id || ficha.signed_by_name) continue;

    const { error } = await supabase
      .from('MonthlyReport')
      .update({ ...assinatura, updated_at: new Date().toISOString() })
      .eq('id', ficha.id);

    if (error) erros.push({ morador: ficha.resident_name, mensagem: error.message });
    else ok += 1;
  }

  return { ok, erros };
}
