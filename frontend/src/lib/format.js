/** Formatação de datas, números e texto — sempre pt-BR. */

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const DIAS_SEMANA = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];

export const DIAS_SEMANA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Converte valores heterogêneos (ISO, 'YYYY-MM-DD', Date) em Date local. */
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  // 'YYYY-MM-DD' puro é interpretado como UTC pelo JS e "volta um dia"
  // no Brasil. Ancorar no meio-dia local evita esse deslocamento.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value) {
  const d = toDate(value);
  return d ? d.toLocaleDateString('pt-BR') : '—';
}

export function formatDateTime(value) {
  const d = toDate(value);
  return d
    ? d.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';
}

export function formatTime(value) {
  const d = toDate(value);
  return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
}

/** "12 de março", sem o ano — para listas dentro de um mês já rotulado. */
export function formatDayMonth(value) {
  const d = toDate(value);
  if (!d) return '—';
  return `${String(d.getDate()).padStart(2, '0')} de ${MESES[d.getMonth()].toLowerCase()}`;
}

export function formatWeekday(value, short = false) {
  const d = toDate(value);
  if (!d) return '';
  return (short ? DIAS_SEMANA_CURTO : DIAS_SEMANA)[d.getDay()];
}

/** 'YYYY-MM-DD' no fuso local (não usar toISOString, que converte p/ UTC). */
export function toISODate(value) {
  const d = toDate(value) || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Chave 'YYYY-MM' usada nos seletores de mês. */
export function toMonthKey(value) {
  const d = toDate(value) || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function parseMonthKey(key) {
  const [year, month] = String(key).split('-').map(Number);
  return { year, month: month - 1 };
}

export function formatMonthLabel(key) {
  const { year, month } = parseMonthKey(key);
  return `${MESES[month]} de ${year}`;
}

export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/** Idade em anos a partir da data de nascimento. */
export function calcAge(birth) {
  const d = toDate(birth);
  if (!d) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age;
}

export function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

export function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "Hoje", "Amanhã" ou o dia da semana abreviado. */
export function relativeDayLabel(value) {
  const d = toDate(value);
  if (!d) return '';

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(d);
  alvo.setHours(0, 0, 0, 0);

  const dias = Math.round((alvo - hoje) / 86400000);
  if (dias === 0) return 'Hoje';
  if (dias === 1) return 'Amanhã';
  return DIAS_SEMANA_CURTO[alvo.getDay()];
}

/** Compromisso é iminente quando cai hoje ou amanhã. */
export function isSoon(value) {
  const d = toDate(value);
  if (!d) return false;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(d);
  alvo.setHours(0, 0, 0, 0);

  const dias = Math.round((alvo - hoje) / 86400000);
  return dias === 0 || dias === 1;
}
