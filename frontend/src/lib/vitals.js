/**
 * Faixas de referência para sinais vitais em adultos.
 *
 * Servem como APOIO À AFERIÇÃO, sinalizando valores que merecem
 * atenção — não substituem avaliação clínica nem protocolo médico.
 * Os limites seguem referências usuais de enfermagem; ajuste-os se o
 * protocolo da residência definir outros.
 */

export const VITAL_RANGES = {
  systolic:  { normal: [90, 139],  alert: [80, 179],  unit: 'mmHg' },
  diastolic: { normal: [60, 89],   alert: [50, 109],  unit: 'mmHg' },
  glucose:   { normal: [70, 140],  alert: [55, 250],  unit: 'mg/dL' },
  temp:      { normal: [35.5, 37.5], alert: [35, 38.5], unit: '°C' },
  spo2:      { normal: [95, 100],  alert: [90, 100],  unit: '%' },
};

/** 'normal' | 'attention' | 'critical' | null (sem valor) */
export function classifyVital(key, rawValue) {
  if (rawValue === '' || rawValue === null || rawValue === undefined) return null;

  const value = Number(String(rawValue).replace(',', '.'));
  if (Number.isNaN(value)) return null;

  const range = VITAL_RANGES[key];
  if (!range) return null;

  const [nMin, nMax] = range.normal;
  const [aMin, aMax] = range.alert;

  if (value >= nMin && value <= nMax) return 'normal';
  if (value >= aMin && value <= aMax) return 'attention';
  return 'critical';
}

/** Separa "120/80" em sistólica e diastólica. */
export function parseBloodPressure(value) {
  const match = String(value || '').match(/^\s*(\d{2,3})\s*[/x-]\s*(\d{2,3})\s*$/);
  if (!match) return null;
  return { systolic: Number(match[1]), diastolic: Number(match[2]) };
}

export function classifyBloodPressure(value) {
  const parsed = parseBloodPressure(value);
  if (!parsed) return null;

  const s = classifyVital('systolic', parsed.systolic);
  const d = classifyVital('diastolic', parsed.diastolic);
  const rank = { normal: 0, attention: 1, critical: 2 };

  if (!s || !d) return null;
  return rank[s] >= rank[d] ? s : d;
}

const TONE = { normal: 'success', attention: 'warning', critical: 'danger' };
const LABEL = { normal: 'Normal', attention: 'Atenção', critical: 'Fora da faixa' };

export function vitalTone(status) { return TONE[status] || 'neutral'; }
export function vitalLabel(status) { return LABEL[status] || ''; }

/** Resumo de um registro inteiro, para destacar linhas do histórico. */
export function worstStatus(record) {
  const statuses = [
    classifyBloodPressure(record.bp),
    classifyVital('glucose', record.glucose),
    classifyVital('temp', record.temp),
    classifyVital('spo2', record.spo2),
  ].filter(Boolean);

  if (statuses.includes('critical')) return 'critical';
  if (statuses.includes('attention')) return 'attention';
  if (statuses.length > 0) return 'normal';
  return null;
}
