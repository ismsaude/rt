/**
 * Intercorrências — criação e gravação.
 *
 * Tanto a passagem de plantão da cuidadora quanto o relatório da
 * enfermagem registram intercorrências. A lógica vive aqui para que
 * as duas telas gravem no mesmo formato, com os mesmos campos.
 */

import { supabase } from './supabase';
import { uid } from './id';
import { INCIDENT_TYPES, NOTIFY_OPTIONS } from './clinical';

export function blankIncident() {
  return {
    key: uid(),
    type: INCIDENT_TYPES[0],
    severity: 'Leve',
    residentIds: [],
    description: '',
    conduct: '',
    notified: [NOTIFY_OPTIONS[0]],
  };
}

/**
 * Grava as intercorrências de um registro.
 *
 * @param {Array}  incidents   lista montada na tela
 * @param {Object} ctx
 * @param {Array}  ctx.residents     para resolver os nomes dos envolvidos
 * @param {Object} ctx.author        { id, name } de quem registrou
 * @param {string} ctx.occurredAt    ISO do momento do registro
 * @param {string} [ctx.sourceId]    id do plantão/relatório de origem
 * @returns {{ error: object|null }}
 */
export async function saveIncidents(incidents, { residents, author, occurredAt, sourceId = null }) {
  if (!incidents || incidents.length === 0) return { error: null };

  const rows = incidents.map((inc) => ({
    id: uid(),
    occurred_at: occurredAt,
    type: inc.type,
    severity: inc.severity,
    description: inc.description.trim(),
    conduct: inc.conduct.trim(),
    notified: inc.notified.join(', '),
    resident_ids: inc.residentIds,
    resident_names: inc.residentIds.map(
      (id) => residents.find((r) => r.id === id)?.name || 'Morador'
    ),
    reporter_id: author?.id || null,
    reporter_name: author?.name || 'Equipe',
    shift_report_id: sourceId,
  }));

  return supabase.from('Incident').insert(rows);
}
