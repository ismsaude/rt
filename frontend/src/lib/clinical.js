/**
 * Vocabulário clínico da residência.
 *
 * Estas listas viram texto em prontuário e em relatório para a
 * vigilância: alterá-las muda o histórico. O classificador em
 * shiftReports.js normaliza variações antigas.
 */

/* ------------------------------------------------------------------
   Comportamento observado no plantão
   Alimenta MUDANÇAS OBSERVADAS NO COMPORTAMENTO na ficha mensal.
   ------------------------------------------------------------------ */
export const BEHAVIOR_NONE = 'Sem alteração';

export const BEHAVIOR_OPTIONS = [
  { value: BEHAVIOR_NONE,            tone: 'success' },
  { value: 'Agitação/inquietação',   tone: 'warning' },
  { value: 'Apatia/tristeza',        tone: 'warning' },
  { value: 'Isolamento',             tone: 'warning' },
  { value: 'Insônia',                tone: 'warning' },
  { value: 'Agressividade',          tone: 'danger'  },
  { value: 'Desinibição sexual',     tone: 'danger'  },
  { value: 'Alucinação/delírio',     tone: 'danger'  },
  { value: 'Ideação suicida',        tone: 'danger'  },
  { value: 'Outro',                  tone: 'neutral' },
];

export const behaviorTone = (value) =>
  BEHAVIOR_OPTIONS.find((b) => b.value === value)?.tone || 'neutral';

/** Comportamentos que exigem leitura da supervisão. */
export const isBehaviorCritical = (value) => behaviorTone(value) === 'danger';

/* ------------------------------------------------------------------
   Intercorrências
   ------------------------------------------------------------------ */
export const INCIDENT_TYPES = [
  'Agressão física',
  'Agressão verbal',
  'Queda',
  'Crise/surto',
  'Autolesão',
  'Evasão/saída não autorizada',
  'Acidente',
  'Intoxicação',
  'Recusa medicamentosa',
  'Outro',
];

export const INCIDENT_SEVERITIES = [
  { value: 'Leve',     tone: 'warning', hint: 'Sem necessidade de atendimento externo' },
  { value: 'Moderada', tone: 'warning', hint: 'Exigiu avaliação ou conduta específica' },
  { value: 'Grave',    tone: 'danger',  hint: 'Atendimento externo, lesão ou risco de vida' },
];

export const severityTone = (value) =>
  INCIDENT_SEVERITIES.find((s) => s.value === value)?.tone || 'neutral';

export const NOTIFY_OPTIONS = [
  'Supervisão',
  'Família/responsável',
  'Enfermagem',
  'Médico responsável',
  'SAMU/emergência',
  'CAPS/rede',
  'Ninguém no momento',
];

/* ------------------------------------------------------------------
   Agenda
   ------------------------------------------------------------------ */
export const EVENT_TYPES = [
  'Consulta',
  'Exame',
  'Avaliação',
  'Visita de familiar',
  'Atividade coletiva',
  'Passeio',
  'Outro',
];

/** Tipos que entram em INTERVENÇÕES REALIZADAS NO PERÍODO. */
export const CLINICAL_EVENT_TYPES = ['Consulta', 'Exame', 'Avaliação'];

/** Tipos que entram em INTERAÇÕES SOCIAIS E FAMILIARES. */
export const SOCIAL_EVENT_TYPES = ['Visita de familiar', 'Atividade coletiva', 'Passeio'];

/* ------------------------------------------------------------------
   Autonomia — atributo do morador, revisado mensalmente
   ------------------------------------------------------------------ */
export const AUTONOMY_LEVELS = ['Independente', 'Semi-dependente', 'Dependente'];

/**
 * Sugere o nível de autonomia a partir do que os plantões mostram.
 * É sugestão para a supervisão confirmar, nunca gravação automática.
 */
export function suggestAutonomy(counts, total) {
  if (!total) return null;
  const desvio = total - (counts || 0);
  const pct = desvio / total;
  if (pct <= 0.1) return 'Independente';
  if (pct <= 0.5) return 'Semi-dependente';
  return 'Dependente';
}
