import { useMemo, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { formatarReais, novoLancamento, salvarLancamentos } from '../../lib/ledger';
import { lerPlanilha, marcarDuplicadas, primeiraDivergencia } from '../../lib/ledgerImport';
import { formatDate, formatMonthLabel } from '../../lib/format';
import { Alert, Badge, Button, Modal, Textarea, useToast } from '../ui';

/**
 * Importa os lançamentos da planilha da supervisão.
 *
 * Cola-se só a tabela de lançamentos; morador e mês vêm da tela. A prévia
 * mostra tudo antes de gravar, deixa ajustar a descrição e a observação,
 * e já marca o que não deve entrar: linha com problema, lançamento que já
 * existe, ou saldo que não bate com o da planilha.
 */
export default function ImportLedgerModal({
  open, onClose, residentId, monthKey, existentes, saldoSistema, author, onImported,
}) {
  const toast = useToast();
  const arquivo = useRef(null);
  const [texto, setTexto] = useState('');
  const [edicoes, setEdicoes] = useState({}); // n → { descricao, obs, fora }
  const [salvando, setSalvando] = useState(false);

  const fechar = () => { setTexto(''); setEdicoes({}); onClose(); };

  const lido = useMemo(() => {
    if (!texto.trim()) return null;
    const { linhas, saldoInicial, ignoradas } = lerPlanilha(texto);
    const marcadas = marcarDuplicadas(
      linhas.map((l) => ({ ...l, ...(edicoes[l.n] || {}) })),
      existentes
    );
    const abertura = saldoInicial ?? (saldoSistema.definido ? saldoSistema.centavos : null);
    return {
      linhas: marcadas,
      saldoInicial,
      ignoradas,
      divergencia: primeiraDivergencia(linhas, abertura),
    };
  }, [texto, edicoes, existentes, saldoSistema]);

  // Linha entra por padrão se estiver íntegra e não for duplicada; o usuário pode mudar.
  const entra = (l) => !l.problemas.length && (edicoes[l.n]?.entra ?? !l.duplicada);
  const alterar = (n, campos) => setEdicoes((e) => ({ ...e, [n]: { ...e[n], ...campos } }));

  const aImportar = lido?.linhas.filter(entra) || [];
  const totalEntradas = aImportar.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + l.cents, 0);
  const totalSaidas = aImportar.filter((l) => l.tipo === 'saida').reduce((s, l) => s + l.cents, 0);
  const duplicadas = lido?.linhas.filter((l) => l.duplicada).length || 0;
  const comProblema = lido?.linhas.filter((l) => l.problemas.length).length || 0;

  const lerArquivo = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) setTexto(await f.text());
  };

  const importar = async () => {
    setSalvando(true);
    const lista = aImportar.map((l) => ({
      ...novoLancamento({ residentId, dataISO: l.data, author }),
      description: l.descricao,
      kind: l.tipo,
      cents: l.cents,
      obs: l.obs,
    }));
    const { error } = await salvarLancamentos(lista);
    setSalvando(false);

    if (error) { toast.error(`Não foi possível importar: ${error.message}`); return; }

    toast.success(`${lista.length} lançamentos importados.`);
    const abertura = lido.saldoInicial;
    fechar();
    onImported({ saldoInicialPlanilha: abertura });
  };

  return (
    <Modal
      open={open}
      onClose={fechar}
      title="Importar planilha"
      description={`Os lançamentos entram na conta deste morador. Mês exibido: ${formatMonthLabel(monthKey)}.`}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={fechar}>Cancelar</Button>
          <Button
            variant="primary" icon={FileUp} onClick={importar} loading={salvando}
            disabled={aImportar.length === 0}
          >
            {aImportar.length ? `Importar ${aImportar.length} lançamentos` : 'Importar'}
          </Button>
        </>
      }
    >
      <div className="u-stack u-gap-4">
        <div className="u-stack u-gap-2">
          <span className="field__label">Cole as linhas da tabela</span>
          <Textarea
            rows={5}
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setEdicoes({}); }}
            placeholder={'Selecione na planilha as linhas de ITEM até SALDO, copie (Ctrl/Cmd+C) e cole aqui.'}
          />
          <div>
            <Button variant="ghost" size="sm" onClick={() => arquivo.current?.click()}>
              ou enviar arquivo CSV
            </Button>
            <input ref={arquivo} type="file" accept=".csv,.tsv,.txt,text/csv"
              style={{ display: 'none' }} onChange={lerArquivo} />
          </div>
        </div>

        {lido && lido.linhas.length === 0 && (
          <Alert tone="warning">
            Nenhuma linha com data (dd/mm/aaaa) foi encontrada. Confira se copiou as linhas da tabela.
          </Alert>
        )}

        {lido && lido.linhas.length > 0 && (
          <>
            {lido.saldoInicial != null && (
              <Alert tone={saldoSistema.definido && saldoSistema.centavos !== lido.saldoInicial ? 'warning' : 'info'}>
                Saldo inicial da planilha: <strong>{formatarReais(lido.saldoInicial)}</strong>.{' '}
                {!saldoSistema.definido && 'Será usado como saldo inicial deste mês.'}
                {saldoSistema.definido && saldoSistema.centavos === lido.saldoInicial && 'Confere com o saldo do sistema.'}
                {saldoSistema.definido && saldoSistema.centavos !== lido.saldoInicial &&
                  `O sistema tem ${formatarReais(saldoSistema.centavos)}. Nada será alterado: ajuste na conferência, se for o caso.`}
              </Alert>
            )}

            {lido.divergencia && (
              <Alert tone="danger" title="O saldo da planilha não bate com o recalculado">
                Na linha {lido.divergencia.n} a planilha mostra {formatarReais(lido.divergencia.planilha)} e a
                conta dá {formatarReais(lido.divergencia.calculado)}. Provável erro de digitação em
                valor, ou lançamento faltando, a partir dessa linha.
              </Alert>
            )}
            {lido.saldoInicial == null && !saldoSistema.definido && (
              <Alert tone="warning">
                A planilha não trouxe a linha «Saldo inicial» e o sistema ainda não tem um para este mês.
                Informe na conferência depois de importar.
              </Alert>
            )}

            <div className="u-row u-gap-2" style={{ flexWrap: 'wrap' }}>
              <Badge tone="primary">{aImportar.length} a importar</Badge>
              <Badge tone="success">{formatarReais(totalEntradas)} em entradas</Badge>
              <Badge tone="danger">{formatarReais(totalSaidas)} em saídas</Badge>
              {duplicadas > 0 && <Badge tone="warning">{duplicadas} já lançadas</Badge>}
              {comProblema > 0 && <Badge tone="danger">{comProblema} com problema</Badge>}
              {lido.ignoradas > 0 && <Badge tone="neutral">{lido.ignoradas} linhas ignoradas (sem data)</Badge>}
            </div>

            <div className="table-wrap">
              <table className="table" style={{ minWidth: 980 }}>
                <thead>
                  <tr>
                    <th aria-label="Importar" />
                    <th>Data</th>
                    <th>Descrição</th>
                    <th style={{ textAlign: 'right' }}>Entrada</th>
                    <th style={{ textAlign: 'right' }}>Saída</th>
                    <th>Obs</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {lido.linhas.map((l) => (
                    <tr key={l.n} style={!entra(l) ? { opacity: 0.55 } : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          checked={entra(l)}
                          disabled={l.problemas.length > 0}
                          onChange={(e) => alterar(l.n, { entra: e.target.checked })}
                          aria-label={`Importar linha ${l.n}`}
                        />
                      </td>
                      <td className="table__cell-num">{l.data ? formatDate(l.data) : '—'}</td>
                      <td>
                        <input
                          className="input" style={{ minWidth: 360 }}
                          value={l.descricao}
                          onChange={(e) => alterar(l.n, { descricao: e.target.value })}
                        />
                      </td>
                      <td className="table__cell-num" style={{ textAlign: 'right' }}>
                        {l.tipo === 'entrada' ? formatarReais(l.cents) : ''}
                      </td>
                      <td className="table__cell-num" style={{ textAlign: 'right' }}>
                        {l.tipo === 'saida' ? formatarReais(l.cents) : ''}
                      </td>
                      <td>
                        <input
                          className="input" style={{ minWidth: 110 }}
                          value={l.obs}
                          onChange={(e) => alterar(l.n, { obs: e.target.value })}
                        />
                      </td>
                      <td>
                        {l.problemas.length > 0 && <Badge tone="danger">{l.problemas.join(', ')}</Badge>}
                        {l.duplicada && <Badge tone="warning">já lançada</Badge>}
                        {!l.problemas.length && !l.duplicada && <Badge tone="success">nova</Badge>}
                        {l.data && l.data.slice(0, 7) !== monthKey && (
                          <Badge tone="info" className="u-ml-2">{formatMonthLabel(l.data.slice(0, 7))}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
