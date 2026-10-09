import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera, CheckCircle2, ChevronLeft, ChevronRight, FileText, FileUp, Lock, LockOpen, PackageCheck, Pencil, PenLine, Plus, Printer, Trash2, Wallet,
} from 'lucide-react';
import {
  apagarLancamento, carregarConta, EXIGIR_COMPROVANTES, faltaComprovante, pendenciasDoMes, formatarReais, lerValor, mesDe, montarRelatorio,
  novoLancamento, paraCampo, salvarLancamento, salvarMes,
} from '../../lib/ledger';
import { supabase } from '../../lib/supabase';
import { removerFoto, BUCKET_COMPROVANTES } from '../../lib/photos';
import { mesAnterior, mesSeguinte } from '../../lib/schedule';
import { formatDate, formatMonthLabel, toISODate, toMonthKey, daysInMonth, parseMonthKey } from '../../lib/format';
import SignatureModal from '../SignatureModal';
import {
  Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, Modal, MonthPicker, PageHeader,
  Segmented, SelectField, SkeletonList, Stat, StatGrid, Table, TableEmpty, TextField,
  useConfirm, useToast,
} from '../ui';
import FundsClosingModal from './FundsClosingModal';
import FundsDocument from './FundsDocument';
import FundsPrint from './FundsPrint';
import ImportLedgerModal from './ImportLedgerModal';
import ReceiptPhotos from './ReceiptPhotos';

/**
 * Campo de valor que grava sozinho ~1 s depois da última tecla.
 * Vazio significa "sem valor" (null). Mostra o estado ao lado do rótulo.
 */
function ValorSalvo({ label, hint, centavos, onSave, disabled, placeholder }) {
  const [texto, setTexto] = useState(paraCampo(centavos));
  const [estado, setEstado] = useState('');
  const ultimo = useRef(centavos); // último valor que o banco conhece

  // O texto só é refeito quando o valor muda por fora (outro morador/mês,
  // recarga). Mudança causada pela própria gravação não mexe no campo:
  // reescrever o que a pessoa está digitando bagunça o cursor e os dígitos.
  useEffect(() => {
    if (centavos === ultimo.current) return;
    ultimo.current = centavos;
    setTexto(paraCampo(centavos));
    setEstado('');
  }, [centavos]);

  const invalido = texto.trim() !== '' && lerValor(texto) === null;

  const gravar = async () => {
    if (invalido) return;
    const novo = texto.trim() === '' ? null : lerValor(texto);
    if (novo === ultimo.current) return;

    const anterior = ultimo.current;
    ultimo.current = novo;
    setEstado('salvando');
    const ok = await onSave(novo);
    if (ok) setEstado('salvo');
    else { ultimo.current = anterior; setEstado('erro'); }
  };

  // Grava depois de uma pausa na digitação e também ao sair do campo.
  const gravarRef = useRef(gravar);
  gravarRef.current = gravar;
  useEffect(() => {
    const t = setTimeout(() => gravarRef.current(), 1500);
    return () => clearTimeout(t);
  }, [texto]);

  const aviso = { salvando: 'salvando…', salvo: 'salvo', erro: 'não foi possível salvar' }[estado];

  return (
    <TextField
      label={label}
      hint={invalido ? undefined : (aviso || hint)}
      error={invalido ? 'Valor inválido. Use o formato 1234,56.' : undefined}
      inputMode="decimal"
      placeholder={placeholder}
      value={texto}
      disabled={disabled}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={gravar}
    />
  );
}

/** Data padrão de um lançamento novo: hoje, se estiver no mês; senão, o fim do mês. */
function dataPadrao(monthKey) {
  const hoje = toISODate(new Date());
  if (mesDe(hoje) === monthKey) return hoje;
  const { year, month } = parseMonthKey(monthKey);
  return `${monthKey}-${String(daysInMonth(year, month)).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */

function EntryModal({ entry, onClose, onSaved, residentId, monthKey }) {
  const toast = useToast();
  const [form, setForm] = useState(entry);
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState({});
  const originais = useRef([]);

  useEffect(() => {
    setForm(entry);
    setValor(paraCampo(entry?.cents));
    setErros({});
    originais.current = (entry?.receipts || []).map((r) => r.path);
  }, [entry]);

  if (!entry || !form) return null;

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  /** Fotos enviadas nesta abertura e não gravadas não devem ficar órfãs no bucket. */
  const fechar = async () => {
    const novas = (form.receipts || []).filter((r) => !originais.current.includes(r.path));
    await Promise.all(novas.map((r) => removerFoto(r.path, BUCKET_COMPROVANTES)));
    onClose();
  };

  const salvar = async (outra) => {
    const cents = lerValor(valor);
    const e = {};
    if (!form.description.trim()) e.description = 'Descreva o lançamento.';
    if (cents === null || cents <= 0) e.valor = 'Informe um valor maior que zero.';
    if (!form.entry_date) e.entry_date = 'Informe a data.';
    if (faltaComprovante(form)) {
      e.receipts = 'Anexe a foto do comprovante, ou marque que esta saída não tem comprovante.';
    }
    setErros(e);
    if (Object.keys(e).length) return;

    setSalvando(true);
    const { error } = await salvarLancamento({ ...form, cents });
    setSalvando(false);

    if (error) { toast.error(`Não foi possível salvar: ${error.message}`); return; }

    // Fotos removidas durante a edição já saíram do bucket; as novas ficam.
    originais.current = form.receipts.map((r) => r.path);
    toast.success('Lançamento salvo.');
    onSaved({ ...form, cents }, outra);
  };

  return (
    <Modal
      open
      onClose={fechar}
      title={originais.current.length || entry.criado ? 'Editar lançamento' : 'Novo lançamento'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={fechar}>Cancelar</Button>
          {!entry.criado && (
            <Button variant="secondary" onClick={() => salvar(true)} loading={salvando}>
              Salvar e lançar outro
            </Button>
          )}
          <Button variant="primary" onClick={() => salvar(false)} loading={salvando}>Salvar</Button>
        </>
      }
    >
      <div className="u-stack u-gap-4">
        <Segmented
          ariaLabel="Tipo de lançamento"
          block
          value={form.kind}
          onChange={(kind) => setForm((f) => ({ ...f, kind }))}
          options={[
            { value: 'saida', label: 'Saída (compra, saque, tarifa)' },
            { value: 'entrada', label: 'Entrada' },
          ]}
        />

        <div className="field-row">
          <TextField
            label="Data" type="date" required
            value={form.entry_date}
            onChange={set('entry_date')}
            error={erros.entry_date}
          />
          <TextField
            label="Valor (R$)" required inputMode="decimal" placeholder="0,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            error={erros.valor}
          />
        </div>

        <TextField
          label="Descrição" required
          hint="Como no extrato. Ex.: Compra Débito Assai Atacadista"
          value={form.description}
          onChange={set('description')}
          error={erros.description}
        />

        <TextField
          label="Observação"
          value={form.obs || ''}
          onChange={set('obs')}
        />

        {form.kind === 'saida' && (
          <div className="u-stack u-gap-2">
            <span className="field__label">
              Comprovante{EXIGIR_COMPROVANTES && !form.receipt_exempt && <span className="field__required" aria-hidden="true"> *</span>}
            </span>
            {!form.receipt_exempt && (
              <ReceiptPhotos
                photos={form.receipts}
                onChange={(receipts) => setForm((f) => ({ ...f, receipts }))}
                residentId={residentId}
                monthKey={monthKey}
              />
            )}
            {/* Tarifa, seguro e débito automático não têm nota: a dispensa
                é decidida na hora, lançamento a lançamento. */}
            {!form.receipts.length && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={!!form.receipt_exempt}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, receipt_exempt: e.target.checked }));
                    setErros(({ receipts, ...resto }) => resto);
                  }}
                />
                <span className="checkbox__box" aria-hidden="true">✓</span>
                <span style={{ fontSize: 'var(--text-md)' }}>
                  Sem comprovante (tarifa bancária, seguro, débito automático)
                </span>
              </label>
            )}
            {erros.receipts && <span className="field__error">{erros.receipts}</span>}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

export default function ResidentFunds({ currentUser }) {
  const toast = useToast();
  const confirm = useConfirm();

  const [residents, setResidents] = useState([]);
  const [residentId, setResidentId] = useState('');
  const [monthKey, setMonthKey] = useState(toMonthKey(new Date()));
  const [conta, setConta] = useState({ lancamentos: [], meses: [] });
  const [carregando, setCarregando] = useState(true);
  const [entry, setEntry] = useState(null);
  const [assinando, setAssinando] = useState(false);
  const [imprimindo, setImprimindo] = useState(null);
  const [verRelatorio, setVerRelatorio] = useState(false);
  const [importando, setImportando] = useState(false);
  const [fechandoLote, setFechandoLote] = useState(false);
  const [corrigindoInicial, setCorrigindoInicial] = useState(false);
  const [digitandoExtrato, setDigitandoExtrato] = useState(false);

  // Os modos de correção valem só para o mês que estava aberto.
  useEffect(() => { setCorrigindoInicial(false); setDigitandoExtrato(false); }, [residentId, monthKey]);

  /* ---- Moradores ---- */
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('Resident').select('*').order('name');
      if (error) toast.error('Não foi possível carregar os moradores.');
      setResidents(data || []);
      if (data?.length) setResidentId((atual) => atual || data[0].id);
    })();
  }, [toast]);

  const resident = residents.find((r) => r.id === residentId);

  /* ---- Conta do morador ---- */
  // `silencioso` recarrega sem trocar a tela pelo "carregando": é o caso
  // das atualizações que chegam em tempo real enquanto a pessoa lê.
  const carregar = useCallback(async ({ silencioso = false } = {}) => {
    if (!residentId) return;
    if (!silencioso) setCarregando(true);
    const { error, lancamentos, meses } = await carregarConta(residentId);
    if (error) {
      if (!silencioso) toast.error('Não foi possível carregar a conta. A migração 014 foi aplicada?');
      return;
    }
    setConta({ lancamentos, meses });
    setCarregando(false);
  }, [residentId, toast]);

  useEffect(() => { carregar(); }, [carregar]);

  /* ---- Tempo real ----
   * Lançamento feito em outra aba, outro computador ou direto no banco
   * aparece sem recarregar a página. Uma importação gera dezenas de
   * eventos seguidos; a espera agrupa tudo numa única leitura.
   * Exige a migração 017 (tabelas na publicação supabase_realtime). */
  useEffect(() => {
    if (!residentId) return undefined;
    let espera;
    const aoMudar = (payload) => {
      const dono = payload.new?.resident_id ?? payload.old?.resident_id;
      if (dono && dono !== residentId) return;
      clearTimeout(espera);
      espera = setTimeout(() => carregar({ silencioso: true }), 400);
    };
    const canal = supabase
      .channel(`recursos-${residentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ResidentLedger' }, aoMudar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'LedgerMonth' }, aoMudar)
      .subscribe();
    return () => {
      clearTimeout(espera);
      supabase.removeChannel(canal);
    };
  }, [residentId, carregar]);

  const relatorio = useMemo(
    () => montarRelatorio(monthKey, conta.lancamentos, conta.meses),
    [monthKey, conta]
  );

  const mes = conta.meses.find((m) => m.month === monthKey) || null;
  const fechado = !!mes?.closed_at;
  const bancoCents = mes?.bank_closing_cents ?? null;
  const diferenca = bancoCents == null ? null : relatorio.final - bancoCents;
  const conferido = diferenca === 0 && relatorio.inicial.definido;

  const mesesComDados = useMemo(
    () => [...new Set(conta.lancamentos.map((l) => mesDe(l.entry_date)))],
    [conta]
  );

  /* ---- Gravação do mês ---- */
  const gravarMes = useCallback(async (campos) => {
    const { error } = await salvarMes({ residentId, monthKey, campos });
    if (error) { toast.error(`Não foi possível salvar: ${error.message}`); return false; }

    setConta((c) => {
      const existe = c.meses.some((m) => m.month === monthKey);
      const base = existe ? c.meses : [...c.meses, {
        resident_id: residentId, month: monthKey, opening_cents: null, bank_closing_cents: null, statement_photos: [],
      }];
      return {
        ...c,
        meses: base.map((m) => (m.month === monthKey ? { ...m, ...campos } : m)),
      };
    });
    return true;
  }, [residentId, monthKey, toast]);

  const marcarSemConta = async (valor) => {
    const { error } = await supabase.from('Resident').update({ no_bank_account: valor }).eq('id', residentId);
    if (error) { toast.error(`Não foi possível salvar: ${error.message}`); return; }
    setResidents((lista) => lista.map((r) => (r.id === residentId ? { ...r, no_bank_account: valor } : r)));
  };

  /* ---- Lançamentos ---- */
  const abrirNovo = () => setEntry(novoLancamento({
    residentId, dataISO: dataPadrao(monthKey), author: currentUser?.name,
  }));

  const abrirEdicao = (l) => setEntry({ ...l, criado: false, editando: true });

  const aoSalvar = (salvo, outra) => {
    setConta((c) => {
      const sem = c.lancamentos.filter((l) => l.id !== salvo.id);
      return { ...c, lancamentos: [...sem, { ...salvo, created_at: salvo.created_at || new Date().toISOString() }] };
    });

    const mesDoLancamento = mesDe(salvo.entry_date);
    if (mesDoLancamento !== monthKey) {
      toast.info?.(`Lançamento de ${formatMonthLabel(mesDoLancamento)}: o mês exibido foi trocado.`);
      setMonthKey(mesDoLancamento);
    }

    if (outra) {
      setEntry(novoLancamento({
        residentId, dataISO: salvo.entry_date, author: currentUser?.name,
      }));
    } else {
      setEntry(null);
    }
    carregar();
  };

  const apagar = async (l) => {
    const ok = await confirm({
      title: 'Apagar lançamento',
      message: `"${l.description}" (${formatarReais(l.cents)}) será apagado${l.receipts.length ? ', junto com as fotos da nota' : ''}.`,
      confirmLabel: 'Apagar',
    });
    if (!ok) return;

    const { error } = await apagarLancamento(l.id);
    if (error) { toast.error(`Não foi possível apagar: ${error.message}`); return; }
    await Promise.all(l.receipts.map((r) => removerFoto(r.path, BUCKET_COMPROVANTES)));
    setConta((c) => ({ ...c, lancamentos: c.lancamentos.filter((x) => x.id !== l.id) }));
  };

  /* ---- Fechamento ---- */
  const fechar = async (assinatura) => {
    const ok = await gravarMes({}) ;
    if (!ok) return;
    const { error } = await supabase
      .from('LedgerMonth')
      .update({ closed_at: new Date().toISOString(), ...assinatura })
      .eq('resident_id', residentId)
      .eq('month', monthKey);
    if (error) { toast.error(`Não foi possível fechar: ${error.message}`); return; }

    setAssinando(false);
    toast.success('Mês fechado e assinado.');
    carregar();
  };

  const reabrir = async () => {
    const ok = await confirm({
      title: 'Reabrir o mês',
      message: 'A assinatura será removida e os lançamentos voltam a poder ser alterados. O mês precisará ser assinado de novo.',
      confirmLabel: 'Reabrir',
    });
    if (!ok) return;

    const { error } = await supabase
      .from('LedgerMonth')
      .update({
        closed_at: null, signed_by_name: null, signed_by_role: null,
        signed_council: null, signed_at: null, signed_ip: null, signed_device: null,
      })
      .eq('resident_id', residentId)
      .eq('month', monthKey);
    if (error) { toast.error(`Não foi possível reabrir: ${error.message}`); return; }
    carregar();
  };

  const totalComprovantes = relatorio.linhas.reduce((n, l) => n + l.receipts.length, 0);

  /* ---- Pendências para fechar ---- */
  const semConta = !!resident?.no_bank_account;
  const pendencias = pendenciasDoMes({ relatorio, mes, semConta });

  return (
    <div className="u-stack u-gap-6">
      <PageHeader
        title="Recursos do Morador"
        description="Livro-caixa da conta de cada morador e relatório mensal de benefícios."
        actions={
          <>
            <Button variant="secondary" icon={PackageCheck} onClick={() => setFechandoLote(true)}
              disabled={!residents.length}>
              Fechar o mês
            </Button>
            <Button variant="secondary" icon={FileUp} onClick={() => setImportando(true)}
              disabled={!resident || fechado}>
              Importar planilha
            </Button>
            <Button variant="primary" icon={Plus} onClick={abrirNovo} disabled={!resident || fechado}>
              Novo lançamento
            </Button>
          </>
        }
      />

      <Card>
        <CardBody>
          <div className="funds-filters">
            <SelectField
              label="Morador"
              value={residentId}
              onChange={(e) => setResidentId(e.target.value)}
            >
              {residents.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </SelectField>
            <div className="field">
              <span className="field__label">Mês</span>
              <span className="u-row u-gap-2">
                <Button variant="secondary" iconOnly icon={ChevronLeft} aria-label="Mês anterior"
                  onClick={() => setMonthKey(mesAnterior(monthKey))} />
                <MonthPicker value={monthKey} onChange={setMonthKey} withData={mesesComDados} />
                <Button variant="secondary" iconOnly icon={ChevronRight} aria-label="Próximo mês"
                  onClick={() => setMonthKey(mesSeguinte(monthKey))} />
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      {!resident ? (
        <EmptyState icon={Wallet} title="Nenhum morador cadastrado" />
      ) : carregando ? (
        <SkeletonList rows={4} />
      ) : (
        <>
          {!resident.address && (
            <Alert tone="warning" title="Falta o endereço do morador">
              O relatório impresso traz o endereço no cabeçalho. Cadastre em Central de Cadastros.
            </Alert>
          )}

          {fechado && (
            <Alert tone="success" icon={Lock} title="Mês fechado e assinado">
              Os lançamentos estão travados.
              <div style={{ marginTop: 'var(--space-2)' }}>
                <Button variant="secondary" size="sm" icon={LockOpen} onClick={reabrir}>
                  Reabrir mês
                </Button>
              </div>
            </Alert>
          )}

          <StatGrid className="funds-stats">
            <Stat label="Saldo anterior" value={relatorio.inicial.definido ? formatarReais(relatorio.inicial.centavos) : '—'}
              hint={relatorio.inicial.definido ? ({ manual: 'informado à mão', extrato: 'extrato do mês anterior', calculado: 'calculado do mês anterior' }[relatorio.inicial.origem]) : 'informe abaixo'} />
            <Stat label="Entradas" value={formatarReais(relatorio.entradas)} tone="success" />
            <Stat label="Saídas" value={formatarReais(relatorio.saidas)} tone="danger" />
            <Stat label="Saldo atual" value={formatarReais(relatorio.final)} />
          </StatGrid>

          {/* Lançamentos */}
          <Table>
            <thead>
              <tr>
                <th>Item</th><th>Data</th><th>Descrição</th>
                <th style={{ textAlign: 'right' }}>Entrada</th>
                <th style={{ textAlign: 'right' }}>Saída</th>
                <th>Obs</th>
                <th style={{ textAlign: 'right' }}>Saldo</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="table__cell-muted">1</td>
                <td className="table__cell-muted">01/{monthKey.slice(5)}/{monthKey.slice(0, 4)}</td>
                <td className="table__cell-strong">Saldo inicial</td>
                <td /><td /><td />
                <td className="table__cell-num" style={{ textAlign: 'right' }}>
                  {relatorio.inicial.definido ? formatarReais(relatorio.inicial.centavos) : '—'}
                </td>
                <td />
              </tr>

              {relatorio.linhas.length === 0 && (
                <TableEmpty colSpan={8}>
                  <EmptyState
                    icon={Wallet}
                    title="Nenhum lançamento neste mês"
                    description="Cada compra, saque, tarifa ou rendimento entra como uma linha."
                  />
                </TableEmpty>
              )}

              {relatorio.linhas.map((l) => (
                <tr key={l.id}>
                  <td className="table__cell-muted">{l.item}</td>
                  <td className="table__cell-num">{formatDate(l.entry_date)}</td>
                  <td>
                    {l.description}
                    {l.receipts.length > 0 && (
                      <Badge tone="info" icon={Camera} className="u-ml-2">{l.receipts.length}</Badge>
                    )}
                    {faltaComprovante(l) && (
                      <Badge tone="warning" icon={Camera} className="u-ml-2">sem comprovante</Badge>
                    )}
                  </td>
                  <td className="table__cell-num" style={{ textAlign: 'right', color: 'var(--success-text)' }}>
                    {l.kind === 'entrada' ? formatarReais(l.cents) : ''}
                  </td>
                  <td className="table__cell-num" style={{ textAlign: 'right', color: 'var(--danger-text)' }}>
                    {l.kind === 'saida' ? formatarReais(l.cents) : ''}
                  </td>
                  <td className="table__cell-muted">{l.obs}</td>
                  <td className="table__cell-num table__cell-strong" style={{ textAlign: 'right' }}>
                    {formatarReais(l.saldo)}
                  </td>
                  <td>
                    {!fechado && (
                      <div className="table__actions">
                        <Button variant="ghost" size="sm" iconOnly icon={Pencil}
                          aria-label="Editar" onClick={() => abrirEdicao(l)} />
                        <Button variant="danger-ghost" size="sm" iconOnly icon={Trash2}
                          aria-label="Apagar" onClick={() => apagar(l)} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          {/* Conferência com o extrato */}
          <Card accent={conferido ? 'success' : diferenca != null ? 'danger' : 'warning'}>
            <CardHeader
              title="Conferência com o extrato"
              subtitle="Compare o saldo calculado aqui com o extrato impresso do caixa eletrônico."
              icon={CheckCircle2}
            />
            <CardBody>
              <div className="funds-conferencia">
                {/* Saldo inicial: automático (extrato ou cálculo do mês
                    anterior). Só vira campo para corrigir uma exceção. */}
                {relatorio.inicial.definido && !relatorio.inicial.manual && !corrigindoInicial ? (
                  <div className="u-stack u-gap-1">
                    <span className="field__label">Saldo inicial do mês</span>
                    <strong className="funds-conferencia__valor">{formatarReais(relatorio.inicial.centavos)}</strong>
                    <span className="field__hint">
                      {relatorio.inicial.origem === 'extrato'
                        ? `Saldo final do extrato de ${formatMonthLabel(mesAnterior(monthKey))}.`
                        : `Calculado: ${formatMonthLabel(mesAnterior(monthKey))} ainda não foi conferido com o extrato.`}
                    </span>
                    {!fechado && (
                      <Button variant="ghost" size="sm" icon={Pencil} className="u-self-start"
                        onClick={() => setCorrigindoInicial(true)}>
                        Corrigir
                      </Button>
                    )}
                  </div>
                ) : (
                  <ValorSalvo
                    key={`abertura-${residentId}-${monthKey}`}
                    label="Saldo inicial do mês (R$)"
                    hint={relatorio.inicial.manual
                      ? 'Informado à mão. Apague para voltar ao automático.'
                      : 'Primeiro mês: saldo anterior do extrato.'}
                    centavos={mes?.opening_cents ?? null}
                    placeholder={relatorio.inicial.definido ? paraCampo(relatorio.inicial.centavos) : 'Informe'}
                    disabled={fechado}
                    onSave={(v) => gravarMes({ opening_cents: v })}
                  />
                )}

                <div className="u-stack u-gap-1">
                  <span className="field__label">Saldo final calculado</span>
                  <strong className="funds-conferencia__valor">{formatarReais(relatorio.final)}</strong>
                  {conferido && <Badge tone="success" icon={CheckCircle2}>Conferido com o extrato</Badge>}
                  {diferenca != null && diferenca !== 0 && (
                    <Badge tone="danger">
                      Diferença de {formatarReais(Math.abs(diferenca))}
                      {diferenca > 0 ? ' a mais aqui' : ' a menos aqui'}
                    </Badge>
                  )}
                  {/* O caso comum é o extrato bater: um clique registra o saldo
                      calculado como o lido no extrato, sem redigitar. Se depois
                      um lançamento mudar, a diferença aparece, porque o
                      extrato impresso não muda. */}
                  {diferenca == null && !digitandoExtrato && !fechado && (!relatorio.inicial.definido
                    ? <Badge tone="warning">Informe o saldo inicial</Badge>
                    : (
                      <div className="funds-actions">
                        <Button variant="success" size="sm" icon={CheckCircle2}
                          onClick={() => gravarMes({ bank_closing_cents: relatorio.final })}>
                          Bate com o extrato
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setDigitandoExtrato(true)}>
                          Não bate
                        </Button>
                      </div>
                    ))}
                  {conferido && !fechado && (
                    <Button variant="ghost" size="sm" className="u-self-start"
                      onClick={() => gravarMes({ bank_closing_cents: null })}>
                      Desfazer conferência
                    </Button>
                  )}
                </div>

                {/* O valor do extrato só é digitado quando difere do calculado. */}
                {(digitandoExtrato || (bancoCents != null && !conferido)) ? (
                  <ValorSalvo
                    key={`extrato-${residentId}-${monthKey}`}
                    label="Saldo final no extrato (R$)"
                    hint="Conta + aplicação automática, no último dia do mês."
                    placeholder="Valor do extrato"
                    centavos={bancoCents}
                    disabled={fechado}
                    onSave={(v) => gravarMes({ bank_closing_cents: v })}
                  />
                ) : <div />}
              </div>

              {diferenca != null && diferenca !== 0 && (
                <Alert tone="warning" className="u-mt-4">
                  {diferenca > 0
                    ? 'O saldo calculado está acima do extrato: falta lançar alguma saída (saque, tarifa, compra) ou um valor foi digitado a maior.'
                    : 'O saldo calculado está abaixo do extrato: falta lançar alguma entrada (rendimento, benefício) ou uma saída foi digitada a maior.'}
                </Alert>
              )}

              <div className="u-stack u-gap-2 u-mt-4">
                <span className="field__label">
                  Foto ou PDF do extrato
                  {EXIGIR_COMPROVANTES && !semConta && <span className="field__required" aria-hidden="true"> *</span>}
                </span>
                {!semConta && (
                  <ReceiptPhotos
                    label="Fotografar extrato"
                    photos={mes?.statement_photos || []}
                    onChange={(statement_photos) => gravarMes({ statement_photos })}
                    residentId={residentId}
                    monthKey={monthKey}
                    readOnly={fechado}
                  />
                )}
                {/* Vale para o morador, não para o mês: quem não tem conta
                    em banco nunca terá extrato. */}
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={semConta}
                    disabled={fechado}
                    onChange={(e) => marcarSemConta(e.target.checked)}
                  />
                  <span className="checkbox__box" aria-hidden="true">✓</span>
                  <span style={{ fontSize: 'var(--text-md)' }}>
                    Morador sem conta em banco (não há extrato)
                  </span>
                </label>
              </div>
            </CardBody>
          </Card>

          {/* Ações do mês */}
          <Card>
            <CardBody>
              <div className="funds-actions">
                <Button variant="secondary" icon={FileText} onClick={() => setVerRelatorio((v) => !v)}>
                  {verRelatorio ? 'Ocultar relatório' : 'Ver relatório'}
                </Button>
                <Button variant="secondary" icon={Printer} onClick={() => setImprimindo('relatorio')}>
                  Imprimir relatório
                </Button>
                <Button
                  variant="secondary" icon={Printer}
                  disabled={totalComprovantes === 0 && !(mes?.statement_photos || []).length}
                  onClick={() => setImprimindo('comprovantes')}
                >
                  Imprimir comprovantes
                </Button>
                {!fechado && (
                  <Button variant="primary" icon={PenLine} disabled={pendencias.length > 0}
                    onClick={() => setAssinando(true)}>
                    Fechar mês e assinar
                  </Button>
                )}
              </div>
              {!fechado && pendencias.length > 0 && (
                <p className="u-subtle u-mt-3" style={{ fontSize: 'var(--text-sm)' }}>
                  Para fechar: {pendencias.join(', ')}.
                </p>
              )}
            </CardBody>
          </Card>

          {verRelatorio && (
            <div className="funds-preview">
              <FundsDocument
                resident={resident}
                monthKey={monthKey}
                relatorio={relatorio}
                assinatura={fechado ? mes : null}
              />
            </div>
          )}
        </>
      )}

      <EntryModal
        entry={entry}
        onClose={() => setEntry(null)}
        onSaved={aoSalvar}
        residentId={residentId}
        monthKey={monthKey}
      />

      <ImportLedgerModal
        open={importando}
        onClose={() => setImportando(false)}
        residentId={residentId}
        monthKey={monthKey}
        existentes={conta.lancamentos}
        saldoSistema={relatorio.inicial}
        author={currentUser?.name}
        onImported={async ({ saldoInicialPlanilha }) => {
          // Sem saldo inicial no sistema, adota o da planilha.
          if (saldoInicialPlanilha != null && !relatorio.inicial.definido) {
            await gravarMes({ opening_cents: saldoInicialPlanilha });
          }
          carregar();
        }}
      />

      <SignatureModal
        open={assinando}
        onClose={() => setAssinando(false)}
        onSigned={fechar}
        currentUser={currentUser}
        title="Fechar e assinar o mês"
        description={resident ? `${resident.name} — ${formatMonthLabel(monthKey)}` : ''}
      >
        <Alert tone="info">
          Saldo final de <strong>{formatarReais(relatorio.final)}</strong>, conferido com o extrato.
          Depois de assinado, os lançamentos ficam travados.
        </Alert>
      </SignatureModal>

      <FundsClosingModal
        open={fechandoLote}
        onClose={() => setFechandoLote(false)}
        monthKey={monthKey}
        residents={residents}
        currentUser={currentUser}
        onDone={() => carregar({ silencioso: true })}
      />

      {imprimindo && resident && (
        <FundsPrint
          modo={imprimindo}
          resident={resident}
          monthKey={monthKey}
          relatorio={relatorio}
          assinatura={fechado ? mes : null}
          extrato={mes?.statement_photos || []}
          onDone={() => setImprimindo(null)}
        />
      )}
    </div>
  );
}
