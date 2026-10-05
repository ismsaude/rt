import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ScheduleDocument from './ScheduleDocument';
import { aguardarImagens } from './MonthSheetsPrint';

/**
 * Escala do mês em papel (A4 retrato, vira PDF em "Salvar como PDF").
 *
 * Mesma grade da tela, sem os controles de ajuste. Usa o mecanismo da
 * impressão em lote: o bloco é montado fora do #root enquanto imprime.
 */
export default function SchedulePrint({
  monthKey, entradas, feriados, todosNomes, fechamento, responsavel, onDone,
}) {
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
      await aguardarImagens(ref.current, 1); // a logo
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
      <ScheduleDocument
        monthKey={monthKey} entradas={entradas} feriados={feriados} todosNomes={todosNomes}
        fechamento={fechamento} responsavel={responsavel}
      />
    </div>,
    document.body
  );
}
