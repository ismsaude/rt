/**
 * Consolidação de passagens de plantão.
 *
 * As cuidadoras registram um plantão por vez, com uma entrada por
 * morador. Para o relatório mensal a supervisora precisa do oposto:
 * um morador, o mês inteiro. Este módulo faz essa transposição e
 * calcula os indicadores que sustentam o parecer.
 */

import { toDate, daysInMonth } from './format';

/* ------------------------------------------------------------------
   Normalização
   Os valores gravados variam ao longo do tempo (rótulos dos <option>
   mudaram e houve um default divergente). Classificamos por conteúdo
   para que o histórico antigo continue somando corretamente.
   ------------------------------------------------------------------ */

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export function classifyHygiene(value) {
  const v = norm(value);
  if (!v) return 'sem_registro';
  if (v.includes('recus')) return 'recusou';
  if (v.includes('parcial')) return 'parcial';
  if (v.includes('realizada')) return 'realizada';
  return 'outro';
}

export function classifyFood(value) {
  const v = norm(value);
  if (!v) return 'sem_registro';
  if (v.includes('recus')) return 'recusou';
  if (v.includes('pouco')) return 'pouco';
  if (v.includes('bem')) return 'bem';
  return 'outro';
}

export function classifyMeds(value) {
  const v = norm(value);
  if (!v) return 'sem_registro';
  if (v.includes('recus') || v.includes('cuspiu')) return 'recusou';
  if (v.includes('nao havia') || v.includes('sem medica')) return 'sem_medicacao';
  if (v.includes('normal') || v.includes('tomou')) return 'tomou';
  return 'outro';
}

export const HYGIENE_LABELS = {
  realizada: 'Realizada',
  parcial: 'Parcial',
  recusou: 'Recusou o banho',
  outro: 'Outro',
  sem_registro: 'Sem registro',
};

export const FOOD_LABELS = {
  bem: 'Comeu bem',
  pouco: 'Comeu pouco',
  recusou: 'Recusou alimentação',
  outro: 'Outro',
  sem_registro: 'Sem registro',
};

export const MEDS_LABELS = {
  tomou: 'Tomou normalmente',
  recusou: 'Recusou / cuspiu',
  sem_medicacao: 'Não havia medicação',
  outro: 'Outro',
  sem_registro: 'Sem registro',
};

/** Tom visual de cada categoria (alimenta barras e selos). */
export const TONE_BY_KEY = {
  realizada: 'success', parcial: 'warning', recusou: 'danger',
  bem: 'success', pouco: 'warning',
  tomou: 'success', sem_medicacao: 'neutral',
  outro: 'neutral', sem_registro: 'neutral',
};

/* ------------------------------------------------------------------
   Varredura do relato geral da casa

   O relato geral é texto livre e descreve a casa, não um morador.
   Hoje é onde acabam registradas brigas, quedas e crises — eventos
   que não aparecem em nenhum campo estruturado.

   Esta varredura é um AUXÍLIO DE LEITURA, não uma rede de segurança:
   erra para os dois lados (pega "caiu a ficha", perde "empurrou").
   Serve para puxar o olho da supervisão, nunca para ser confiada.
   A solução correta é o módulo de intercorrências estruturado.
   ------------------------------------------------------------------ */

/** Termos que sugerem evento a apurar, por categoria. */
const INCIDENT_TERMS = {
  'Agressão': ['agress', 'agrediu', 'murro', 'soco', 'briga', 'brigou', 'bateu',
               'empurr', 'tapa', 'chute', 'ameac', 'ameaç', 'discussao', 'discussão'],
  'Queda': ['queda', 'caiu', 'escorreg', 'tombo', 'tropec'],
  'Crise': ['surto', 'surtou', 'crise', 'agitad', 'alucin', 'delir', 'delír',
            'autolesao', 'autolesão', 'se cortou', 'se machucou'],
  'Evasão': ['fugiu', 'evadiu', 'evasao', 'evasão', 'sumiu', 'desapareceu'],
  'Saúde': ['convuls', 'desmai', 'passou mal', 'vomit', 'febre', 'sangr',
            'machucou', 'ferimento', 'hospital', 'samu', 'ambulanc', 'ambulânc',
            'pronto socorro', 'pronto-socorro', 'upa'],
  'Externo': ['policia', 'polícia', 'bombeiro', 'conselho tutelar'],
};

/** Frases que significam "nada aconteceu". */
const ROUTINE_PHRASES = [
  'sem nenhuma intercorrencia', 'sem intercorrencia', 'sem intercorrencias',
  'nenhuma intercorrencia', 'sem nenhuma anormalidade', 'sem anormalidade',
  'sem anormalidades', 'nenhuma anormalidade', 'sem novidade', 'sem novidades',
  'plantao tranquilo', 'plantao calmo', 'plantao normal', 'plantao sem',
  'tudo tranquilo', 'tudo certo', 'tudo normal', 'tudo bem',
  'todos dormiram', 'dormiram bem', 'dormiram super bem', 'dormiram muito bem',
  'todos se alimentaram', 'se alimentaram', 'comeram bem', 'comeram todos',
  'tomaram banho', 'tomaram os medicamentos', 'tomaram a medicacao',
  'noite tranquila', 'dia tranquilo', 'normal', 'nada a relatar',
];

const STOPWORDS = new Set([
  'a', 'o', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
  'os', 'as', 'um', 'uma', 'que', 'com', 'por', 'para', 'se', 'foi', 'foram',
  'ao', 'aos', 'the', 'todos', 'todas', 'demais', 'plantao', 'noite', 'dia',
]);

/**
 * Classifica um relato geral.
 * @returns {{ status: 'vazio'|'rotina'|'conteudo'|'atencao', categorias: string[] }}
 *  - vazio    : nada escrito
 *  - rotina   : só frases de "tudo certo"
 *  - conteudo : tem informação, sem termo de alerta
 *  - atencao  : contém termo que sugere evento a apurar
 */
export function scanGeneralNotes(text) {
  const raw = String(text || '').trim();
  if (!raw) return { status: 'vazio', categorias: [] };

  const v = norm(raw);

  const categorias = Object.entries(INCIDENT_TERMS)
    .filter(([, terms]) => terms.some((t) => v.includes(norm(t))))
    .map(([categoria]) => categoria);

  if (categorias.length > 0) return { status: 'atencao', categorias };

  // Remove as frases de rotina e vê se sobrou alguma informação real.
  let resto = v;
  ROUTINE_PHRASES.forEach((phrase) => {
    resto = resto.split(norm(phrase)).join(' ');
  });

  const significativas = resto
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  return { status: significativas.length <= 2 ? 'rotina' : 'conteudo', categorias: [] };
}

function tally(entries, classifier, field) {
  const counts = {};
  entries.forEach((e) => {
    const key = classifier(e[field]);
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function toSegments(counts, labels, order) {
  return order
    .filter((key) => counts[key])
    .map((key) => ({
      key,
      label: labels[key],
      value: counts[key],
      tone: TONE_BY_KEY[key] || 'neutral',
    }));
}

/**
 * Extrai, de todos os plantões, as entradas referentes a um morador
 * dentro de um mês.
 *
 * @param {Array}  reports    linhas da tabela ShiftReport
 * @param {string} residentId id do morador
 * @param {string} monthKey   'YYYY-MM'
 */
export function buildMonthlySummary(reports, residentId, monthKey) {
  const [year, month] = String(monthKey).split('-').map(Number);
  const monthIndex = month - 1;

  const entries = [];

  (reports || []).forEach((report) => {
    const date = toDate(report.date);
    if (!date) return;
    if (date.getFullYear() !== year || date.getMonth() !== monthIndex) return;

    const perResident = report.reports?.[residentId];
    if (!perResident) return;

    entries.push({
      reportId: report.id,
      date,
      day: date.getDate(),
      author: report.caregiver_name || 'Não identificado',
      hygiene: perResident.hygiene,
      food: perResident.food,
      meds: perResident.meds,
      behavior: Array.isArray(perResident.behavior) ? perResident.behavior : [],
      notes: (perResident.notes || '').trim(),
      generalNotes: (report.general_notes || '').trim(),
    });
  });

  entries.sort((a, b) => a.date - b.date);

  const hygieneCounts = tally(entries, classifyHygiene, 'hygiene');
  const foodCounts = tally(entries, classifyFood, 'food');
  const medsCounts = tally(entries, classifyMeds, 'meds');

  // Dias do mês sem nenhum plantão registrado — lacuna de prontuário,
  // o primeiro item que uma auditoria procura.
  const diasNoMes = daysInMonth(year, monthIndex);
  const diasComRegistro = new Set(entries.map((e) => e.day));
  const hoje = new Date();
  const ultimoDiaRelevante =
    year === hoje.getFullYear() && monthIndex === hoje.getMonth() ? hoje.getDate() : diasNoMes;

  const diasSemRegistro = [];
  for (let d = 1; d <= ultimoDiaRelevante; d += 1) {
    if (!diasComRegistro.has(d)) diasSemRegistro.push(d);
  }

  const observacoes = entries
    .filter((e) => e.notes)
    .map((e) => ({ date: e.date, author: e.author, text: e.notes, day: e.day }));

  // Ocorrências que merecem atenção da supervisora
  const alertas = entries.filter(
    (e) =>
      classifyMeds(e.meds) === 'recusou' ||
      classifyFood(e.food) === 'recusou' ||
      classifyHygiene(e.hygiene) === 'recusou'
  );

  // Plantões cujo relato geral da casa merece leitura atenta
  const relatosAApurar = entries.filter(
    (e) => scanGeneralNotes(e.generalNotes).status === 'atencao'
  );

  // Comportamento: quantas vezes cada alteração foi observada, e em
  // que dias. Alimenta MUDANÇAS OBSERVADAS NO COMPORTAMENTO na ficha.
  const behaviorCounts = {};
  const behaviorDays = {};
  entries.forEach((e) => {
    (e.behavior || []).forEach((b) => {
      behaviorCounts[b] = (behaviorCounts[b] || 0) + 1;
      if (!behaviorDays[b]) behaviorDays[b] = [];
      behaviorDays[b].push({ day: e.day, date: e.date, author: e.author });
    });
  });

  const behaviorAlteracoes = Object.entries(behaviorCounts)
    .filter(([label]) => label !== 'Sem alteração')
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count, dias: behaviorDays[label] }));

  const comBehavior = entries.filter((e) => (e.behavior || []).length > 0).length;

  return {
    monthKey,
    year,
    month: monthIndex,
    totalPlantoes: entries.length,
    relatosAApurar,
    behavior: {
      counts: behaviorCounts,
      alteracoes: behaviorAlteracoes,
      registrados: comBehavior,
      semAlteracao: behaviorCounts['Sem alteração'] || 0,
    },
    diasNoMes,
    diasComRegistro: diasComRegistro.size,
    diasSemRegistro,
    entries,
    observacoes,
    alertas,
    hygiene: {
      counts: hygieneCounts,
      segments: toSegments(hygieneCounts, HYGIENE_LABELS, ['realizada', 'parcial', 'recusou', 'outro']),
    },
    food: {
      counts: foodCounts,
      segments: toSegments(foodCounts, FOOD_LABELS, ['bem', 'pouco', 'recusou', 'outro']),
    },
    meds: {
      counts: medsCounts,
      segments: toSegments(medsCounts, MEDS_LABELS, ['tomou', 'sem_medicacao', 'recusou', 'outro']),
    },
  };
}

/**
 * Agrupa as entradas do morador por dia do mês, para leitura corrida.
 *
 * Uma residência com plantão diurno e noturno produz duas entradas por
 * dia, de cuidadoras diferentes — ler isso em ordem cronológica é o que
 * a supervisão faz ao fechar o mês.
 */
export function groupEntriesByDay(entries) {
  const days = new Map();

  (entries || []).forEach((entry) => {
    if (!days.has(entry.day)) {
      days.set(entry.day, { day: entry.day, date: entry.date, items: [] });
    }
    days.get(entry.day).items.push(entry);
  });

  return Array.from(days.values())
    .sort((a, b) => a.day - b.day)
    .map((group) => ({
      ...group,
      items: group.items.slice().sort((a, b) => a.date - b.date),
      // "Tem anotação" = alguém escreveu sobre ESTE morador. O relato
      // geral da casa é obrigatório em todo plantão, então incluí-lo aqui
      // faria o filtro nunca excluir nada.
      hasWriting: group.items.some((i) => i.notes),
    }));
}

/** Rótulo do turno a partir do horário em que o plantão foi assinado. */
export function shiftLabel(date) {
  const hour = date instanceof Date ? date.getHours() : 0;
  if (hour >= 5 && hour < 13) return 'Manhã';
  if (hour >= 13 && hour < 19) return 'Tarde';
  return 'Noite';
}

/** Meses que efetivamente possuem plantões, do mais recente ao mais antigo. */
export function availableMonths(reports) {
  const keys = new Set();
  (reports || []).forEach((r) => {
    const d = toDate(r.date);
    if (d) keys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  });
  keys.add(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );
  return Array.from(keys).sort().reverse();
}

/**
 * Rascunho automático do parecer mensal. Não substitui a análise da
 * supervisora — entrega o texto factual já redigido para ela revisar,
 * que é exatamente o trabalho manual que consumia o fim do mês.
 */
export function draftNarrative(summary, residentName) {
  if (!summary || summary.totalPlantoes === 0) {
    return `Não há registros de passagem de plantão para ${residentName} no período selecionado.`;
  }

  const { totalPlantoes, hygiene, food, meds, observacoes, alertas, diasSemRegistro } = summary;
  const pct = (n) => Math.round(((n || 0) / totalPlantoes) * 100);
  const linhas = [];

  linhas.push(
    `No período foram registrados ${totalPlantoes} plantões com anotações sobre ${residentName}.`
  );

  const hRealizada = hygiene.counts.realizada || 0;
  if (hRealizada === totalPlantoes) {
    linhas.push('A higiene pessoal foi realizada em todos os plantões registrados.');
  } else {
    const partes = [`higiene realizada em ${hRealizada} plantões (${pct(hRealizada)}%)`];
    if (hygiene.counts.parcial) partes.push(`${hygiene.counts.parcial} com realização parcial`);
    if (hygiene.counts.recusou) partes.push(`${hygiene.counts.recusou} com recusa do banho`);
    linhas.push(`Quanto aos cuidados de higiene: ${partes.join(', ')}.`);
  }

  const fBem = food.counts.bem || 0;
  const partesAlim = [`aceitação plena em ${fBem} plantões (${pct(fBem)}%)`];
  if (food.counts.pouco) partesAlim.push(`${food.counts.pouco} com ingestão reduzida`);
  if (food.counts.recusou) partesAlim.push(`${food.counts.recusou} com recusa alimentar`);
  linhas.push(`Na alimentação e hidratação: ${partesAlim.join(', ')}.`);

  const mTomou = meds.counts.tomou || 0;
  const mRecusou = meds.counts.recusou || 0;
  if (mRecusou === 0) {
    linhas.push('Não houve recusa medicamentosa registrada no período.');
  } else {
    linhas.push(
      `Quanto à medicação: administrada normalmente em ${mTomou} plantões e recusada em ${mRecusou} ocasiões (${pct(mRecusou)}%), o que requer acompanhamento.`
    );
  }

  if (observacoes.length > 0) {
    linhas.push(
      `Foram lançadas ${observacoes.length} observações específicas pelas cuidadoras ao longo do período, detalhadas na seção de ocorrências.`
    );
  }

  if (alertas.length > 0) {
    linhas.push(
      `Total de ${alertas.length} ocorrências classificadas como recusa (higiene, alimentação ou medicação) merecem leitura individual.`
    );
  }

  if (diasSemRegistro.length > 0) {
    linhas.push(
      `Atenção: ${diasSemRegistro.length} dia(s) do período não possuem registro de plantão para este morador.`
    );
  }

  return linhas.join(' ');
}
