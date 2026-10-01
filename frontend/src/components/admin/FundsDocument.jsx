import { formatDate, MESES } from '../../lib/format';
import { formatarReais } from '../../lib/ledger';
import { Signature } from '../ui';

const CIDADE = 'Porto Feliz';

/** "11 de setembro de 2026" */
function porExtenso(dataISO) {
  const [y, m, d] = String(dataISO).split('-').map(Number);
  return `${d} de ${MESES[m - 1].toLowerCase()} de ${y}`;
}

/**
 * RELATÓRIO MENSAL — RECURSOS DE BENEFÍCIOS DO MORADOR.
 *
 * Réplica do modelo que a supervisão entrega à Secretaria de Saúde:
 * cabeçalho do morador, tabela da conta com saldo corrente, saldo final,
 * nota de encaminhamento e assinatura. O que se vê na tela é o que sai
 * no papel.
 *
 * `relatorio` vem de `montarRelatorio()`; `assinatura` é o LedgerMonth
 * fechado (ou null, quando o mês ainda está aberto).
 */
export default function FundsDocument({ resident, monthKey, relatorio, assinatura, emitidoEm }) {
  if (!resident) return null;

  const [year, month] = monthKey.split('-').map(Number);
  const periodo = `${MESES[month - 1].toUpperCase()}/${year}`;
  const emissao = emitidoEm || assinatura?.signed_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);

  return (
    <article className="funds-doc">
      <div className="funds-doc__top">
        <h1 className="funds-doc__title">
          RELATÓRIO MENSAL
          <br />
          RECURSOS DE BENEFÍCIOS DO MORADOR
        </h1>
        <img src="/logo.png" alt="Aurean Residência Terapêutica" className="funds-doc__logo" />
      </div>

      <div className="funds-doc__meta">
        <div className="funds-doc__meta-row">
          <span>NOME: {resident.name}</span>
          <span>{periodo}</span>
        </div>
        <div className="funds-doc__meta-row">
          <span>ENDEREÇO: {resident.address || '—'}</span>
        </div>
        <div className="funds-doc__meta-row">
          <span>DATA DE NASCIMENTO: {formatDate(resident.dateOfBirth)}</span>
          <span>CPF: {resident.cpf || '—'}</span>
        </div>
      </div>

      <table className="funds-doc__table">
        <thead>
          <tr><th colSpan={7} className="funds-doc__caption">EXTRATO MOVIMENTAÇÃO NO MÊS</th></tr>
          <tr>
            <th>ITEM</th>
            <th>DATA</th>
            <th>DESCRIÇÃO</th>
            <th>ENTRADA</th>
            <th>SAÍDA</th>
            <th>OBS</th>
            <th>SALDO</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="c">1</td>
            <td className="c">{`01/${String(month).padStart(2, '0')}/${year}`}</td>
            <td>Saldo inicial</td>
            <td /><td /><td />
            <td className="r">{formatarReais(relatorio.inicial.centavos)}</td>
          </tr>
          {relatorio.linhas.map((l) => (
            <tr key={l.id}>
              <td className="c">{l.item}</td>
              <td className="c">{formatDate(l.entry_date)}</td>
              <td>{l.description}</td>
              <td className="r">{l.kind === 'entrada' ? formatarReais(l.cents) : ''}</td>
              <td className="r">{l.kind === 'saida' ? formatarReais(l.cents) : ''}</td>
              <td>{l.obs || ''}</td>
              <td className="r">{formatarReais(l.saldo)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="funds-doc__total">
        <tbody>
          <tr>
            <td>SALDO AO FINAL DO MÊS</td>
            <td>{formatarReais(relatorio.final)}</td>
          </tr>
        </tbody>
      </table>

      <p className="funds-doc__note">
        Deverá ser elaborado em 02 vias, e encaminhado à Secretaria de Saúde com cópia dos
        comprovantes de despesa/pagamento, e extrato bancário do morador, a outra via arquivada
        pela Contratada.
      </p>

      <p className="funds-doc__date">{CIDADE}, {porExtenso(emissao)}.</p>

      <div className="funds-doc__signature">
        {assinatura?.signed_by_name ? (
          <Signature assinatura={assinatura} align="left" />
        ) : (
          <>
            <div className="funds-doc__signature-line" />
            <div className="print-hide u-subtle" style={{ fontSize: 'var(--text-xs)' }}>
              Mês em aberto — o relatório é assinado ao fechar o mês.
            </div>
          </>
        )}
      </div>
    </article>
  );
}
