/**
 * Medicação: prescrição e checagem de doses.
 *
 * A checagem é compartilhada entre cuidadoras e enfermagem. Uma dose é
 * identificada por medicação + dia + horário previsto, e o banco tem
 * índice único sobre essa combinação: se duas pessoas marcarem a mesma
 * dose, a segunda é recusada pelo próprio banco — não depende da tela.
 */

import { supabase } from './supabase';
import { uid } from './id';
import { toISODate } from './format';

export const DOSE_STATUS = {
  ADMINISTERED: 'ADMINISTRADO',
  REFUSED: 'RECUSADO',
};

/** Medicações ativas, já com os horários. */
export async function loadMedications() {
  const { data, error } = await supabase
    .from('Medication')
    .select('*')
    .or('active.is.null,active.eq.true')
    .order('name');

  if (error) return { data: [], error };

  const meds = (data || []).map((m) => ({
    ...m,
    times: Array.isArray(m.times) ? m.times : [],
  }));
  return { data: meds, error: null };
}

/** Doses já registradas em um dia. */
export async function loadDoses(date = toISADateSafe()) {
  return supabase
    .from('MedicationAdministration')
    .select('*')
    .eq('scheduled_date', date);
}

function toISADateSafe() {
  return toISODate(new Date());
}

/**
 * Monta a lista de doses do dia: cada medicação vezes cada horário,
 * cruzada com o que já foi registrado.
 */
export function buildSchedule(medications, doses, date) {
  const porChave = new Map(
    (doses || []).map((d) => [`${d.medication_id}|${d.scheduled_time}`, d])
  );

  const lista = [];
  (medications || []).forEach((med) => {
    (med.times || []).forEach((time) => {
      const registro = porChave.get(`${med.id}|${time}`);
      lista.push({
        key: `${med.id}|${time}`,
        medicationId: med.id,
        medicationName: [med.name, med.dosage].filter(Boolean).join(' '),
        residentId: med.resident_id,
        residentName: med.resident_name || 'Geral',
        time,
        date,
        stock: med.stock ?? 0,
        minStock: med.minStock ?? 0,
        status: registro?.status || null,
        justification: registro?.notes || '',
        givenBy: registro?.given_by_name || null,
        givenAt: registro?.administeredAt || null,
        doseId: registro?.id || null,
      });
    });
  });

  return lista.sort(
    (a, b) =>
      a.time.localeCompare(b.time) || a.residentName.localeCompare(b.residentName)
  );
}

/**
 * Registra uma dose. Devolve `{ duplicada: true }` quando alguém já
 * havia registrado — é o caso de a técnica ter dado antes da cuidadora.
 */
export async function registerDose(dose, { status, justification = '', user }) {
  const { error } = await supabase.from('MedicationAdministration').insert([{
    id: uid(),
    medication_id: dose.medicationId,
    medication_name: dose.medicationName,
    resident_id: dose.residentId,
    resident_name: dose.residentName,
    scheduled_date: dose.date,
    scheduled_time: dose.time,
    status,
    notes: justification,
    administeredAt: new Date().toISOString(),
    given_by_name: user?.name || 'Equipe',
    given_by_role: user?.role || null,
    userId: user?.id || null,
  }]);

  // 23505 = violação de índice único: a dose já foi registrada.
  if (error?.code === '23505') return { duplicada: true, error: null };
  return { duplicada: false, error };
}

/** Desfaz um registro — para corrigir um clique errado. */
export async function undoDose(doseId) {
  return supabase.from('MedicationAdministration').delete().eq('id', doseId);
}

/** Baixa de estoque após administrar. */
export async function decrementStock(medicationId, current) {
  const novo = Math.max(0, (current ?? 0) - 1);
  const { error } = await supabase
    .from('Medication')
    .update({ stock: novo })
    .eq('id', medicationId);
  return { novo, error };
}
