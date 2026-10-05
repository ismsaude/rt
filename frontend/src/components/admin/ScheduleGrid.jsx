import {
  COLUNAS_SEMANA, DIA_SEMANA_CURTO, indexar, linhasDoMes, nomeCurto, rotuloHorario, semanasDoMes,
} from '../../lib/schedule';
import { toISODate } from '../../lib/format';

/**
 * Grade da escala do mês: uma tabela por semana (segunda a domingo),
 * uma linha por posto — o mesmo desenho da escala impressa.
 *
 * Serve à tela e ao papel. Com `onCellClick` as células viram botões de
 * ajuste; sem ele (impressão) são só texto.
 *
 * `feriados` é um Map data → nome.
 */
export default function ScheduleGrid({ monthKey, entradas, feriados, onCellClick, todosNomes = [] }) {
  const semanas = semanasDoMes(monthKey);
  const linhas = linhasDoMes(entradas);
  const idx = indexar(entradas);
  // Nome curto considera a equipe inteira: "Maria" é ambíguo se há duas Marias.
  const nomes = [...new Set([...todosNomes, ...entradas.map((e) => e.person_name).filter(Boolean)])];
  const hoje = toISODate(new Date());

  return (
    <div className="sched" data-weeks={semanas.length}>
      {semanas.map((semana, indice) => (
        <table className="sched__week" key={semana.find(Boolean)}>
          <thead>
            <tr>
              <th className="sched__corner">{indice + 1}ª semana</th>
              {semana.map((data, col) => {
                const feriado = data && feriados.get(data);
                return (
                  <th
                    key={col}
                    className={[
                      'sched__day',
                      !data && 'sched__day--out',
                      [5, 6].includes(col) && 'sched__day--weekend',
                      data === hoje && 'sched__day--today',
                      data && col > 0 && !semana[col - 1] && 'sched__day--after-out',
                    ].filter(Boolean).join(' ')}
                  >
                    {data && (
                      <>
                        <span className="sched__num">{Number(data.slice(8))}</span>
                        <span className="sched__dow">{DIA_SEMANA_CURTO[COLUNAS_SEMANA[col]]}</span>
                        {feriado && <span className="sched__holiday" title={feriado}>feriado</span>}
                      </>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.shift_id}>
                <th className="sched__label" data-cat={linha.category} data-turno={linha.noturno ? 'noite' : undefined}>
                  <span>{linha.name}</span>
                  {linha.hours && <small>{linha.hours}</small>}
                </th>

                {semana.map((data, col) => {
                  if (!data) return <td key={col} className="sched__cell sched__cell--out" />;

                  const e = idx.get(`${linha.shift_id}|${data}`);
                  let conteudo = null;
                  let tom = 'empty';

                  if (e?.kind === 'feriado') {
                    conteudo = <em>Feriado</em>;
                    tom = 'holiday';
                  } else if (e?.kind === 'folga') {
                    conteudo = <em>Folga</em>;
                    tom = 'off';
                  } else if (e?.kind === 'plantao') {
                    const horario = rotuloHorario(e.start_time, e.end_time);
                    conteudo = e.person_name ? (
                      <>
                        <span className="sched__person">{nomeCurto(e.person_name, nomes)}</span>
                        {horario && horario !== linha.hours && <small>{horario}</small>}
                        {e.note && <small className="sched__note">{e.note}</small>}
                      </>
                    ) : <span className="sched__gap">sem escala</span>;
                    tom = e.person_name ? 'on' : 'gap';
                  }

                  const classe = [
                    'sched__cell',
                    `sched__cell--${tom}`,
                    [5, 6].includes(col) && 'sched__cell--weekend',
                    linha.noturno && 'sched__cell--night',
                    col > 0 && !semana[col - 1] && 'sched__cell--after-out',
                    e?.manual && 'sched__cell--manual',
                  ].filter(Boolean).join(' ');

                  if (!onCellClick) return <td key={col} className={classe}>{conteudo}</td>;

                  return (
                    <td key={col} className={classe}>
                      <button
                        type="button"
                        className="sched__btn"
                        onClick={() => onCellClick(linha, data, e || null)}
                        aria-label={`${linha.name}, dia ${Number(data.slice(8))}`}
                      >
                        {conteudo}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}
