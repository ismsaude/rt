import { useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Repeat, Trash2, Users, Wand2 } from 'lucide-react';
import {
  COLUNAS_SEMANA, DIA_SEMANA_CURTO, REGRAS_REFEICAO, acertarRevezamento, apagarPosto, nomeCurto, postosPadrao,
  rotuloHorario, salvarPosto,
} from '../../lib/schedule';
import { toISODate } from '../../lib/format';
import {
  Alert, Badge, Button, Card, EmptyState, Modal, SelectField, Table, TextField, useConfirm, useToast,
} from '../ui';

const CATEGORIAS = [
  { value: 'cuidadora', label: 'Cuidadora' },
  { value: 'tecnica', label: 'Técnica de enfermagem' },
  { value: 'supervisao', label: 'Supervisão' },
  { value: 'outro', label: 'Outro' },
];

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const acharPor = (equipe, ...termos) =>
  equipe.find((u) => termos.some((t) => semAcento(u.name).includes(semAcento(t))))?.id || '';

const resumoDias = (p) => {
  if (p.pattern === '12x36') return '12x36 (revezamento)';
  const dias = COLUNAS_SEMANA.filter((d) => (p.weekdays || []).includes(d));
  if (dias.length === 0) return '—';
  if (dias.join() === '1,2,3,4,5') return 'Seg a Sex';
  if (dias.join() === '1,2,3,4,5,6') return 'Seg a Sáb';
  return dias.map((d) => DIA_SEMANA_CURTO[d]).join(' · ');
};

/* ------------------------------------------------------------------ */
/* Editor de posto                                                    */
/* ------------------------------------------------------------------ */

function ShiftModal({ posto, equipe, onClose, onSaved }) {
  const toast = useToast();
  const novo = !posto.id;
  const [f, setF] = useState(() => ({
    ...posto,
    weekday_exceptions: Object.entries(posto.weekday_hours || {}).map(([d, h]) => ({ dia: Number(d), ...h })),
    pessoas: (posto.people || []).map((p) => p.user_id),
    primeiro: (posto.people || [])[0]?.user_id || '',
    ancora: posto.anchor_date ? String(posto.anchor_date).slice(0, 10) : toISODate(new Date()),
  }));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const set = (campo) => (e) => setF((x) => ({ ...x, [campo]: e.target.value }));
  const doze = f.pattern === '12x36';

  const alternarDia = (d) => setF((x) => ({
    ...x,
    weekdays: x.weekdays.includes(d) ? x.weekdays.filter((v) => v !== d) : [...x.weekdays, d],
  }));

  const salvar = async () => {
    setErro('');
    if (!f.name.trim()) { setErro('Dê um nome ao posto.'); return; }
    const ids = f.pessoas.filter(Boolean);
    if (ids.length === 0) { setErro('Escolha quem cobre este posto.'); return; }
    if (new Set(ids).size !== ids.length) { setErro('A mesma pessoa foi escolhida duas vezes.'); return; }
    if (!doze && f.weekdays.length === 0) { setErro('Marque ao menos um dia da semana.'); return; }

    // Revezamento: quem trabalha na data de referência vem primeiro.
    let ordem = ids;
    if (doze) {
      const i = Math.max(0, ids.indexOf(f.primeiro));
      ordem = [...ids.slice(i), ...ids.slice(0, i)];
    }
    const pessoas = ordem.map((id) => ({ user_id: id, name: equipe.find((u) => u.id === id)?.name || '' }));

    const weekday_hours = {};
    f.weekday_exceptions.forEach((x) => { if (x.start && x.end) weekday_hours[x.dia] = { start: x.start, end: x.end }; });

    setSalvando(true);
    const { error } = await salvarPosto({
      ...f, people: pessoas, weekday_hours, anchor_date: doze ? f.ancora : null,
    });
    setSalvando(false);
    if (error) { toast.error(`Não foi possível salvar: ${error.message}`); return; }
    onSaved();
  };

  const trocarPessoa = (i, id) => setF((x) => {
    const pessoas = [...x.pessoas];
    pessoas[i] = id;
    return { ...x, pessoas };
  });

  return (
    <Modal
      open onClose={onClose} size="lg"
      title={novo ? 'Novo posto' : 'Editar posto'}
      description="As regras valem para as próximas escalas geradas. Meses já gerados só mudam se você atualizar o mês."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={salvar} loading={salvando}>Salvar</Button>
        </>
      }
    >
      <div className="u-stack u-gap-4">
        {erro && <Alert tone="danger">{erro}</Alert>}

        <div className="field-row">
          <TextField label="Nome do posto" required value={f.name} onChange={set('name')}
            placeholder="Ex.: Cuidadora diurno" />
          <SelectField label="Categoria" value={f.category} onChange={set('category')}>
            {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </SelectField>
        </div>

        <SelectField label="Como o posto é coberto" value={f.pattern} onChange={set('pattern')}>
          <option value="12x36">12x36: as pessoas se revezam (12h de trabalho, 36h de descanso)</option>
          <option value="semanal">Dias fixos da semana: sempre a mesma pessoa</option>
        </SelectField>

        <div className="field-row">
          <TextField label="Entrada" type="time" value={f.start_time} onChange={set('start_time')} />
          <TextField label="Saída" type="time" value={f.end_time} onChange={set('end_time')}
            hint={f.end_time <= f.start_time ? 'Termina no dia seguinte (plantão noturno).' : undefined} />
        </div>

        {!doze && (
          <>
            <div className="u-stack u-gap-2">
              <span className="field__label">Dias da semana</span>
              <div className="u-row u-gap-2" style={{ flexWrap: 'wrap' }}>
                {COLUNAS_SEMANA.map((d) => (
                  <Button
                    key={d} size="sm"
                    variant={f.weekdays.includes(d) ? 'primary' : 'secondary'}
                    onClick={() => alternarDia(d)}
                  >
                    {DIA_SEMANA_CURTO[d]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="u-stack u-gap-2">
              <span className="field__label">Horário diferente em algum dia</span>
              {f.weekday_exceptions.map((x, i) => (
                <div className="u-row u-gap-2" key={i} style={{ flexWrap: 'wrap' }}>
                  <select
                    className="select" style={{ width: 'auto' }} value={x.dia} aria-label="Dia"
                    onChange={(e) => setF((s) => {
                      const l = [...s.weekday_exceptions]; l[i] = { ...l[i], dia: Number(e.target.value) };
                      return { ...s, weekday_exceptions: l };
                    })}
                  >
                    {COLUNAS_SEMANA.map((d) => <option key={d} value={d}>{DIA_SEMANA_CURTO[d]}</option>)}
                  </select>
                  <input type="time" className="input" style={{ width: 'auto' }} value={x.start || ''} aria-label="Entrada"
                    onChange={(e) => setF((s) => {
                      const l = [...s.weekday_exceptions]; l[i] = { ...l[i], start: e.target.value };
                      return { ...s, weekday_exceptions: l };
                    })} />
                  <input type="time" className="input" style={{ width: 'auto' }} value={x.end || ''} aria-label="Saída"
                    onChange={(e) => setF((s) => {
                      const l = [...s.weekday_exceptions]; l[i] = { ...l[i], end: e.target.value };
                      return { ...s, weekday_exceptions: l };
                    })} />
                  <Button variant="ghost" size="sm" iconOnly icon={Trash2} aria-label="Remover"
                    onClick={() => setF((s) => ({
                      ...s, weekday_exceptions: s.weekday_exceptions.filter((_, k) => k !== i),
                    }))} />
                </div>
              ))}
              <div>
                <Button variant="ghost" size="sm" icon={Plus}
                  onClick={() => setF((s) => ({
                    ...s,
                    weekday_exceptions: [...s.weekday_exceptions, { dia: 6, start: '07:00', end: '11:00' }],
                  }))}>
                  Adicionar (ex.: sábado até 11h)
                </Button>
              </div>
            </div>
          </>
        )}

        <div className="u-stack u-gap-2">
          <span className="field__label">{doze ? 'Quem se reveza neste posto' : 'Quem cobre'}</span>
          {(doze ? f.pessoas : f.pessoas.slice(0, 1)).concat(f.pessoas.length === 0 ? [''] : []).map((id, i) => (
            <div className="u-row u-gap-2" key={i}>
              <select className="select" value={id} aria-label={`Pessoa ${i + 1}`}
                onChange={(e) => trocarPessoa(i, e.target.value)}>
                <option value="">Escolha…</option>
                {equipe.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              {doze && f.pessoas.length > 1 && (
                <Button variant="ghost" size="sm" iconOnly icon={Trash2} aria-label="Remover pessoa"
                  onClick={() => setF((s) => ({ ...s, pessoas: s.pessoas.filter((_, k) => k !== i) }))} />
              )}
            </div>
          ))}
          {doze && (
            <div>
              <Button variant="ghost" size="sm" icon={Plus}
                onClick={() => setF((s) => ({ ...s, pessoas: [...s.pessoas, ''] }))}>
                Adicionar pessoa ao revezamento
              </Button>
            </div>
          )}
        </div>

        {doze && (
          <div className="field-row">
            <TextField label="Dia de referência" type="date" value={f.ancora} onChange={set('ancora')}
              hint="Uma data em que você sabe quem está de plantão." />
            <SelectField label="Quem trabalha nesse dia" value={f.primeiro} onChange={set('primeiro')}>
              <option value="">Escolha…</option>
              {f.pessoas.filter(Boolean).map((id) => (
                <option key={id} value={id}>{equipe.find((u) => u.id === id)?.name}</option>
              ))}
            </SelectField>
          </div>
        )}

        <div className="field-row">
          <SelectField
            label="Refeição remunerada (1h extra)"
            value={f.meal_rule || 'nenhuma'}
            onChange={set('meal_rule')}
            hint="Para quem não pode sair para comer. Soma no quadro ao lado da escala."
          >
            {REGRAS_REFEICAO.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </SelectField>
          {(f.meal_rule || 'nenhuma') !== 'nenhuma' && (
            <TextField
              label="Horas por plantão" type="number" min="0.5" max="4" step="0.5"
              value={f.meal_hours ?? 1} onChange={set('meal_hours')}
            />
          )}
        </div>

        <label className="checkbox">
          <input type="checkbox" checked={f.works_on_holidays}
            onChange={(e) => setF((s) => ({ ...s, works_on_holidays: e.target.checked }))} />
          <span className="checkbox__box" aria-hidden="true">✓</span>
          <span>Trabalha em feriados</span>
        </label>

        <label className="checkbox">
          <input type="checkbox" checked={f.active}
            onChange={(e) => setF((s) => ({ ...s, active: e.target.checked }))} />
          <span className="checkbox__box" aria-hidden="true">✓</span>
          <span>Posto ativo (entra nas próximas escalas)</span>
        </label>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Assistente: estrutura padrão da casa                               */
/* ------------------------------------------------------------------ */

function WizardModal({ equipe, onClose, onCreated }) {
  const toast = useToast();
  const [v, setV] = useState(() => ({
    d1: acharPor(equipe, 'regina'), d2: acharPor(equipe, 'bruna'),
    n1: acharPor(equipe, 'roseli'), n2: acharPor(equipe, 'zenilda'),
    comercial: acharPor(equipe, 'maria valeria'),
    tecnica: acharPor(equipe, 'jane'),
    supervisora: acharPor(equipe, 'lais'),
    data: toISODate(new Date()),
    diaDiurno: acharPor(equipe, 'regina'), diaNoturno: acharPor(equipe, 'zenilda'),
  }));
  const [salvando, setSalvando] = useState(false);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const u = (id) => equipe.find((x) => x.id === id);

  const opcoes = (
    <>
      <option value="">Escolha…</option>
      {equipe.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </>
  );

  const pronto = [v.d1, v.d2, v.n1, v.n2, v.comercial, v.tecnica, v.supervisora].every(Boolean)
    && v.diaDiurno && v.diaNoturno
    && new Set([v.d1, v.d2, v.n1, v.n2]).size === 4;

  const criar = async () => {
    setSalvando(true);
    const postos = postosPadrao({
      diurno: [u(v.d1), u(v.d2)], noturno: [u(v.n1), u(v.n2)],
      comercial: u(v.comercial), tecnica: u(v.tecnica), supervisora: u(v.supervisora),
      ancoraDiurno: v.diaDiurno, ancoraNoturno: v.diaNoturno, dataAncora: v.data,
    });
    for (const p of postos) {
      // eslint-disable-next-line no-await-in-loop
      const { error } = await salvarPosto(p);
      if (error) { setSalvando(false); toast.error(`Não foi possível criar: ${error.message}`); return; }
    }
    setSalvando(false);
    toast.success('Postos criados. Agora é só gerar a escala do mês.');
    onCreated();
  };

  return (
    <Modal
      open onClose={onClose} size="lg"
      title="Montar a estrutura da casa"
      description="Cria os cinco postos de uma vez. Depois você pode editar cada um."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" icon={Wand2} onClick={criar} disabled={!pronto} loading={salvando}>
            Criar postos
          </Button>
        </>
      }
    >
      <div className="u-stack u-gap-4">
        <Alert tone="info">
          Plantões 12x36 trabalham todos os dias, inclusive feriados. Assistente, técnica e supervisão
          trabalham de segunda a sexta (assistente também no sábado, até 11h) e <strong>não trabalham em feriados</strong>.
        </Alert>

        <div className="field-row">
          <SelectField label="Cuidadora diurno 7–19h (1ª)" value={v.d1} onChange={set('d1')}>{opcoes}</SelectField>
          <SelectField label="Cuidadora diurno 7–19h (2ª)" value={v.d2} onChange={set('d2')}>{opcoes}</SelectField>
        </div>
        <div className="field-row">
          <SelectField label="Cuidadora noturno 19–7h (1ª)" value={v.n1} onChange={set('n1')}>{opcoes}</SelectField>
          <SelectField label="Cuidadora noturno 19–7h (2ª)" value={v.n2} onChange={set('n2')}>{opcoes}</SelectField>
        </div>
        <div className="field-row">
          <SelectField label="Assistente (cuidadora de horário comercial)" value={v.comercial} onChange={set('comercial')}>{opcoes}</SelectField>
          <SelectField label="Técnica de enfermagem" value={v.tecnica} onChange={set('tecnica')}>{opcoes}</SelectField>
        </div>
        <SelectField label="Supervisora" value={v.supervisora} onChange={set('supervisora')}>{opcoes}</SelectField>

        <div className="u-stack u-gap-3" style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }}>
          <strong>Quem está de plantão hoje?</strong>
          <span className="u-subtle" style={{ fontSize: 'var(--text-sm)' }}>
            É só isso: com quem trabalha de dia e quem trabalha de noite nessa data, o sistema já sabe
            quem são as outras (a alternância 12x36 segue sozinha em todos os meses).
          </span>
          <div className="field-row">
            <TextField label="Data" type="date" value={v.data} onChange={set('data')} />
            <div />
          </div>
          <div className="field-row">
            <SelectField label="De dia trabalha" value={v.diaDiurno} onChange={set('diaDiurno')}>
              <option value="">Escolha…</option>
              {[v.d1, v.d2].filter(Boolean).map((id) => <option key={id} value={id}>{u(id)?.name}</option>)}
            </SelectField>
            <SelectField label="De noite trabalha" value={v.diaNoturno} onChange={set('diaNoturno')}>
              <option value="">Escolha…</option>
              {[v.n1, v.n2].filter(Boolean).map((id) => <option key={id} value={id}>{u(id)?.name}</option>)}
            </SelectField>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Acertar o revezamento 12x36                                        */
/* ------------------------------------------------------------------ */

function RotationModal({ postos, onClose, onDone }) {
  const toast = useToast();
  const doze = postos.filter((p) => p.pattern === '12x36' && p.active);
  const [data, setData] = useState(toISODate(new Date()));
  const [escolhas, setEscolhas] = useState(() => {
    const hoje = toISODate(new Date());
    return Object.fromEntries(doze.map((p) => {
      // Sugere quem o revezamento atual diz que trabalha hoje.
      const pessoas = p.people || [];
      const ancora = p.anchor_date ? String(p.anchor_date).slice(0, 10) : hoje;
      const dif = Math.round((new Date(`${hoje}T12:00:00`) - new Date(`${ancora}T12:00:00`)) / 86400000);
      const quem = pessoas.length ? pessoas[((dif % pessoas.length) + pessoas.length) % pessoas.length] : null;
      return [p.id, quem?.user_id || ''];
    }));
  });
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setSalvando(true);
    const { error } = await acertarRevezamento({ postos: doze, dataISO: data, escolhas });
    setSalvando(false);
    if (error) { toast.error(`Não foi possível acertar: ${error.message}`); return; }
    toast.success('Revezamento acertado. Para refazer um mês já gerado, use "Atualizar pelas regras".');
    onDone();
  };

  return (
    <Modal
      open onClose={onClose} size="md"
      title="Acertar o revezamento"
      description="Diga quem está de plantão em uma data. A alternância 12x36 passa a seguir a partir dela, em todos os meses."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={salvar} loading={salvando}
            disabled={doze.some((p) => !escolhas[p.id])}>
            Acertar
          </Button>
        </>
      }
    >
      <div className="u-stack u-gap-4">
        <TextField label="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        {doze.map((p) => (
          <SelectField key={p.id} label={`${p.name} — nessa data trabalha`} value={escolhas[p.id]}
            onChange={(e) => setEscolhas((x) => ({ ...x, [p.id]: e.target.value }))}>
            <option value="">Escolha…</option>
            {(p.people || []).map((x) => <option key={x.user_id} value={x.user_id}>{x.name}</option>)}
          </SelectField>
        ))}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

export default function ScheduleShiftsTab({ postos, equipe, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [editando, setEditando] = useState(null);
  const [assistente, setAssistente] = useState(false);
  const [revezamento, setRevezamento] = useState(false);

  const todosNomes = equipe.map((u) => u.name);

  const novo = () => setEditando({
    name: '', category: 'cuidadora', pattern: 'semanal', start_time: '08:00', end_time: '17:00',
    weekdays: [1, 2, 3, 4, 5], weekday_hours: {}, works_on_holidays: false,
    meal_rule: 'nenhuma', meal_hours: 1,
    people: [], anchor_date: null, position: postos.length + 1, active: true,
  });

  const mover = async (posto, delta) => {
    const lista = [...postos].sort((a, b) => a.position - b.position);
    const i = lista.findIndex((p) => p.id === posto.id);
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    for (let k = 0; k < lista.length; k += 1) {
      // eslint-disable-next-line no-await-in-loop
      await salvarPosto({ ...lista[k], position: k + 1 });
    }
    onChanged();
  };

  const apagar = async (posto) => {
    const ok = await confirm({
      title: 'Apagar posto',
      message: `"${posto.name}" deixa de existir nas próximas escalas. Os meses já gerados continuam como estão. Para só pausar, desmarque "Posto ativo".`,
      confirmLabel: 'Apagar posto',
    });
    if (!ok) return;
    const { error } = await apagarPosto(posto.id);
    if (error) { toast.error(`Não foi possível apagar: ${error.message}`); return; }
    onChanged();
  };

  return (
    <div className="u-stack u-gap-5">
      {postos.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Nenhum posto cadastrado"
            description="Um posto é uma função da escala (cuidadora diurno, técnica, supervisão…) com quem a cobre e os dias de trabalho."
            action={
              <div className="u-row u-gap-3" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button variant="primary" icon={Wand2} onClick={() => setAssistente(true)}>
                  Montar a estrutura da casa
                </Button>
                <Button variant="secondary" icon={Plus} onClick={novo}>Cadastrar um posto</Button>
              </div>
            }
          />
        </Card>
      ) : (
        <>
          <div className="u-row u-gap-3" style={{ flexWrap: 'wrap' }}>
            <Button variant="primary" icon={Plus} onClick={novo}>Novo posto</Button>
            {postos.some((p) => p.pattern === '12x36' && p.active) && (
              <Button variant="secondary" icon={Repeat} onClick={() => setRevezamento(true)}>
                Acertar o revezamento
              </Button>
            )}
          </div>

          <Table>
            <thead>
              <tr>
                <th>Posto</th><th>Dias</th><th>Horário</th><th>Quem cobre</th><th>Feriado</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {[...postos].sort((a, b) => a.position - b.position).map((p, i, todos) => (
                <tr key={p.id} style={!p.active ? { opacity: 0.55 } : undefined}>
                  <td>
                    <div className="table__cell-strong">{p.name}</div>
                    {!p.active && <Badge tone="neutral">inativo</Badge>}
                  </td>
                  <td>{resumoDias(p)}</td>
                  <td className="table__cell-num">
                    {rotuloHorario(p.start_time, p.end_time)}
                    {Object.entries(p.weekday_hours || {}).map(([d, h]) => (
                      <div key={d} className="table__cell-muted" style={{ fontSize: 'var(--text-xs)' }}>
                        {DIA_SEMANA_CURTO[d]}: {rotuloHorario(h.start, h.end)}
                      </div>
                    ))}
                  </td>
                  <td>{(p.people || []).map((x) => nomeCurto(x.name, todosNomes)).join(' · ') || '—'}</td>
                  <td>
                    <Badge tone={p.works_on_holidays ? 'primary' : 'neutral'}>
                      {p.works_on_holidays ? 'trabalha' : 'folga'}
                    </Badge>
                  </td>
                  <td>
                    <div className="table__actions">
                      <Button variant="ghost" size="sm" iconOnly icon={ArrowUp} aria-label="Subir"
                        disabled={i === 0} onClick={() => mover(p, -1)} />
                      <Button variant="ghost" size="sm" iconOnly icon={ArrowDown} aria-label="Descer"
                        disabled={i === todos.length - 1} onClick={() => mover(p, 1)} />
                      <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditando(p)}>
                        Editar
                      </Button>
                      <Button variant="danger-ghost" size="sm" iconOnly icon={Trash2} aria-label="Apagar"
                        onClick={() => apagar(p)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}

      {editando && (
        <ShiftModal
          posto={editando} equipe={equipe}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); onChanged(); }}
        />
      )}
      {revezamento && (
        <RotationModal
          postos={postos}
          onClose={() => setRevezamento(false)}
          onDone={() => { setRevezamento(false); onChanged(); }}
        />
      )}
      {assistente && (
        <WizardModal
          equipe={equipe}
          onClose={() => setAssistente(false)}
          onCreated={() => { setAssistente(false); onChanged(); }}
        />
      )}
    </div>
  );
}
