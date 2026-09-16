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

/* ------------------------------------------------------------------
   Conselhos de classe
   O registro sai impresso na assinatura da ficha mensal, documento
   lido pela vigilância sanitária — por isso é estruturado.
   ------------------------------------------------------------------ */
export const PROFESSIONAL_COUNCILS = [
  { value: 'CRESS',   label: 'CRESS — Serviço Social' },
  { value: 'COREN',   label: 'COREN — Enfermagem' },
  { value: 'CRM',     label: 'CRM — Medicina' },
  { value: 'CRP',     label: 'CRP — Psicologia' },
  { value: 'CRN',     label: 'CRN — Nutrição' },
  { value: 'CREFITO', label: 'CREFITO — Fisioterapia e T.O.' },
  { value: 'CRF',     label: 'CRF — Farmácia' },
  { value: 'Outro',   label: 'Outro conselho' },
];

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS',
  'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC',
  'SE', 'SP', 'TO',
];

/**
 * Monta o registro como ele aparece na assinatura.
 * Ex.: { COREN, 123456, SP } → "COREN-SP 123456"
 *      { CRESS, 50.834 }     → "CRESS 50.834"
 */
export function formatCouncil({ professional_council, professional_id, professional_uf } = {}) {
  if (!professional_id) return '';
  const sigla = professional_council
    ? professional_uf
      ? `${professional_council}-${professional_uf}`
      : professional_council
    : '';
  return [sigla, professional_id].filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------
   Enfermagem
   ------------------------------------------------------------------ */
export const NURSING_SHIFTS = ['Manhã', 'Tarde', 'Noite'];

export const NURSING_PROCEDURES = [
  'Aferição de sinais vitais',
  'Administração de medicação',
  'Glicemia capilar',
  'Curativo',
  'Coleta de exame',
  'Acompanhamento em consulta',
  'Orientação em saúde',
  'Organização da farmácia',
  'Contato com a rede/CAPS',
  'Outro',
];
