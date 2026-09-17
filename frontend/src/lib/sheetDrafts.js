/**
 * Rascunhos das seções da ficha mensal.
 *
 * O texto sai do que já está registrado no sistema — agenda, plantões e
 * intercorrências — e nunca substitui o que a supervisão escreveu: a
 * ficha é prontuário, e o rascunho é ponto de partida, não conclusão.
 *
 * Vivem aqui, fora do componente, porque o fechamento do mês precisa
 * gerar as mesmas seções para a casa inteira de uma vez. Uma ficha
 * gerada em lote tem que sair idêntica à gerada uma a uma.
 */

import { toDate } from './format';
import { CLINICAL_EVENT_TYPES, SOCIAL_EVENT_TYPES } from './clinical';

/** Marca deixada no rascunho de comportamento, pedindo leitura clínica. */
export const PEDIDO_DE_REVISAO = '[Revise e substitua pela sua leitura clínica do período.]';

function noMes(valor, monthKey) {
  const [year, month] = String(monthKey).split('-').map(Number);
  const d = toDate(valor);
  return !!d && d.getFullYear() === year && d.getMonth() === month - 1;
}

/** "02/03" — dia e mês, como o documento escreve. */
function dia(valor) {
  const d = toDate(valor);
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Compromissos da agenda do morador no período, em ordem. */
export function eventosDoMes(events, residentId, monthKey) {
  if (!residentId) return [];
  return (events || [])
    .filter((ev) => ev.resident_id === residentId && noMes(ev.date, monthKey))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/** Intercorrências com o morador entre os envolvidos, em ordem. */
export function incidentesDoMes(incidents, residentId, monthKey) {
  if (!residentId) return [];
  return (incidents || [])
    .filter((inc) => {
      const ids = Array.isArray(inc.resident_ids) ? inc.resident_ids : [];
      return ids.includes(residentId) && noMes(inc.occurred_at, monthKey);
    })
    .sort((a, b) => String(a.occurred_at).localeCompare(String(b.occurred_at)));
}

function formatEvento(ev) {
  const partes = [ev.title];
  if (ev.location) partes.push(`Local: ${ev.location}`);
  if (ev.outcome) partes.push(ev.outcome);
  else if (ev.notes) partes.push(ev.notes);
  return `${dia(ev.date)}: ${partes.join('. ')}.`;
}

/** Consultas, exames e avaliações do período. */
export function draftIntervencoes({ events, residentId, monthKey }) {
  const clinicos = eventosDoMes(events, residentId, monthKey)
    .filter((ev) => !ev.type || CLINICAL_EVENT_TYPES.includes(ev.type));
  return clinicos.map(formatEvento).join('\n');
}

/** Visitas, passeios e atividades coletivas do período. */
export function draftInteracoes({ events, residentId, monthKey }) {
  const sociais = eventosDoMes(events, residentId, monthKey)
    .filter((ev) => SOCIAL_EVENT_TYPES.includes(ev.type));
  return sociais.map(formatEvento).join('\n');
}

/** Adesão à medicação, contada a partir dos plantões do mês. */
export function draftAdesao({ summary }) {
  if (!summary || summary.totalPlantoes === 0) return '';

  const tomou = summary.meds.counts.tomou || 0;
  const recusou = summary.meds.counts.recusou || 0;
  const total = summary.totalPlantoes;

  return recusou === 0
    ? `Boa adesão ao tratamento e às medicações. Medicação administrada sem recusa em ${tomou} dos ${total} plantões registrados no período.`
    : `Adesão com intercorrências: medicação administrada normalmente em ${tomou} plantões e recusada em ${recusou} ocasiões, de um total de ${total} plantões registrados no período.`;
}

/** Comportamento: o que a equipe marcou, o que aconteceu e o que anotou. */
export function draftComportamento({ summary, incidents, residentId, monthKey }) {
  const alteracoes = summary?.behavior?.alteracoes || [];
  const observacoes = summary?.observacoes || [];
  const ocorrencias = incidentesDoMes(incidents, residentId, monthKey);

  if (alteracoes.length === 0 && observacoes.length === 0 && ocorrencias.length === 0) {
    return '';
  }

  const blocos = [];

  if (alteracoes.length === 0 && summary?.behavior?.semAlteracao > 0) {
    blocos.push(
      `Não foram observadas alterações de comportamento nos ${summary.behavior.semAlteracao} plantões em que o item foi avaliado.`
    );
  }

  alteracoes.forEach((alt) => {
    const dias = alt.dias.map((x) => dia(x.date)).join(', ');
    blocos.push(
      `${alt.label}: observada pela equipe em ${alt.count} ${alt.count === 1 ? 'plantão' : 'plantões'} (${dias}).`
    );
  });

  if (ocorrencias.length > 0) {
    blocos.push('');
    blocos.push('Intercorrências registradas no período:');
    ocorrencias.forEach((inc) => {
      const partes = [`${dia(inc.occurred_at)}: ${inc.type} (${inc.severity}). ${inc.description}`];
      if (inc.conduct) partes.push(`Conduta: ${inc.conduct}`);
      blocos.push(partes.join(' '));
    });
  }

  if (observacoes.length > 0) {
    blocos.push('');
    blocos.push('Anotações das cuidadoras:');
    observacoes.forEach((o) => blocos.push(`${dia(o.date)}: ${o.text}`));
  }

  blocos.push('');
  blocos.push(PEDIDO_DE_REVISAO);

  return blocos.join('\n');
}
