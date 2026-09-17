import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import SheetDocument from './SheetDocument';

/**
 * Todas as fichas do mês numa única impressão.
 *
 * O bloco é montado fora do #root e só existe enquanto a impressão está
 * sendo preparada: enquanto ele está no ar, `is-batch-print` esconde a
 * aplicação do papel, e cada ficha começa numa página nova. O destino
 * "Salvar como PDF" produz um arquivo só, com o mês inteiro — que é
 * como a pasta do mês é arquivada.
 *
 * Imprimir antes das imagens carregarem sai com moldura vazia, então a
 * chamada espera pela logo, pela marca d'água e pelas fotos de cada
 * ficha — com prazo, para não travar se o Storage não responder.
 */

const PRAZO_IMAGENS = 8000;
const PRAZO_MONTAGEM = 6000;

/** Espera as imagens aparecerem no DOM e terminarem de carregar. */
async function aguardarImagens(raiz, esperadas) {
  if (!raiz) return;

  const espera = (ms) => new Promise((r) => { setTimeout(r, ms); });
  const limite = Date.now() + PRAZO_MONTAGEM;

  // As fotos chegam depois: a URL assinada do Storage é assíncrona.
  while (raiz.querySelectorAll('img').length < esperadas && Date.now() < limite) {
    await espera(120);
  }

  const imagens = Array.from(raiz.querySelectorAll('img'));
  await Promise.race([
    Promise.all(
      imagens.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
            })
      )
    ),
    espera(PRAZO_IMAGENS),
  ]);

  if (document.fonts?.ready) await Promise.race([document.fonts.ready, espera(1500)]);
}

export default function MonthSheetsPrint({ fichas, monthKey, currentUser, onDone }) {
  const ref = useRef(null);

  useEffect(() => {
    let encerrado = false;

    const concluir = () => {
      if (encerrado) return;
      encerrado = true;
      onDone?.();
    };

    const esperadas = fichas.reduce(
      // Duas por ficha: a marca d'água e a logo do cabeçalho.
      (total, f) => total + 2 + (Array.isArray(f.row?.photos) ? f.row.photos.length : 0),
      0
    );

    document.body.classList.add('is-batch-print');

    const imprimir = async () => {
      await aguardarImagens(ref.current, esperadas);
      if (encerrado) return;

      // Navegadores que não bloqueiam em print() avisam pelo afterprint;
      // os que bloqueiam já voltaram daqui com o diálogo fechado.
      window.addEventListener('afterprint', concluir, { once: true });
      window.print();
      setTimeout(concluir, 800);
    };

    imprimir();

    return () => {
      encerrado = true;
      window.removeEventListener('afterprint', concluir);
      document.body.classList.remove('is-batch-print');
    };
    // Montado uma vez por impressão: a lista não muda no meio do caminho.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="sheet-batch" ref={ref} aria-hidden="true">
      {fichas.map(({ resident, row }) => (
        <SheetDocument
          key={resident.id}
          resident={resident}
          monthKey={monthKey}
          currentUser={currentUser}
          assinatura={row?.signed_by_name ? row : null}
          form={{
            emitido_em: row?.emitido_em || '',
            photos: Array.isArray(row?.photos) ? row.photos : [],
            observacoes: row?.observacoes || '',
            intervencoes: row?.intervencoes || '',
            comportamento: row?.comportamento || '',
            adesao: row?.adesao || '',
            autonomia_higiene: row?.autonomia_higiene || '',
            autonomia_alimentacao: row?.autonomia_alimentacao || '',
            autonomia_atividades: row?.autonomia_atividades || '',
            interacoes: row?.interacoes || '',
          }}
        />
      ))}
    </div>,
    document.body
  );
}
