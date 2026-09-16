/**
 * Rascunho do relatório de enfermagem.
 *
 * Reúne o que já foi registrado no dia — sinais vitais aferidos, doses
 * checadas e compromissos acompanhados — e redige o texto factual. A
 * técnica revisa e complementa com a leitura clínica, em vez de digitar
 * do zero algo que o sistema já sabe.
 */

import { supabase } from './supabase';
import { toISODate, formatTime } from './format';
import { DOSE_STATUS } from './medications';

/** Carrega tudo que foi registrado no dia. */
export async function loadDayRecords(date = toISODate(new Date())) {
  const inicio = `${date}T00:00:00`;
  const fim = `${date}T23:59:59`;

  const [vitals, doses, events] = await Promise.all([
    supabase.from('VitalSigns').select('*').gte('created_at', inicio).lte('created_at', fim),
    supabase.from('MedicationAdministration').select('*').eq('scheduled_date', date),
    supabase.from('Event').select('*').eq('date', date),
  ]);

  return {
    vitals: vitals.data || [],
    doses: doses.data || [],
    events: events.data || [],
  };
}

/** "120/80 mmHg, glicemia 98 mg/dL, 36,5 °C, SpO₂ 97%" */
function descreverSinais(v) {
  const partes = [];
  if (v.bp) partes.push(`PA ${v.bp} mmHg`);
  if (v.glucose) partes.push(`glicemia ${v.glucose} mg/dL`);
  if (v.temp) partes.push(`temperatura ${String(v.temp).replace('.', ',')} °C`);
  if (v.spo2) partes.push(`saturação ${v.spo2}%`);
  return partes.join(', ');
}

/**
 * Monta o texto do dia.
 * @returns {{ texto: string, procedimentos: string[], resumo: object }}
 */
export function buildNursingDraft({ vitals, doses, events }, { residents = [] } = {}) {
  const blocos = [];
  const procedimentos = new Set();

  /* ---------------- Sinais vitais ---------------- */
  if (vitals.length > 0) {
    procedimentos.add('Aferição de sinais vitais');

    const porMorador = new Map();
    vitals.forEach((v) => {
      const nome = v.resident_name || 'Morador';
      if (!porMorador.has(nome)) porMorador.set(nome, []);
      porMorador.get(nome).push(v);
    });

    const linhas = ['Aferidos sinais vitais dos moradores:'];
    porMorador.forEach((registros, nome) => {
      registros.forEach((v) => {
        const desc = descreverSinais(v);
        if (!desc) return;
        const hora = v.created_at ? ` (${formatTime(v.created_at)})` : '';
        linhas.push(`• ${nome}${hora}: ${desc}.${v.notes ? ` ${v.notes}` : ''}`);
      });
    });

    if (linhas.length > 1) blocos.push(linhas.join('\n'));
  }

  /* ---------------- Medicação ---------------- */
  const administradas = doses.filter((d) => d.status === DOSE_STATUS.ADMINISTERED);
  const recusadas = doses.filter((d) => d.status === DOSE_STATUS.REFUSED);

  if (administradas.length > 0) {
    procedimentos.add('Administração de medicação');

    const porMorador = new Map();
    administradas.forEach((d) => {
      const nome = d.resident_name || 'Morador';
      if (!porMorador.has(nome)) porMorador.set(nome, []);
      porMorador.get(nome).push(d);
    });

    const linhas = ['Medicações administradas conforme prescrição:'];
    porMorador.forEach((lista, nome) => {
      const itens = lista
        .sort((a, b) => String(a.scheduled_time).localeCompare(String(b.scheduled_time)))
        .map((d) => `${d.medication_name} às ${d.scheduled_time}`)
        .join('; ');
      linhas.push(`• ${nome}: ${itens}.`);
    });
    blocos.push(linhas.join('\n'));
  }

  if (recusadas.length > 0) {
    const linhas = ['Recusas de medicação:'];
    recusadas.forEach((d) => {
      linhas.push(
        `• ${d.resident_name}: ${d.medication_name} às ${d.scheduled_time}` +
        `${d.notes ? ` — ${d.notes}` : ''}.`
      );
    });
    blocos.push(linhas.join('\n'));
  }

  /* ---------------- Compromissos ---------------- */
  if (events.length > 0) {
    events.forEach((ev) => {
      if (['Consulta', 'Exame', 'Avaliação'].includes(ev.type)) {
        procedimentos.add('Acompanhamento em consulta');
      }
      const local = ev.location ? ` no ${ev.location}` : '';
      const quem = ev.resident_name && ev.resident_name !== 'Geral (todos)'
        ? ` do morador ${ev.resident_name}`
        : '';
      const desfecho = ev.outcome ? ` ${ev.outcome}` : '';
      blocos.push(
        `Na data de hoje, ${String(ev.type || 'compromisso').toLowerCase()}${quem}: ` +
        `${ev.title}${local}, às ${ev.time}.${desfecho}`
      );
    });
  }

  const texto = blocos.join('\n\n');

  return {
    texto,
    procedimentos: Array.from(procedimentos),
    resumo: {
      sinais: vitals.length,
      administradas: administradas.length,
      recusadas: recusadas.length,
      compromissos: events.length,
      vazio: blocos.length === 0,
    },
  };
}
