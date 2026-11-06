import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDate } from '../../lib/format';
import { formatarReais } from '../../lib/ledger';
import { assinarFotos, BUCKET_COMPROVANTES } from '../../lib/photos';
import FundsDocument from './FundsDocument';
import { aguardarImagens } from './MonthSheetsPrint';

/**
 * Impressão do relatório de recursos e dos comprovantes.
 *
 * Usa o mesmo mecanismo da impressão em lote das fichas: o bloco é
 * montado fora do #root, `is-batch-print` esconde a aplicação do papel e
 * o destino "Salvar como PDF" gera um arquivo só.
 *
 * modo 'relatorio'     → o relatório (uma página).
 * modo 'comprovantes'  → uma página por nota fiscal, na ordem da tabela,
 *                        identificada pelo item, e por fim o extrato.
 *
 * As fotos estão em bucket privado: as URLs assinadas são geradas aqui,
 * antes de montar as páginas.
 */
/**
 * Páginas de comprovantes de um morador: uma por nota, na ordem da
 * tabela, e por fim o extrato. Já traz as URLs assinadas (bucket privado).
 */
export async function montarPaginasDeComprovantes({ relatorio, extrato }) {
  const itens = relatorio.linhas.filter((l) => l.receipts.length > 0);
  const todas = [
    ...itens.flatMap((l) => l.receipts.map((r) => ({ ...r, chave: `${l.id}:${r.path}` }))),
    ...extrato.map((r) => ({ ...r, chave: `extrato:${r.path}` })),
  ];
  if (!todas.length) return [];
  const assinadas = await assinarFotos(todas, BUCKET_COMPROVANTES);
  const urlDe = (chave) => assinadas.find((a) => a.chave === chave)?.url;

  return [
    ...itens.flatMap((l) => l.receipts.map((r) => ({
      titulo: `Item ${l.item} · ${formatDate(l.entry_date)}`,
      legenda: `${l.description} — ${formatarReais(l.cents)}`,
      url: urlDe(`${l.id}:${r.path}`),
    }))),
    ...extrato.map((r, i) => ({
      titulo: `Extrato bancário${extrato.length > 1 ? ` (${i + 1}/${extrato.length})` : ''}`,
      legenda: `Saldo final conforme o extrato`,
      url: urlDe(`extrato:${r.path}`),
    })),
  ];
}

/** Uma página de comprovante, identificada pelo morador e pelo item. */
export function PaginaDeComprovante({ resident, pagina }) {
  return (
    <section className="funds-receipt-page">
      <header>
        <div className="funds-receipt-page__who">{resident.name}</div>
        <h2>{pagina.titulo}</h2>
        <p>{pagina.legenda}</p>
      </header>
      {pagina.url ? <img src={pagina.url} alt={pagina.titulo} /> : <p>Imagem indisponível.</p>}
    </section>
  );
}

export default function FundsPrint({
  modo, resident, monthKey, relatorio, assinatura, extrato, onDone,
}) {
  const ref = useRef(null);
  const [paginas, setPaginas] = useState(null);

  // 1. Assina as URLs de todos os comprovantes.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (modo !== 'comprovantes') { setPaginas([]); return; }
      const lista = await montarPaginasDeComprovantes({ relatorio, extrato });
      if (!cancelado) setPaginas(lista);
    })();
    return () => { cancelado = true; };
    // Montado uma vez por impressão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Com as páginas montadas, espera as imagens e imprime.
  useEffect(() => {
    if (!paginas) return undefined;
    let encerrado = false;
    const concluir = () => {
      if (encerrado) return;
      encerrado = true;
      onDone?.();
    };

    document.body.classList.add('is-batch-print');

    (async () => {
      const esperadas = (modo === 'relatorio' ? 1 : 0) + paginas.filter((p) => p.url).length; // logo + notas
      await aguardarImagens(ref.current, esperadas);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginas]);

  if (!paginas) return null;

  return createPortal(
    <div className="sheet-batch" ref={ref} aria-hidden="true">
      {modo === 'relatorio' && (
        <FundsDocument
          resident={resident}
          monthKey={monthKey}
          relatorio={relatorio}
          assinatura={assinatura}
        />
      )}

      {paginas.map((p, i) => (
        <PaginaDeComprovante key={`${p.titulo}-${i}`} resident={resident} pagina={p} />
      ))}
    </div>,
    document.body
  );
}
