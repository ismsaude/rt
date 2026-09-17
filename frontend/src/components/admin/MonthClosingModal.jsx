import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, Download, Lock, PenLine, Sparkles,
} from 'lucide-react';
import { loadMonthSheets } from '../../lib/monthlyReport';
import {
  assinarFichasDoMes, estadoDaFicha, gerarFichasDoMes,
} from '../../lib/monthClose';
import { formatMonthLabel } from '../../lib/format';
import {
  Alert, Badge, Button, Modal, SkeletonList, useToast,
} from '../ui';
import SignatureModal from '../SignatureModal';
import MonthSheetsPrint from './MonthSheetsPrint';

/**
 * Fechamento do mês: as fichas da casa inteira em três passos.
 *
 * O trabalho de fim de mês era abrir morador por morador e repetir a
 * mesma sequência. Aqui ela acontece uma vez para todos: gerar o que o
 * sistema já sabe, assinar o que foi revisado e baixar tudo num PDF.
 *
 * O passo do meio não é automático por descuido: assinar é declarar que
 * se leu. O lote poupa a senha repetida, não a leitura.
 */

const ESTADO = {
  vazia: { tom: 'neutral', texto: 'sem ficha' },
  preenchida: { tom: 'primary', texto: 'preenchida' },
  assinada: { tom: 'success', texto: 'assinada' },
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
          <span
            style={{
              display: 'block',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)',
              marginTop: 2,
            }}
          >
            {descricao}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function MonthClosingModal({
  open, onClose, monthKey, residents, reports, events, incidents, currentUser, onDone,
}) {
  const toast = useToast();

  const [carregando, setCarregando] = useState(true);
  const [linhas, setLinhas] = useState([]);
  const [alvos, setAlvos] = useState([]);
  const [gerando, setGerando] = useState(false);
  const [assinando, setAssinando] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [imprimindo, setImprimindo] = useState(null);

  const mes = formatMonthLabel(monthKey);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { porMorador } = await loadMonthSheets(monthKey);
    setLinhas(
      residents.map((resident) => {
        const row = porMorador.get(resident.id) || null;
        return { resident, row, estado: estadoDaFicha(row) };
      })
    );
    setCarregando(false);
  }, [monthKey, residents]);

  useEffect(() => {
    if (!open) return;
    setAlvos(residents.map((r) => r.id));
    carregar();
  }, [open, carregar, residents]);

  const selecionadas = useMemo(
    () => linhas.filter((l) => alvos.includes(l.resident.id)),
    [linhas, alvos]
  );

  const aGerar = selecionadas.filter((l) => l.estado !== 'assinada');
  const aAssinar = selecionadas.filter((l) => l.estado === 'preenchida');
  const aBaixar = selecionadas.filter((l) => l.estado !== 'vazia');
  const jaAssinadas = selecionadas.filter((l) => l.estado === 'assinada');

  const alternar = (id) =>
    setAlvos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  /* ---------------- Passo 1: gerar ---------------- */
  const gerar = async () => {
    setGerando(true);
    const { geradas, semDados, erros } = await gerarFichasDoMes({
      residents: aGerar.map((l) => l.resident),
      monthKey,
      reports,
      events,
      incidents,
      author: currentUser,
    });
    setGerando(false);

    if (erros.length > 0) {
      toast.error(`Falhou em ${erros.length} ficha(s): ${erros[0].mensagem}`);
    } else if (geradas === 0) {
      toast.warning('Nada a gerar: as fichas selecionadas já estão preenchidas ou não têm registro no período.');
    } else {
      toast.success(
        `${geradas === 1 ? '1 ficha preenchida' : `${geradas} fichas preenchidas`} em ${mes}. ` +
        'O texto escrito à mão foi mantido — revise antes de assinar.'
      );
    }

    if (semDados.length > 0) {
      toast.warning(
        `Sem registros no período para ${semDados.join(', ')} — essas fichas seguem para preenchimento à mão.`
      );
    }

    await carregar();
    onDone?.();
  };

  /* ---------------- Passo 2: assinar ---------------- */
  const assinarTudo = async (assinatura) => {
    setAssinando(true);
    const { ok, erros } = await assinarFichasDoMes({
      fichas: aAssinar.map((l) => l.row),
      assinatura,
    });
    setAssinando(false);
    setSignOpen(false);

    if (erros.length > 0) {
      toast.error(`Falhou em ${erros.length} ficha(s): ${erros[0].mensagem}`);
    } else {
      toast.success(
        `${ok === 1 ? '1 ficha assinada' : `${ok} fichas assinadas`} em nome de ${assinatura.signed_by_name}.`
      );
    }

    await carregar();
    onDone?.();
  };

  /* ---------------- Passo 3: baixar ---------------- */
  const baixar = () => {
    if (aBaixar.length === 0) {
      toast.warning('Nenhuma ficha preenchida para imprimir.');
      return;
    }
    setImprimindo(aBaixar.map(({ resident, row }) => ({ resident, row })));
  };

  const semAssinaturaNoPdf = aBaixar.filter((l) => l.estado !== 'assinada').length;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Fechar o mês"
        description={`Fichas de ${mes} — gerar, assinar e baixar de uma vez.`}
        size="lg"
        footer={<Button variant="secondary" onClick={onClose}>Fechar</Button>}
      >
        {carregando ? (
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
                    {resident.name} ·  {ESTADO[estado].texto}
                  </button>
                ))}
              </div>
              <span className="field__hint" style={{ display: 'block', marginTop: 'var(--space-2)' }}>
                {selecionadas.length} de {linhas.length} selecionados
                {jaAssinadas.length > 0 &&
                  ` · ${jaAssinadas.length} já assinada(s), que o fechamento não altera`}
              </span>
            </div>

            <div className="u-stack u-gap-3">
              <Passo
                numero={1}
                titulo="Gerar as fichas"
                descricao="Preenche as seções vazias com o que está registrado no período: agenda, plantões, intercorrências e o cadastro do morador. O que já foi escrito permanece intacto."
                feito={aGerar.length === 0 && selecionadas.length > 0}
              >
                <div>
                  <Button
                    variant="primary" size="sm" icon={Sparkles}
                    onClick={gerar} loading={gerando}
                    disabled={aGerar.length === 0}
                  >
                    Gerar {aGerar.length > 0 && `(${aGerar.length})`}
                  </Button>
                </div>
              </Passo>

              <Passo
                numero={2}
                titulo="Assinar as fichas"
                descricao="Uma confirmação de senha assina todas as marcadas, com a mesma data, hora, IP e aparelho. Ficha assinada não pode mais ser editada."
                feito={aAssinar.length === 0 && jaAssinadas.length > 0}
              >
                <div className="u-stack u-gap-3">
                  <Alert tone="warning">
                    Leia as fichas antes. Assinar é declarar que o conteúdo é seu:
                    o lote poupa repetir a senha, não a leitura de cada prontuário.
                  </Alert>
                  <div>
                    <Button
                      variant="primary" size="sm" icon={PenLine}
                      onClick={() => setSignOpen(true)}
                      disabled={aAssinar.length === 0}
                    >
                      Assinar {aAssinar.length > 0 && `(${aAssinar.length})`}
                    </Button>
                  </div>
                </div>
              </Passo>

              <Passo
                numero={3}
                titulo="Baixar tudo em PDF"
                descricao="Abre a impressão com todas as fichas do mês, uma por página. Escolha “Salvar como PDF” no destino para guardar o mês inteiro num arquivo só."
              >
                <div className="u-stack u-gap-3">
                  {semAssinaturaNoPdf > 0 && (
                    <Alert tone="info">
                      {semAssinaturaNoPdf === 1
                        ? '1 ficha ainda não assinada sai'
                        : `${semAssinaturaNoPdf} fichas ainda não assinadas saem`}{' '}
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

            {jaAssinadas.length > 0 && (
              <div className="u-row u-gap-2 u-wrap">
                <Badge tone="success" icon={Lock}>
                  {jaAssinadas.length === 1
                    ? '1 ficha assinada permanece como está'
                    : `${jaAssinadas.length} fichas assinadas permanecem como estão`}
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
        title={`Assinar ${aAssinar.length} ficha(s)`}
        description={`Fichas de ${mes}.`}
      >
        <Alert tone="warning" title="A assinatura vale para todas as fichas marcadas">
          {aAssinar.map((l) => l.resident.name).join(', ')}.
          {' '}Depois de assinadas, o conteúdo não pode mais ser alterado.
        </Alert>
        {assinando && <span className="u-muted">Gravando as assinaturas…</span>}
      </SignatureModal>

      {imprimindo && (
        <MonthSheetsPrint
          fichas={imprimindo}
          monthKey={monthKey}
          currentUser={currentUser}
          onDone={() => setImprimindo(null)}
        />
      )}
    </>
  );
}
