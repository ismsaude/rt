import { formatDate, formatMonthLabel, toISODate } from '../../lib/format';
import { Signature } from '../ui';
import ScheduleGrid from './ScheduleGrid';

/**
 * A escala do mês como documento.
 *
 * Sem assinatura é a ESCALA DE TRABALHO (o previsto), com espaço para a
 * supervisora assinar à mão e datar. Assinada, o título passa a ser
 * ESCALA EXECUTADA e a assinatura eletrônica ocupa o lugar do espaço.
 *
 * `fechamento` é o registro do mês assinado (ScheduleMonth) ou null.
 * `responsavel` { name, role, council } é quem assina a escala impressa.
 */
export default function ScheduleDocument({
  monthKey, entradas, feriados, todosNomes, fechamento, responsavel,
}) {
  const executada = !!fechamento?.signed_by_name;
  const lista = [...feriados.entries()].filter(([d]) => d.startsWith(monthKey));

  return (
    <article className="schedule-doc">
      <div className="schedule-doc__top">
        <div>
          <h1 className="schedule-doc__title">
            {executada ? 'ESCALA EXECUTADA' : 'ESCALA DE TRABALHO'}
          </h1>
          <div className="schedule-doc__sub">{formatMonthLabel(monthKey)} · Residência Terapêutica</div>
        </div>
        <img src="/logo.png" alt="Aurean Residência Terapêutica" className="schedule-doc__logo" />
      </div>

      <ScheduleGrid monthKey={monthKey} entradas={entradas} feriados={feriados} todosNomes={todosNomes} />

      <div className="schedule-doc__bottom">
        <div className="schedule-doc__sign">
          {executada ? (
            <Signature assinatura={fechamento} align="left" />
          ) : (
            <>
              <div className="schedule-doc__line" />
              <div className="schedule-doc__sign-name">{responsavel?.name || 'Supervisão'}</div>
              <div className="schedule-doc__sign-role">
                {[responsavel?.role, responsavel?.council].filter(Boolean).join(' · ')}
              </div>
            </>
          )}
        </div>

        <div className="schedule-doc__date">
          {executada
            ? <>Data: {formatDate(String(fechamento.signed_at).slice(0, 10))}</>
            : <>Data: ____ / ____ / ________</>}
        </div>
      </div>

      <div className="schedule-doc__foot">
        <span>
          {lista.length > 0 && `Feriados: ${lista.map(([d, n]) => `${formatDate(d).slice(0, 5)} ${n}`).join(' · ')}. `}
          Nos feriados trabalham apenas os plantões 12x36.
        </span>
        <span>Emitida em {formatDate(toISODate(new Date()))}</span>
      </div>
    </article>
  );
}
