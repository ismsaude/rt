import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Download, Lock, PenLine } from 'lucide-react';
import {
  carregarTodasAsContas, fecharMeses, formatarReais, montarRelatorio, pendenciasDoMes, salvarMes,
} from '../../lib/ledger';
import { formatMonthLabel } from '../../lib/format';
import {
  Alert, Badge, Button, Modal, SkeletonList, useConfirm, useToast,
} from '../ui';
import SignatureModal from '../SignatureModal';
import FundsDocument from './FundsDocument';
import { aguardarImagens } from './MonthSheetsPrint';

/**
 * Fechamento do mês dos recursos: todos os moradores de uma vez.
 *
 * Mesmo desenho do fechamento das fichas clínicas: conferir, assinar e
 * baixar em lote, poupando a senha repetida. A regra do que impede o
 * fechamento é a mesma da tela do morador (`pendenciasDoMes`).
 *
 * O passo 1 grava "bate com o extrato" para vários moradores com um
 * clique; por isso pede confirmação: só vale para quem teve o extrato
 * de papel conferido.
 */

const ESTADO = {
  sem: { tom: 'neutral', texto: 'sem lançamentos' },
  pendente: { tom: 'warning', texto: 'pendente' },
  pronto: { tom: 'primary', texto: 'pronto para assinar' },
  fechado: { tom: 'success', texto: 'fechado' },
};

/** Um passo do fechamento, com explicação e ação. */
function Passo({ numero, titulo, descricao, children, feito = false }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-3)',
        padding: 'var(--space-4)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: feito ? 'var(--success-subtle)' : 'var(--surface)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'grid',
          placeItems: 'center',
          flex: '0 0 auto',
          width: 26, height: 26,
          borderRadius: 'var(--radius-full)',
          background: 'var(--primary-subtle)',
          color: 'var(--primary-text)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
        }}
      >
        {feito ? <CheckCircle2 size={16} /> : numero}
      </span>
      <div className="u-stack u-gap-3" style={{ minWidth: 0, flex: 1 }}>
        <div>
          <strong style={{ fontSize: 'var(--text-md)' }}>{titulo}</strong>
          <span style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 2 }}>
            {descricao}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Todos os relatórios do mês numa impressão só (uma página por morador). */
function ImpressaoEmLote({ itens, monthKey, onDone }) {
  const ref = useRef(null);

  useEffect(() => {
    let encerrado = false;
    const concluir = () => {
      if (encerrado) return;
      encerrado = true;
      onDone?.();
    };
    document.body.classList.add('is-batch-print');
    (async () => {
      await aguardarImagens(ref.current, itens.length); // a logo de cada relatório
      if (encerrado) return;
      window.addEventListener('afterprint', concluir, { once: true });
      window.print();
      setTimeout(concluir, 800);
    })();
    return () => {
      encerrado = true;
      window.removeEventListener('afterprint', concluir);
      document.body.classList.remove('is-batch-print');
    };
    // Montado uma vez por impressão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="sheet-batch" ref={ref} aria-hidden="true">
      {itens.map(({ resident, relatorio, mes }) => (
        <FundsDocument
          key={resident.id}
          resident={resident}
          monthKey={monthKey}
          relatorio={relatorio}
          assinatura={mes?.closed_at ? mes : null}
        />
      ))}
    </div>,
    document.body
  );
}

export default function FundsClosingModal({ open, onClose, monthKey, residents, currentUser, onDone }) {
  const toast = useToast();
  const confirm = useConfirm();

  const [carregando, setCarregando] = useState(true);
  const [linhas, setLinhas] = useState([]);
  const [alvos, setAlvos] = useState([]);
  const [conferindo, setConferindo] = useState(false);
  const [assinando, setAssinando] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [imprimindo, setImprimindo] = useState(null);

  const nomeDoMes = formatMonthLabel(monthKey);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { error, porMorador } = await carregarTodasAsContas();
    if (error) toast.error(`Não foi possível carregar as contas: ${error.message}`);
    const novas = residents.map((resident) => {
      const conta = porMorador.get(resident.id) || { lancamentos: [], meses: [] };
      const relatorio = montarRelatorio(monthKey, conta.lancamentos, conta.meses);
      const mes = conta.meses.find((m) => m.month === monthKey) || null;
      const pendencias = pendenciasDoMes({ relatorio, mes, semConta: !!resident.no_bank_account });
      let estado;
      if (mes?.closed_at) estado = 'fechado';
      else if (!relatorio.inicial.definido && relatorio.linhas.length === 0) estado = 'sem';
      else estado = pendencias.length ? 'pendente' : 'pronto';
      return { resident, relatorio, mes, pendencias, estado };
    });
    setLinhas(novas);
    setCarregando(false);
    return novas;
  }, [monthKey, residents, toast]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const novas = await carregar();
      setAlvos(novas.filter((l) => l.estado !== 'sem').map((l) => l.resident.id));
    })();
  }, [open, carregar]);

  const selecionadas = useMemo(
    () => linhas.filter((l) => alvos.includes(l.resident.id)),
    [linhas, alvos]
  );

  // Passo 1: só os que ainda não têm o saldo do extrato e já têm saldo inicial.
  const aConferir = selecionadas.filter(
    (l) => l.estado === 'pendente' && l.relatorio.inicial.definido && l.mes?.bank_closing_cents == null
  );
  const aAssinar = selecionadas.filter((l) => l.estado === 'pronto');
  const aBaixar = selecionadas.filter((l) => l.estado !== 'sem');
  const pendentes = selecionadas.filter((l) => l.estado === 'pendente');
  const fechados = selecionadas.filter((l) => l.estado === 'fechado');

  const alternar = (id) =>
    setAlvos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  /* ---------------- Passo 1: conferir ---------------- */
  const conferir = async () => {
    const ok = await confirm({
      title: `Confirmar ${aConferir.length} extrato(s)`,
      message:
        'O saldo calculado será registrado como o saldo final do extrato de: ' +
        aConferir.map((l) => `${l.resident.name} (${formatarReais(l.relatorio.final)})`).join('; ') +
        '. Confirme só se conferiu cada um com o extrato de papel.',
      confirmLabel: 'Bate com o extrato',
    });
    if (!ok) return;

    setConferindo(true);
    const erros = [];
    for (const l of aConferir) {
      const { error } = await salvarMes({
        residentId: l.resident.id, monthKey, campos: { bank_closing_cents: l.relatorio.final },
      });
      if (error) erros.push(`${l.resident.name}: ${error.message}`);
    }
    setConferindo(false);
    if (erros.length) toast.error(`Falhou em ${erros.length}: ${erros[0]}`);
    else toast.success(`${aConferir.length} extrato(s) conferido(s).`);
    await carregar();
    onDone?.();
  };

  /* ---------------- Passo 2: assinar ---------------- */
  const assinarTudo = async (assinatura) => {
    setAssinando(true);
    const { ok, erros } = await fecharMeses({
      residentIds: aAssinar.map((l) => l.resident.id), monthKey, assinatura,
    });
    setAssinando(false);
    setSignOpen(false);
    if (erros.length) toast.error(`Falhou em ${erros.length} morador(es): ${erros[0].mensagem}`);
    else toast.success(`${ok === 1 ? '1 mês fechado' : `${ok} meses fechados`} e assinados em nome de ${assinatura.signed_by_name}.`);
    await carregar();
    onDone?.();
  };

  /* ---------------- Passo 3: baixar ---------------- */
  const baixar = () => setImprimindo(aBaixar);
  const semAssinaturaNoPdf = aBaixar.filter((l) => l.estado !== 'fechado').length;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Fechar o mês"
        description={`Recursos de ${nomeDoMes}: conferir, assinar e baixar de uma vez.`}
        size="lg"
        footer={<Button variant="secondary" onClick={onClose}>Fechar</Button>}
      >
        {carregando && !linhas.length ? (
          <SkeletonList count={3} />
        ) : (
          <div className="u-stack u-gap-5">
            <div>
              <span className="field__label" style={{ marginBottom: 'var(--space-2)' }}>
                Moradores no fechamento
              </span>
              <div className="chips">
                {linhas.map(({ resident, estado }) => (
                  <button
                    key={resident.id}
                    type="button"
                    className="chip"
                    data-tone={ESTADO[estado].tom}
                    aria-pressed={alvos.includes(resident.id)}
                    onClick={() => alternar(resident.id)}
                  >
                    {resident.name} · {ESTADO[estado].texto}
                  </button>
                ))}
              </div>
              <span className="field__hint" style={{ display: 'block', marginTop: 'var(--space-2)' }}>
                {selecionadas.length} de {linhas.length} selecionados
              </span>
            </div>

            {pendentes.length > 0 && (
              <Alert tone="warning" title="Pendências">
                <ul style={{ margin: 0, paddingLeft: '1.1em' }}>
                  {pendentes.map((l) => (
                    <li key={l.resident.id}>
                      <strong>{l.resident.name}</strong>: {l.pendencias.join(', ')}.
                    </li>
                  ))}
                </ul>
              </Alert>
            )}

            <div className="u-stack u-gap-3">
              <Passo
                numero={1}
                titulo="Conferir com os extratos"
                descricao="Para quem ainda não teve o saldo final confirmado: registra que o saldo calculado bate com o extrato de papel. Se algum não bater, digite o valor do extrato na tela do morador."
                feito={aConferir.length === 0 && selecionadas.length > 0}
              >
                <div>
                  <Button
                    variant="success" size="sm" icon={CheckCircle2}
                    onClick={conferir} loading={conferindo}
                    disabled={aConferir.length === 0}
                  >
                    Bate com o extrato {aConferir.length > 0 && `(${aConferir.length})`}
                  </Button>
                </div>
              </Passo>

              <Passo
                numero={2}
                titulo="Fechar e assinar"
                descricao="Uma confirmação de senha fecha todos os prontos, com a mesma data, hora, IP e aparelho. Mês fechado trava os lançamentos."
                feito={aAssinar.length === 0 && fechados.length > 0}
              >
                <div>
                  <Button
                    variant="primary" size="sm" icon={PenLine}
                    onClick={() => setSignOpen(true)}
                    disabled={aAssinar.length === 0}
                  >
                    Assinar {aAssinar.length > 0 && `(${aAssinar.length})`}
                  </Button>
                </div>
              </Passo>

              <Passo
                numero={3}
                titulo="Baixar tudo em PDF"
                descricao="Abre a impressão com o relatório de cada morador, um por página. Escolha “Salvar como PDF” para guardar o mês inteiro num arquivo só."
              >
                <div className="u-stack u-gap-3">
                  {semAssinaturaNoPdf > 0 && (
                    <Alert tone="info">
                      {semAssinaturaNoPdf === 1
                        ? '1 relatório ainda não assinado sai'
                        : `${semAssinaturaNoPdf} relatórios ainda não assinados saem`}{' '}
                      com a linha em branco, para assinatura à mão.
                    </Alert>
                  )}
                  <div>
                    <Button
                      variant="primary" size="sm" icon={Download}
                      onClick={baixar}
                      disabled={aBaixar.length === 0}
                    >
                      Baixar {aBaixar.length > 0 && `(${aBaixar.length})`}
                    </Button>
                  </div>
                </div>
              </Passo>
            </div>

            {fechados.length > 0 && (
              <div className="u-row u-gap-2 u-wrap">
                <Badge tone="success" icon={Lock}>
                  {fechados.length === 1
                    ? '1 mês já fechado permanece como está'
                    : `${fechados.length} meses já fechados permanecem como estão`}
                </Badge>
              </div>
            )}
          </div>
        )}
      </Modal>

      <SignatureModal
        open={signOpen}
        onClose={() => setSignOpen(false)}
        onSigned={assinarTudo}
        currentUser={currentUser}
        title={`Fechar ${aAssinar.length} mês(es)`}
        description={`Recursos de ${nomeDoMes}.`}
      >
        <Alert tone="warning" title="A assinatura vale para todos os marcados">
          {aAssinar.map((l) => `${l.resident.name} (${formatarReais(l.relatorio.final)})`).join(', ')}.
          {' '}Depois de assinados, os lançamentos ficam travados.
        </Alert>
        {assinando && <span className="u-muted">Gravando as assinaturas…</span>}
      </SignatureModal>

      {imprimindo && (
        <ImpressaoEmLote itens={imprimindo} monthKey={monthKey} onDone={() => setImprimindo(null)} />
      )}
    </>
  );
}
