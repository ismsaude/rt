/**
 * Escala de trabalho: regras, geração do mês, avisos e acesso aos dados.
 *
 * O modelo tem duas camadas:
 *   • regras (postos + feriados): como a casa funciona;
 *   • escala do mês (ScheduleEntry): o que foi gerado, dia a dia.
 *
 * A escala do mês é GRAVADA. Meses passados continuam mostrando o que
 * valeu na época, mesmo que as regras mudem depois.
 *
 * Postos têm dois padrões:
 *   '12x36'   — uma pessoa por dia, as pessoas se revezam sem parar,
 *               inclusive em feriados. A pessoa do dia vem da data de
 *               âncora: quem trabalha em `anchor_date` é people[0].
 *   'semanal' — pessoa fixa em dias da semana, com horário próprio
 *               por dia se preciso (sábado até 11h). Em feriado, só
 *               trabalha se o posto estiver marcado para isso.
 */

import { supabase } from './supabase';
import { uid } from './id';
import { toDate, toISODate, daysInMonth, parseMonthKey } from './format';
import { formatCouncil } from './clinical';

/* ------------------------------------------------------------------ */
/* Datas                                                              */
/* ------------------------------------------------------------------ */

/** Segunda a domingo, como na escala impressa. Valores são Date.getDay(). */
export const COLUNAS_SEMANA = [1, 2, 3, 4, 5, 6, 0];
export const DIA_SEMANA_CURTO = { 0: 'DOM', 1: 'SEG', 2: 'TER', 3: 'QUA', 4: 'QUI', 5: 'SEX', 6: 'SÁB' };
export const DIA_SEMANA_NOME = {
  0: 'domingo', 1: 'segunda', 2: 'terça', 3: 'quarta', 4: 'quinta', 5: 'sexta', 6: 'sábado',
};

const dia = (iso) => toDate(iso);
const iso = (d) => toISODate(d);

export function somarDias(isoData, n) {
  const d = dia(isoData);
  d.setDate(d.getDate() + n);
  return iso(d);
}

/** Dias inteiros entre duas datas ISO (b − a). */
function diasEntre(a, b) {
  return Math.round((dia(b) - dia(a)) / 86400000);
}

/** Todas as datas ISO de um mês 'YYYY-MM'. */
export function datasDoMes(monthKey) {
  const { year, month } = parseMonthKey(monthKey);
  const total = daysInMonth(year, month);
  return Array.from({ length: total }, (_, i) =>
    `${monthKey}-${String(i + 1).padStart(2, '0')}`
  );
}

/**
 * Semanas do mês, de segunda a domingo. Cada semana tem 7 posições;
 * dias de outro mês vêm como null.
 */
export function semanasDoMes(monthKey) {
  const datas = datasDoMes(monthKey);
  const semanas = [];
  let atual = Array(7).fill(null);

  datas.forEach((d) => {
    const col = COLUNAS_SEMANA.indexOf(dia(d).getDay());
    atual[col] = d;
    if (col === 6) { semanas.push(atual); atual = Array(7).fill(null); }
  });
  if (atual.some(Boolean)) semanas.push(atual);
  return semanas;
}

export const mesAnterior = (monthKey) => {
  const { year, month } = parseMonthKey(monthKey);
  const d = new Date(year, month - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const mesSeguinte = (monthKey) => {
  const { year, month } = parseMonthKey(monthKey);
  const d = new Date(year, month + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/* ------------------------------------------------------------------ */
/* Feriados nacionais                                                 */
/* ------------------------------------------------------------------ */

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
function pascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const diaDoMes = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(diaDoMes).padStart(2, '0')}`;
}

/**
 * Feriados nacionais do ano. Municipais e pontos facultativos
 * (Carnaval, Corpus Christi) a casa cadastra à parte.
 */
export function feriadosNacionais(ano) {
  const fixo = (mmdd, name) => ({ holiday_date: `${ano}-${mmdd}`, name });
  return [
    fixo('01-01', 'Confraternização Universal'),
    { holiday_date: somarDias(pascoa(ano), -2), name: 'Sexta-feira Santa' },
    fixo('04-21', 'Tiradentes'),
    fixo('05-01', 'Dia do Trabalho'),
    fixo('09-07', 'Independência do Brasil'),
    fixo('10-12', 'Nossa Senhora Aparecida'),
    fixo('11-02', 'Finados'),
    fixo('11-15', 'Proclamação da República'),
    fixo('11-20', 'Consciência Negra'),
    fixo('12-25', 'Natal'),
  ].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
}

/* ------------------------------------------------------------------ */
/* Horários e nomes                                                   */
/* ------------------------------------------------------------------ */

const minutos = (hhmm) => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return h * 60 + (m || 0);
};

/** "07:00","19:00" → "7–19h"; "07:30","16:00" → "7:30–16h". */
export function rotuloHorario(inicio, fim) {
  if (!inicio || !fim) return '';
  const parte = (t) => {
    const [h, m] = t.split(':').map(Number);
    return m ? `${h}:${String(m).padStart(2, '0')}` : `${h}`;
  };
  return `${parte(inicio)}–${parte(fim)}h`;
}

/** Duração do plantão em horas; fim menor ou igual ao início atravessa a meia-noite. */
export function horasDoPlantao(inicio, fim) {
  if (!inicio || !fim) return 0;
  let dif = minutos(fim) - minutos(inicio);
  if (dif <= 0) dif += 24 * 60;
  return dif / 60;
}

/** Horário do posto num dia da semana (exceção do dia ou o padrão). */
export function horarioDoDia(posto, diaSemana) {
  const especial = posto.weekday_hours?.[String(diaSemana)];
  return especial?.start && especial?.end
    ? { start: especial.start, end: especial.end }
    : { start: posto.start_time, end: posto.end_time };
}

/**
 * Nome curto para a grade: o primeiro nome; se houver dois com o mesmo
 * primeiro nome, os dois primeiros ("Maria Valéria" e "Maria Aparecida").
 */
export function nomeCurto(nome, todos = []) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  const primeiro = partes[0];
  const repetido = todos.filter((n) => String(n).trim().split(/\s+/)[0] === primeiro).length > 1
    && new Set(todos.filter((n) => String(n).trim().split(/\s+/)[0] === primeiro)).size > 1;
  return repetido && partes[1] ? `${primeiro} ${partes[1]}` : primeiro;
}

/* ------------------------------------------------------------------ */
/* Geração                                                            */
/* ------------------------------------------------------------------ */

/** Quem cobre o posto no dia, pelas regras. Devolve { user_id, name } ou null. */
export function pessoaDoDia(posto, dataISO) {
  const pessoas = posto.people || [];
  if (pessoas.length === 0) return null;
  if (posto.pattern !== '12x36') return pessoas[0];

  const ancora = posto.anchor_date || dataISO;
  const n = pessoas.length;
  const idx = ((diasEntre(ancora, dataISO) % n) + n) % n;
  return pessoas[idx];
}

/** O que as regras prevêem para um posto num dia: lançamento ou null (dia sem plantão). */
export function lancamentoPrevisto(posto, dataISO, feriados) {
  const diaSemana = dia(dataISO).getDay();
  const ehFeriado = feriados.has(dataISO);

  const base = {
    shift_id: posto.id,
    shift_name: posto.name,
    shift_hours: rotuloHorario(posto.start_time, posto.end_time),
    shift_category: posto.category,
    shift_position: posto.position,
    shift_meal_rule: posto.meal_rule || 'nenhuma',
    shift_meal_hours: posto.meal_hours ?? 1,
    entry_date: dataISO,
    manual: false,
  };

  if (posto.pattern === '12x36') {
    const p = pessoaDoDia(posto, dataISO);
    return {
      ...base, kind: 'plantao', user_id: p?.user_id || null, person_name: p?.name || null,
      start_time: posto.start_time, end_time: posto.end_time,
    };
  }

  if (!(posto.weekdays || []).includes(diaSemana)) return null;

  if (ehFeriado && !posto.works_on_holidays) {
    return { ...base, kind: 'feriado', user_id: null, person_name: null, start_time: null, end_time: null };
  }

  const h = horarioDoDia(posto, diaSemana);
  const p = pessoaDoDia(posto, dataISO);
  return {
    ...base, kind: 'plantao', user_id: p?.user_id || null, person_name: p?.name || null,
    start_time: h.start, end_time: h.end,
  };
}

/** Escala completa de um mês a partir das regras. */
export function gerarMes({ monthKey, postos, feriados }) {
  const set = new Set(feriados.map((f) => f.holiday_date));
  const ativos = postos.filter((p) => p.active);
  const saida = [];
  datasDoMes(monthKey).forEach((d) => {
    ativos.forEach((p) => {
      const l = lancamentoPrevisto(p, d, set);
      if (l) saida.push({ id: uid(), ...l });
    });
  });
  return saida;
}

/* ------------------------------------------------------------------ */
/* Leitura da escala gravada                                          */
/* ------------------------------------------------------------------ */

/** Linhas (postos) que existem no mês, na ordem de exibição. */
export function linhasDoMes(entradas) {
  const mapa = new Map();
  entradas.forEach((e) => {
    if (!mapa.has(e.shift_id)) {
      mapa.set(e.shift_id, {
        shift_id: e.shift_id,
        name: e.shift_name,
        hours: e.shift_hours,
        category: e.shift_category,
        position: e.shift_position,
        meal_rule: e.shift_meal_rule,
        meal_hours: e.shift_meal_hours,
      });
    }
  });
  return [...mapa.values()].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

export function indexar(entradas) {
  const mapa = new Map();
  entradas.forEach((e) => mapa.set(`${e.shift_id}|${e.entry_date}`, e));
  return mapa;
}

/** Plantões e horas de cada pessoa no mês. */
export function resumoPorPessoa(entradas) {
  const mapa = new Map();
  entradas.forEach((e) => {
    if (e.kind !== 'plantao' || !e.person_name) return;
    const atual = mapa.get(e.person_name) || { nome: e.person_name, plantoes: 0, horas: 0, fins: 0 };
    atual.plantoes += 1;
    atual.horas += horasDoPlantao(e.start_time, e.end_time);
    if ([0, 6].includes(dia(e.entry_date).getDay())) atual.fins += 1;
    mapa.set(e.person_name, atual);
  });
  return [...mapa.values()].sort((a, b) => b.horas - a.horas || a.nome.localeCompare(b.nome));
}

/**
 * Pontos de atenção da escala do mês:
 *   • plantão sem ninguém escalado;
 *   • a mesma pessoa em dois postos no mesmo dia;
 *   • 12x36 sem o descanso: o mesmo posto no dia seguinte com a mesma pessoa.
 */
export function avisosDoMes(entradas) {
  const avisos = [];
  const porDia = new Map();

  entradas.filter((e) => e.kind === 'plantao').forEach((e) => {
    if (!e.person_name) {
      avisos.push({ tipo: 'vazio', data: e.entry_date, texto: `${e.shift_name}: sem pessoa escalada` });
      return;
    }
    const chave = `${e.entry_date}|${e.person_name}`;
    const lista = porDia.get(chave) || [];
    lista.push(e);
    porDia.set(chave, lista);
  });

  porDia.forEach((lista, chave) => {
    if (lista.length > 1) {
      const [data, nome] = chave.split('|');
      avisos.push({
        tipo: 'duplicada',
        data,
        texto: `${nome} está em ${lista.map((l) => l.shift_name).join(' e ')}`,
      });
    }
  });

  const idx = indexar(entradas);
  entradas.filter((e) => e.kind === 'plantao' && e.person_name).forEach((e) => {
    const seguinte = idx.get(`${e.shift_id}|${somarDias(e.entry_date, 1)}`);
    if (seguinte?.kind === 'plantao' && seguinte.person_name === e.person_name
      && horasDoPlantao(e.start_time, e.end_time) >= 12) {
      avisos.push({
        tipo: 'descanso',
        data: e.entry_date,
        texto: `${e.person_name} trabalha dois dias seguidos em ${e.shift_name}`,
      });
    }
  });

  return avisos.sort((a, b) => a.data.localeCompare(b.data));
}

/* ------------------------------------------------------------------ */
/* Estrutura padrão da casa                                           */
/* ------------------------------------------------------------------ */

/** Os postos da casa, prontos para gravar, a partir das escolhas do assistente. */
export function postosPadrao({
  diurno, noturno, comercial, tecnica, supervisora, ancoraDiurno, ancoraNoturno, dataAncora,
}) {
  const pessoa = (p) => (p ? { user_id: p.id, name: p.name } : null);
  const lista = (arr) => arr.filter(Boolean).map(pessoa);

  // Quem trabalha em dataAncora vem primeiro na lista de revezamento.
  const girar = (pessoas, primeiro) => {
    const i = Math.max(0, pessoas.findIndex((p) => p.user_id === primeiro));
    return [...pessoas.slice(i), ...pessoas.slice(0, i)];
  };

  const d = lista(diurno);
  const n = lista(noturno);

  return [
    {
      name: 'Cuidadora diurno', category: 'cuidadora', pattern: '12x36',
      start_time: '07:00', end_time: '19:00', weekdays: [0, 1, 2, 3, 4, 5, 6],
      weekday_hours: {}, works_on_holidays: true, meal_rule: 'fds_feriado', meal_hours: 1,
      people: girar(d, ancoraDiurno), anchor_date: dataAncora, position: 1,
    },
    {
      name: 'Assistente', category: 'cuidadora', pattern: 'semanal',
      start_time: '07:00', end_time: '16:00', weekdays: [1, 2, 3, 4, 5, 6],
      weekday_hours: { 6: { start: '07:00', end: '11:00' } }, works_on_holidays: false,
      people: lista([comercial]), anchor_date: null, position: 2,
    },
    {
      name: 'Téc. enfermagem', category: 'tecnica', pattern: 'semanal',
      start_time: '08:00', end_time: '17:00', weekdays: [1, 2, 3, 4, 5],
      weekday_hours: {}, works_on_holidays: false,
      people: lista([tecnica]), anchor_date: null, position: 3,
    },
    {
      name: 'Supervisão', category: 'supervisao', pattern: 'semanal',
      start_time: '08:00', end_time: '17:00', weekdays: [1, 2, 3, 4, 5],
      weekday_hours: {}, works_on_holidays: false,
      people: lista([supervisora]), anchor_date: null, position: 4,
    },
    {
      name: 'Cuidadora noturno', category: 'cuidadora', pattern: '12x36',
      start_time: '19:00', end_time: '07:00', weekdays: [0, 1, 2, 3, 4, 5, 6],
      weekday_hours: {}, works_on_holidays: true, meal_rule: 'sempre', meal_hours: 1,
      people: girar(n, ancoraNoturno), anchor_date: dataAncora, position: 5,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Banco                                                              */
/* ------------------------------------------------------------------ */

export async function carregarPostos() {
  const { data, error } = await supabase
    .from('ScheduleShift').select('*').order('position').order('name');
  return { error, postos: data || [] };
}

export async function salvarPosto(posto) {
  const payload = {
    name: posto.name.trim(),
    category: posto.category,
    pattern: posto.pattern,
    start_time: posto.start_time,
    end_time: posto.end_time,
    weekdays: posto.weekdays,
    weekday_hours: posto.weekday_hours || {},
    works_on_holidays: !!posto.works_on_holidays,
    meal_rule: posto.meal_rule || 'nenhuma',
    meal_hours: Number(posto.meal_hours ?? 1),
    people: posto.people || [],
    anchor_date: posto.pattern === '12x36' ? (posto.anchor_date || null) : null,
    position: posto.position ?? 0,
    active: posto.active !== false,
    updated_at: new Date().toISOString(),
  };
  if (posto.id) return supabase.from('ScheduleShift').update(payload).eq('id', posto.id);
  return supabase.from('ScheduleShift').insert([{ id: uid(), ...payload }]);
}

export const apagarPosto = (id) => supabase.from('ScheduleShift').delete().eq('id', id);

export async function carregarFeriados(ano) {
  const { data, error } = await supabase
    .from('ScheduleHoliday').select('*')
    .gte('holiday_date', `${ano}-01-01`).lte('holiday_date', `${ano}-12-31`)
    .order('holiday_date');
  return { error, feriados: data || [] };
}

export const salvarFeriados = (lista) =>
  supabase.from('ScheduleHoliday').upsert(
    lista.map((f) => ({ holiday_date: f.holiday_date, name: f.name })),
    { onConflict: 'holiday_date' }
  );

export const apagarFeriado = (id) => supabase.from('ScheduleHoliday').delete().eq('id', id);

/** [início, primeiro dia do mês seguinte): o limite superior é exclusivo. */
const limitesDoMes = (monthKey) => [`${monthKey}-01`, `${mesSeguinte(monthKey)}-01`];

export async function carregarMes(monthKey) {
  const [ini, fim] = limitesDoMes(monthKey);
  const { data, error } = await supabase
    .from('ScheduleEntry').select('*').gte('entry_date', ini).lt('entry_date', fim);
  return { error, entradas: data || [] };
}

/**
 * Grava a escala gerada do mês.
 * Em regeneração, o que foi ajustado à mão (manual) permanece; só os
 * lançamentos automáticos são refeitos.
 */
export async function gravarMesGerado({ monthKey, geradas, existentes = [] }) {
  const manuais = existentes.filter((e) => e.manual);
  const ocupado = new Set(manuais.map((e) => `${e.shift_id}|${e.entry_date}`));

  const [ini, fim] = limitesDoMes(monthKey);
  const del = await supabase
    .from('ScheduleEntry').delete()
    .gte('entry_date', ini).lt('entry_date', fim).eq('manual', false);
  if (del.error) return del;

  const novas = geradas
    .filter((e) => !ocupado.has(`${e.shift_id}|${e.entry_date}`))
    .map((e) => ({ ...e, updated_at: new Date().toISOString() }));
  if (novas.length === 0) return { error: null };
  return supabase.from('ScheduleEntry').insert(novas);
}

/** Grava um ajuste manual de um dia. */
export function salvarLancamentoDeEscala(l) {
  const payload = {
    id: l.id || uid(),
    entry_date: l.entry_date,
    shift_id: l.shift_id,
    shift_name: l.shift_name,
    shift_hours: l.shift_hours,
    shift_category: l.shift_category,
    shift_position: l.shift_position,
    ...(l.shift_meal_rule ? { shift_meal_rule: l.shift_meal_rule, shift_meal_hours: l.shift_meal_hours } : {}),
    kind: l.kind,
    user_id: l.user_id || null,
    person_name: l.person_name || null,
    start_time: l.kind === 'plantao' ? l.start_time : null,
    end_time: l.kind === 'plantao' ? l.end_time : null,
    note: l.note?.trim() || null,
    manual: true,
    updated_at: new Date().toISOString(),
  };
  return supabase.from('ScheduleEntry').upsert(payload, { onConflict: 'shift_id,entry_date' });
}

export const apagarLancamentoDeEscala = (id) => supabase.from('ScheduleEntry').delete().eq('id', id);

export const sobrescreverLancamento = (e) =>
  supabase.from('ScheduleEntry').upsert(
    { ...e, updated_at: new Date().toISOString() },
    { onConflict: 'shift_id,entry_date' }
  );

export async function carregarEquipe() {
  const { data, error } = await supabase
    .from('User')
    .select('id, name, role, job_title, active, professional_council, professional_id, professional_uf')
    .order('name');
  return { error, equipe: (data || []).filter((u) => u.active !== false) };
}

/** Apaga toda a escala gravada de um mês (regras e outros meses não mudam). */
export async function apagarMesInteiro(monthKey) {
  const [ini, fim] = limitesDoMes(monthKey);
  return supabase.from('ScheduleEntry').delete().gte('entry_date', ini).lt('entry_date', fim);
}

/** Meses ('YYYY-MM') que já têm escala gerada, para marcar no seletor. */
export async function mesesComEscala() {
  const { data } = await supabase
    .from('ScheduleEntry').select('entry_date').order('entry_date', { ascending: false }).limit(6000);
  return [...new Set((data || []).map((r) => String(r.entry_date).slice(0, 7)))];
}

/* ------------------------------------------------------------------ */
/* Fechamento e assinatura do mês                                     */
/* ------------------------------------------------------------------ */

export async function carregarFechamento(monthKey) {
  const { data, error } = await supabase
    .from('ScheduleMonth').select('*').eq('month', monthKey).maybeSingle();
  return { error, fechamento: data?.closed_at ? data : null };
}

/** Assina o mês: ele passa a ser a "Escala Executada" e fica travado. */
export const assinarMes = (monthKey, assinatura) =>
  supabase.from('ScheduleMonth').upsert(
    { month: monthKey, closed_at: new Date().toISOString(), ...assinatura, updated_at: new Date().toISOString() },
    { onConflict: 'month' }
  );

export const reabrirMes = (monthKey) =>
  supabase.from('ScheduleMonth').update({
    closed_at: null, signed_by_name: null, signed_by_role: null, signed_council: null,
    signed_at: null, signed_ip: null, signed_device: null, updated_at: new Date().toISOString(),
  }).eq('month', monthKey);

/**
 * Quem assina a escala impressa: a pessoa do posto de supervisão.
 * Devolve { name, role, council } ou null.
 */
export function responsavelPelaAssinatura(postos, equipe) {
  const posto = postos.find((p) => p.category === 'supervisao' && p.active)
    || postos.find((p) => p.category === 'supervisao');
  const pessoa = posto?.people?.[0];
  if (!pessoa) return null;
  const u = equipe.find((x) => x.id === pessoa.user_id);
  return {
    name: pessoa.name,
    role: u?.job_title || 'Supervisora',
    council: u ? formatCouncil(u) : '',
  };
}

/* ------------------------------------------------------------------ */
/* Vários meses de uma vez e revezamento                              */
/* ------------------------------------------------------------------ */

/** Lista de `quantidade` meses a partir de `inicio` ('YYYY-MM'), inclusive. */
export function proximosMeses(inicio, quantidade) {
  const lista = [];
  let atual = inicio;
  for (let i = 0; i < quantidade; i += 1) { lista.push(atual); atual = mesSeguinte(atual); }
  return lista;
}

/**
 * Gera a escala de vários meses pelas regras.
 * Meses que já têm escala (ou assinada) não são tocados.
 *
 * @returns {{ geradas: string[], puladas: string[], feriadosCadastrados: number[], erro?: string }}
 */
export async function gerarVariosMeses({ meses, postos, cadastrarFeriados }) {
  const geradas = [];
  const puladas = [];
  const feriadosCadastrados = [];
  const feriadosPorAno = new Map();

  for (const monthKey of meses) {
    // eslint-disable-next-line no-await-in-loop
    const { entradas, error } = await carregarMes(monthKey);
    if (error) return { geradas, puladas, feriadosCadastrados, erro: error.message };
    if (entradas.length > 0) { puladas.push(monthKey); continue; }

    const ano = Number(monthKey.slice(0, 4));
    if (!feriadosPorAno.has(ano)) {
      // eslint-disable-next-line no-await-in-loop
      let { feriados } = await carregarFeriados(ano);
      if (feriados.length === 0 && cadastrarFeriados) {
        // eslint-disable-next-line no-await-in-loop
        const r = await salvarFeriados(feriadosNacionais(ano));
        if (r.error) return { geradas, puladas, feriadosCadastrados, erro: r.error.message };
        feriadosCadastrados.push(ano);
        feriados = feriadosNacionais(ano);
      }
      feriadosPorAno.set(ano, feriados);
    }

    const novas = gerarMes({ monthKey, postos, feriados: feriadosPorAno.get(ano) });
    // eslint-disable-next-line no-await-in-loop
    const r = await gravarMesGerado({ monthKey, geradas: novas, existentes: [] });
    if (r.error) return { geradas, puladas, feriadosCadastrados, erro: r.error.message };
    geradas.push(monthKey);
  }
  return { geradas, puladas, feriadosCadastrados };
}

/**
 * Acerta o revezamento dos postos 12x36: em `dataISO`, trabalha quem for
 * escolhido em cada posto (`escolhas`: { [postoId]: userId }). As demais
 * datas seguem a alternância a partir daí.
 */
export async function acertarRevezamento({ postos, dataISO, escolhas }) {
  for (const p of postos.filter((x) => x.pattern === '12x36' && escolhas[x.id])) {
    const i = Math.max(0, p.people.findIndex((x) => x.user_id === escolhas[p.id]));
    const people = [...p.people.slice(i), ...p.people.slice(0, i)];
    // eslint-disable-next-line no-await-in-loop
    const { error } = await salvarPosto({ ...p, people, anchor_date: dataISO });
    if (error) return { error };
  }
  return { error: null };
}

/* ------------------------------------------------------------------ */
/* Horário de refeição remunerado                                     */
/* ------------------------------------------------------------------ */

export const REGRAS_REFEICAO = [
  { value: 'nenhuma', label: 'Não dá direito' },
  { value: 'sempre', label: 'Todo plantão (ex.: noturno, a pessoa não pode sair para jantar)' },
  { value: 'fds_feriado', label: 'Só sábado, domingo e feriado (ex.: diurno, sozinha na casa)' },
];

/**
 * Quem tem direito à hora de refeição remunerada no mês, e por quê.
 *
 * A regra é do posto (cópia gravada em cada lançamento; se faltar, vale a
 * regra atual do posto). Cada plantão dá no máximo uma vez a hora, mesmo
 * que caia em sábado E feriado.
 *
 * @returns {Array<{ nome, horas, noturnos, fins, feriados, itens: Array }>}
 */
export function resumoRefeicao(entradas, feriados, postos = []) {
  const mapa = new Map();

  entradas.forEach((e) => {
    if (e.kind !== 'plantao' || !e.person_name) return;

    const posto = postos.find((p) => p.id === e.shift_id);
    const regra = e.shift_meal_rule || posto?.meal_rule || 'nenhuma';
    const horas = Number(e.shift_meal_hours ?? posto?.meal_hours ?? 1);
    if (regra === 'nenhuma' || !horas) return;

    const diaSemana = dia(e.entry_date).getDay();
    const ehFeriado = feriados.has(e.entry_date);
    const ehFimDeSemana = diaSemana === 0 || diaSemana === 6;

    let motivo = null;
    if (regra === 'sempre') {
      const atravessaNoite = e.start_time && e.end_time && e.end_time <= e.start_time;
      motivo = atravessaNoite ? 'noturno' : 'plantao';
    } else if (regra === 'fds_feriado') {
      if (ehFeriado) motivo = 'feriado';
      else if (ehFimDeSemana) motivo = 'fim de semana';
    }
    if (!motivo) return;

    const item = mapa.get(e.person_name) || {
      nome: e.person_name, horas: 0, noturnos: 0, plantoes: 0, fins: 0, feriados: 0, itens: [],
    };
    item.horas += horas;
    if (motivo === 'noturno') item.noturnos += 1;
    else if (motivo === 'plantao') item.plantoes += 1;
    else if (motivo === 'feriado') item.feriados += 1;
    else item.fins += 1;
    item.itens.push({ data: e.entry_date, motivo, posto: e.shift_name, horas });
    mapa.set(e.person_name, item);
  });

  return [...mapa.values()]
    .map((p) => ({ ...p, itens: p.itens.sort((a, b) => a.data.localeCompare(b.data)) }))
    .sort((a, b) => b.horas - a.horas || a.nome.localeCompare(b.nome));
}

/** O resumo no formato que a casa usa para repassar ao pagamento. */
export function textoRefeicao(titulo, resumo, todosNomes = []) {
  const horas = (h) => `${String(h).replace('.', ',')}h`;
  const linhas = resumo.map((p) => `${nomeCurto(p.nome, todosNomes)} - ${horas(p.horas)} (horário refeição remunerado)`);
  return [titulo, ...(linhas.length ? linhas : ['Ninguém com direito neste mês.'])].join('\n');
}
