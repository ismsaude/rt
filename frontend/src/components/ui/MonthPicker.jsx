import { MESES, parseMonthKey } from '../../lib/format';

/**
 * Seleção livre de mês e ano.
 *
 * Substitui a lista fechada de "meses que têm plantão": a supervisão
 * precisa emitir fichas de períodos antigos, inclusive de meses sem
 * registro algum. Meses que possuem dados ficam marcados, para ajudar
 * sem restringir.
 *
 * @param {string}   value        'YYYY-MM'
 * @param {Function} onChange     recebe 'YYYY-MM'
 * @param {string[]} [withData]   chaves que possuem registros
 * @param {string}   [selectClassName] para embutir no layout da ficha
 */
export default function MonthPicker({
  value,
  onChange,
  withData = [],
  selectClassName = 'select',
  yearsBack = 6,
  yearsForward = 1,
  ariaLabelMonth = 'Mês',
  ariaLabelYear = 'Ano',
}) {
  const { year, month } = parseMonthKey(value);
  const atual = new Date().getFullYear();

  const anos = [];
  for (let y = atual + yearsForward; y >= atual - yearsBack; y -= 1) anos.push(y);
  // Garante que um ano fora do intervalo (ficha antiga) continue listado.
  if (!anos.includes(year)) anos.push(year);
  anos.sort((a, b) => b - a);

  const emitir = (novoMes, novoAno) =>
    onChange(`${novoAno}-${String(novoMes + 1).padStart(2, '0')}`);

  const temDados = (m, y) => withData.includes(`${y}-${String(m + 1).padStart(2, '0')}`);

  return (
    <span className="u-row u-gap-2" style={{ flexWrap: 'wrap' }}>
      <select
        className={selectClassName}
        style={{ width: 'auto' }}
        value={month}
        aria-label={ariaLabelMonth}
        onChange={(e) => emitir(Number(e.target.value), year)}
      >
        {MESES.map((nome, idx) => (
          <option key={nome} value={idx}>
            {nome}
            {temDados(idx, year) ? ' •' : ''}
          </option>
        ))}
      </select>

      <select
        className={selectClassName}
        style={{ width: 'auto' }}
        value={year}
        aria-label={ariaLabelYear}
        onChange={(e) => emitir(month, Number(e.target.value))}
      >
        {anos.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </span>
  );
}
