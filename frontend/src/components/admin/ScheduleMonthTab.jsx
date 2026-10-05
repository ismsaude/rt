import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock, ChevronLeft, ChevronRight, CircleAlert, Lock, LockOpen, PenLine, Printer,
  RefreshCw, Trash2, Wand2,
} from 'lucide-react';
import {
  apagarLancamentoDeEscala, apagarMesInteiro, assinarMes, gerarVariosMeses, proximosMeses, avisosDoMes, carregarFechamento,
  carregarFeriados, carregarMes, feriadosNacionais, reabrirMes, responsavelPelaAssinatura, gerarMes, gravarMesGerado, lancamentoPrevisto, mesAnterior, mesSeguinte,
  mesesComEscala, resumoPorPessoa, salvarFeriados, salvarLancamentoDeEscala, sobrescreverLancamento,
} from '../../lib/schedule';
import { formatDate, formatDateTime, formatMonthLabel, parseMonthKey } from '../../lib/format';
import SignatureModal from '../SignatureModal';
import {
  Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, Modal, MonthPicker, SelectField,
  SkeletonList, Stat, StatGrid, Table, useConfirm, useToast,
} from '../ui';
import ScheduleEntryModal from './ScheduleEntryModal';
import ScheduleGrid from './ScheduleGrid';
import ScheduleMealPanel from './ScheduleMealPanel';
import SchedulePrint from './SchedulePrint';

export default function ScheduleMonthTab({
  postos, equipe, currentUser, monthKey, setMonthKey, irParaPostos,
}) {
  const toast = useToast();
  const confirm = useConfirm();

  const [entradas, setEntradas] = useState([]);
  const [feriadosLista, setFeriadosLista] = useState([]);
  const [mesesGerados, setMesesGerados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [alvo, setAlvo] = useState(null);
  const [imprimindo, setImprimindo] = useState(false);
  const [assinando, setAssinando] = useState(false);
  const [fechamento, setFechamento] = useState(null);
  const [varios, setVarios] = useState(null); // { quantidade, feriados }

  const ano = parseMonthKey(monthKey).year;

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [mes, fer, meses, fech] = await Promise.all([
      carregarMes(monthKey), carregarFeriados(ano), mesesComEscala(), carregarFechamento(monthKey),
    ]);
    if (mes.error) toast.error('Não foi possível carregar a escala. A migração 015 foi aplicada?');
    setEntradas(mes.entradas);
    setFeriadosLista(fer.feriados);
    setMesesGerados(meses);
    setFechamento(fech.fechamento);
    setCarregando(false);
  }, [monthKey, ano, toast]);

  useEffect(() => { carregar(); }, [carregar]);

  const feriados = useMemo(
    () => new Map(feriadosLista.map((f) => [String(f.holiday_date).slice(0, 10), f.name])),
    [feriadosLista]
  );

  const resumo = useMemo(() => resumoPorPessoa(entradas), [entradas]);
  const avisos = useMemo(() => avisosDoMes(entradas), [entradas]);
  const totalPlantoes = resumo.reduce((s, p) => s + p.plantoes, 0);
  const totalHoras = resumo.reduce((s, p) => s + p.horas, 0);
  const gerada = entradas.length > 0;
  const executada = !!fechamento;
  const responsavel = useMemo(() => responsavelPelaAssinatura(postos, equipe), [postos, equipe]);
  const postosAtivos = postos.filter((p) => p.active);

  /* ---- Gerar / atualizar ---- */
  const importarFeriados = async () => {
    const { error } = await salvarFeriados(feriadosNacionais(ano));
    if (error) { toast.error(`Não foi possível importar: ${error.message}`); return false; }
    toast.success(`Feriados nacionais de ${ano} cadastrados.`);
    return true;
  };

  const gerar = async (atualizando) => {
    if (postosAtivos.length === 0) { irParaPostos(); return; }

    let lista = feriadosLista;
    if (lista.length === 0) {
      const ok = await confirm({
        title: `Nenhum feriado cadastrado em ${ano}`,
        message: 'Sem feriados, os postos de dias fixos (técnica, supervisão, comercial) saem escalados também nos feriados. Cadastrar os feriados nacionais agora?',
        confirmLabel: 'Cadastrar e gerar',
        cancelLabel: 'Gerar sem feriados',
        tone: 'primary',
      });
      if (ok) {
        if (!(await importarFeriados())) return;
        lista = (await carregarFeriados(ano)).feriados;
      }
    }

    if (atualizando) {
      const ok = await confirm({
        title: 'Atualizar a escala pelas regras',
        message: 'Os dias refeitos seguem as regras atuais dos postos e os feriados cadastrados. Os dias que você ajustou à mão são mantidos. Dias que você limpou voltam ao previsto.',
        confirmLabel: 'Atualizar',
        tone: 'primary',
      });
      if (!ok) return;
    }

    setOcupado(true);
    const geradas = gerarMes({ monthKey, postos, feriados: lista });
    const { error } = await gravarMesGerado({ monthKey, geradas, existentes: entradas });
    setOcupado(false);

    if (error) { toast.error(`Não foi possível gerar: ${error.message}`); return; }
    toast.success(atualizando ? 'Escala atualizada.' : `Escala de ${formatMonthLabel(monthKey)} gerada.`);
    carregar();
  };

  const apagarMes = async () => {
    const ok = await confirm({
      title: 'Apagar a escala do mês',
      message: `Toda a escala de ${formatMonthLabel(monthKey)}, inclusive os ajustes manuais, será apagada. As regras dos postos não mudam e a escala pode ser gerada de novo.`,
      confirmLabel: 'Apagar escala',
    });
    if (!ok) return;
    const { error } = await apagarMesInteiro(monthKey);
    if (error) { toast.error(`Não foi possível apagar: ${error.message}`); return; }
    carregar();
  };

  /* ---- Gerar vários meses de uma vez ---- */
  const gerarVarios = async () => {
    setOcupado(true);
    const meses = proximosMeses(monthKey, Number(varios.quantidade));
    const r = await gerarVariosMeses({ meses, postos, cadastrarFeriados: varios.feriados });
    setOcupado(false);
    setVarios(null);

    if (r.erro) { toast.error(`Não foi possível gerar: ${r.erro}`); carregar(); return; }
    const partes = [`${r.geradas.length} ${r.geradas.length === 1 ? 'mês gerado' : 'meses gerados'}`];
    if (r.puladas.length) partes.push(`${r.puladas.length} ${r.puladas.length === 1 ? 'já existia e foi mantido' : 'já existiam e foram mantidos'}`);
    if (r.feriadosCadastrados.length) partes.push(`feriados nacionais de ${r.feriadosCadastrados.join(', ')} cadastrados`);
    toast.success(`${partes.join(' · ')}.`);
    carregar();
  };

  /* ---- Assinatura: a escala vira "Escala Executada" ---- */
  const assinar = async (assinatura) => {
    const { error } = await assinarMes(monthKey, assinatura);
    if (error) { toast.error(`Não foi possível assinar: ${error.message}`); return; }
    setAssinando(false);
    toast.success('Escala executada assinada. Os lançamentos do mês ficaram travados.');
    carregar();
  };

  const reabrir = async () => {
    const ok = await confirm({
      title: 'Reabrir a escala',
      message: 'A assinatura será removida e os dias voltam a poder ser ajustados. A escala precisará ser assinada de novo.',
      confirmLabel: 'Reabrir',
    });
    if (!ok) return;
    const { error } = await reabrirMes(monthKey);
    if (error) { toast.error(`Não foi possível reabrir: ${error.message}`); return; }
    carregar();
  };

  /* ---- Ajustes de um dia ---- */
  const salvarDia = async (l) => {
    const { error } = await salvarLancamentoDeEscala(l);
    if (error) { toast.error(`Não foi possível salvar: ${error.message}`); return; }
    setAlvo(null);
    carregar();
  };

  const tirarDoDia = async (entrada) => {
    const { error } = await apagarLancamentoDeEscala(entrada.id);
    if (error) { toast.error(`Não foi possível limpar: ${error.message}`); return; }
    setAlvo(null);
    carregar();
  };

  const restaurar = async (linha, data, entrada) => {
    const posto = postos.find((p) => p.id === linha.shift_id);
    const previsto = posto ? lancamentoPrevisto(posto, data, new Set(feriados.keys())) : null;
    const { error } = previsto
      ? await sobrescreverLancamento({ ...previsto, id: entrada.id, note: null })
      : await apagarLancamentoDeEscala(entrada.id);
    if (error) { toast.error(`Não foi possível restaurar: ${error.message}`); return; }
    setAlvo(null);
    carregar();
  };

  const abrirDia = (linha, data, entrada) => setAlvo({ linha, data, entrada });

  /* ---- Render ---- */
  return (
    <div className="u-stack u-gap-5">
      <Card>
        <CardBody>
          <div className="sched-nav">
            <Button variant="secondary" iconOnly icon={ChevronLeft} aria-label="Mês anterior"
              onClick={() => setMonthKey(mesAnterior(monthKey))} />
            <div className="sched-nav__title">{formatMonthLabel(monthKey)}</div>
            <Button variant="secondary" iconOnly icon={ChevronRight} aria-label="Próximo mês"
              onClick={() => setMonthKey(mesSeguinte(monthKey))} />
            <MonthPicker value={monthKey} onChange={setMonthKey} withData={mesesGerados} />

            <div className="u-grow" />

            {gerada && (
              <>
                <Button variant="secondary" icon={Wand2} onClick={() => setVarios({ quantidade: 3, feriados: true })}>
                  Gerar próximos meses
                </Button>
                {!executada && (
                  <Button variant="secondary" icon={RefreshCw} loading={ocupado} onClick={() => gerar(true)}>
                    Atualizar pelas regras
                  </Button>
                )}
                <Button variant={executada ? 'primary' : 'secondary'} icon={Printer} onClick={() => setImprimindo(true)}>
                  Imprimir / PDF
                </Button>
                {!executada && (
                  <Button variant="primary" icon={PenLine} onClick={() => setAssinando(true)}>
                    Assinar escala executada
                  </Button>
                )}
              </>
            )}
          </div>
        </CardBody>
      </Card>

      {carregando ? (
        <SkeletonList rows={4} />
      ) : !gerada ? (
        <Card>
          <EmptyState
            icon={CalendarClock}
            title={`A escala de ${formatMonthLabel(monthKey)} ainda não foi gerada`}
            description={
              postosAtivos.length === 0
                ? 'Primeiro cadastre os postos de trabalho e quem cobre cada um.'
                : 'Ela é montada pelas regras dos postos e pelos feriados cadastrados. Depois você ajusta os dias que precisar.'
            }
            action={
              postosAtivos.length === 0 ? (
                <Button variant="primary" icon={Wand2} onClick={irParaPostos}>Cadastrar postos</Button>
              ) : (
                <div className="u-row u-gap-3" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Button variant="primary" icon={Wand2} loading={ocupado} onClick={() => gerar(false)}>
                    Gerar escala de {formatMonthLabel(monthKey).split(' ')[0]}
                  </Button>
                  <Button variant="secondary" onClick={() => setVarios({ quantidade: 3, feriados: true })}>
                    Gerar vários meses de uma vez…
                  </Button>
                </div>
              )
            }
          />
        </Card>
      ) : (
        <>
          {feriadosLista.length === 0 && (
            <Alert tone="warning" title={`Feriados de ${ano} não cadastrados`}>
              Sem eles, os postos de dias fixos aparecem escalados nos feriados.
              <div style={{ marginTop: 'var(--space-2)' }}>
                <Button size="sm" variant="secondary" onClick={async () => { if (await importarFeriados()) carregar(); }}>
                  Cadastrar feriados nacionais
                </Button>
              </div>
            </Alert>
          )}

          {executada && (
            <Alert tone="success" icon={Lock} title="Escala executada">
              Assinada por {fechamento.signed_by_name} em {formatDateTime(fechamento.signed_at)}. Os dias estão travados.
              <div style={{ marginTop: 'var(--space-2)' }}>
                <Button size="sm" variant="secondary" icon={LockOpen} onClick={reabrir}>Reabrir escala</Button>
              </div>
            </Alert>
          )}

          <StatGrid>
            <Stat label="Plantões no mês" value={totalPlantoes} hint={`${resumo.length} pessoas escaladas`} />
            <Stat label="Horas escaladas" value={`${totalHoras.toLocaleString('pt-BR')} h`} />
            <Stat
              label="Pontos de atenção" value={avisos.length}
              tone={avisos.length ? 'warning' : 'success'}
              hint={avisos.length ? 'veja abaixo da escala' : 'nada a corrigir'}
            />
          </StatGrid>

          <div className="sched-layout">
            <Card>
              <CardHeader
                title="Escala do mês"
                subtitle={executada ? 'Escala fechada: para alterar, reabra pelo aviso acima.' : 'Toque em um dia para trocar a pessoa, marcar folga ou mudar o horário.'}
                icon={CalendarClock}
              />
              <CardBody>
                <div className="sched-scroll">
                  <ScheduleGrid
                    monthKey={monthKey} entradas={entradas} feriados={feriados}
                    onCellClick={executada ? undefined : abrirDia}
                    todosNomes={equipe.map((u) => u.name)}
                  />
                </div>

                <div className="sched-legend" style={{ marginTop: 'var(--space-4)' }}>
                  <span className="sched-legend__item">
                    <span className="sched-legend__swatch" style={{ background: 'var(--warning-subtle)' }} />
                    Feriado: só os plantões 12x36 trabalham
                  </span>
                  <span className="sched-legend__item">
                    <span className="sched-legend__swatch" style={{ boxShadow: 'inset 3px 0 0 var(--primary)' }} />
                    Ajustado à mão
                  </span>
                  <span className="sched-legend__item">
                    <span className="sched-legend__swatch" style={{ background: 'var(--danger-subtle)' }} />
                    Sem ninguém escalado
                  </span>
                </div>
              </CardBody>
            </Card>

            <ScheduleMealPanel
              monthKey={monthKey} entradas={entradas} feriados={feriados} postos={postos}
              todosNomes={equipe.map((u) => u.name)}
            />
          </div>

          {avisos.length > 0 && (
            <Alert tone="warning" icon={CircleAlert} title="Pontos de atenção">
              <ul style={{ margin: 0, paddingLeft: 'var(--space-5)' }}>
                {avisos.slice(0, 12).map((a, i) => (
                  <li key={i}>
                    <strong>{formatDate(a.data).slice(0, 5)}</strong> — {a.texto}
                  </li>
                ))}
                {avisos.length > 12 && <li>e mais {avisos.length - 12}…</li>}
              </ul>
            </Alert>
          )}

          <Table>
            <thead>
              <tr>
                <th>Pessoa</th>
                <th style={{ textAlign: 'right' }}>Plantões</th>
                <th style={{ textAlign: 'right' }}>Horas</th>
                <th style={{ textAlign: 'right' }}>Fins de semana</th>
              </tr>
            </thead>
            <tbody>
              {resumo.map((p) => (
                <tr key={p.nome}>
                  <td className="table__cell-strong">{p.nome}</td>
                  <td className="table__cell-num" style={{ textAlign: 'right' }}>{p.plantoes}</td>
                  <td className="table__cell-num" style={{ textAlign: 'right' }}>
                    {p.horas.toLocaleString('pt-BR')} h
                  </td>
                  <td className="table__cell-num" style={{ textAlign: 'right' }}>{p.fins}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          {!executada && (
            <div>
              <Button variant="danger-ghost" size="sm" icon={Trash2} onClick={apagarMes}>
                Apagar a escala deste mês
              </Button>
            </div>
          )}
        </>
      )}

      <ScheduleEntryModal
        alvo={alvo}
        equipe={equipe}
        posto={alvo ? postos.find((p) => p.id === alvo.linha.shift_id) : null}
        feriados={feriados}
        onClose={() => setAlvo(null)}
        onSave={salvarDia}
        onRemove={tirarDoDia}
        onRestore={restaurar}
      />

      {varios && (
        <Modal
          open onClose={() => setVarios(null)} size="sm"
          title="Gerar vários meses"
          description="A escala de cada mês sai pronta pelas regras dos postos, com o revezamento 12x36 seguindo sem quebra de um mês para o outro."
          footer={
            <>
              <Button variant="secondary" onClick={() => setVarios(null)}>Cancelar</Button>
              <Button variant="primary" icon={Wand2} loading={ocupado} onClick={gerarVarios}>Gerar</Button>
            </>
          }
        >
          <div className="u-stack u-gap-4">
            <SelectField
              label={`A partir de ${formatMonthLabel(monthKey)}`}
              value={varios.quantidade}
              onChange={(e) => setVarios((v) => ({ ...v, quantidade: e.target.value }))}
            >
              {[1, 2, 3, 4, 6, 9, 12].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? 'Só este mês' : n === 2 ? 'Este mês e o próximo' : `Este mês e os próximos ${n - 1}`}
                  {' — até '}{formatMonthLabel(proximosMeses(monthKey, n)[n - 1])}
                </option>
              ))}
            </SelectField>
            <label className="checkbox">
              <input type="checkbox" checked={varios.feriados}
                onChange={(e) => setVarios((v) => ({ ...v, feriados: e.target.checked }))} />
              <span className="checkbox__box" aria-hidden="true">✓</span>
              <span>Cadastrar os feriados nacionais dos anos que ainda não os têm</span>
            </label>
            <Alert tone="info">Meses que já têm escala, inclusive assinada, não são alterados.</Alert>
          </div>
        </Modal>
      )}

      <SignatureModal
        open={assinando}
        onClose={() => setAssinando(false)}
        onSigned={assinar}
        currentUser={currentUser}
        title="Assinar a escala executada"
        description={formatMonthLabel(monthKey)}
      >
        <Alert tone="info">
          A escala de <strong>{formatMonthLabel(monthKey)}</strong> passa a ser a{' '}
          <strong>Escala Executada</strong> e os dias ficam travados. Confira os ajustes antes de assinar.
        </Alert>
      </SignatureModal>

      {imprimindo && (
        <SchedulePrint
          monthKey={monthKey} entradas={entradas} feriados={feriados}
          todosNomes={equipe.map((u) => u.name)}
          fechamento={fechamento} responsavel={responsavel}
          onDone={() => setImprimindo(false)}
        />
      )}
    </div>
  );
}
