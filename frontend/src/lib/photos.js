/**
 * Fotos da ficha mensal.
 *
 * As imagens vêm de celular, onde uma foto tem de 2 a 5 MB. Enviar o
 * arquivo original desperdiça a franquia de dados da cuidadora, demora
 * no 4G da casa e ocupa armazenamento sem ganho: na ficha impressa a
 * foto ocupa meia largura de página. Por isso a imagem é reduzida no
 * próprio aparelho antes do envio.
 *
 * O bucket é privado. O acesso se dá por URL assinada de validade
 * curta, gerada quando a ficha é aberta.
 */

import { supabase } from './supabase';
import { uid } from './id';

const BUCKET = 'ficha-fotos';
export const BUCKET_COMPROVANTES = 'comprovantes';
const LADO_MAXIMO = 1400;   // suficiente para impressão em meia página
const QUALIDADE = 0.82;
const VALIDADE_URL = 60 * 60; // uma hora

/**
 * Reduz e recomprime a imagem no navegador.
 * Devolve o Blob pronto para envio.
 */
export async function prepararImagem(file) {
  const bitmap = await createImageBitmap(file);

  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close?.();

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALIDADE)
  );

  return { blob, largura, altura, tamanhoOriginal: file.size, tamanhoFinal: blob.size };
}

const MAX_PAGINAS_PDF = 10;
const LARGURA_PAGINA_PDF = 1400;

const ehPdf = (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');

/**
 * Converte um PDF em imagens das páginas, no próprio aparelho.
 *
 * Na impressão dos comprovantes cada nota ocupa uma página: imagem
 * imprime igual em qualquer navegador e reaproveita todo o resto (miniatura,
 * redução, envio). A biblioteca de PDF só é baixada quando alguém anexa um.
 */
async function pdfParaImagens(file) {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;

  // Uint8Array: a biblioteca não conclui a leitura se receber um ArrayBuffer cru.
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await Promise.race([
    pdfjs.getDocument({ data }).promise,
    new Promise((_, rejeitar) => { setTimeout(() => rejeitar(new Error('tempo esgotado')), 30000); }),
  ]);
  const total = Math.min(doc.numPages, MAX_PAGINAS_PDF);
  const blobs = [];

  for (let n = 1; n <= total; n += 1) {
    const pagina = await doc.getPage(n);
    const base = pagina.getViewport({ scale: 1 });
    const viewport = pagina.getViewport({ scale: LARGURA_PAGINA_PDF / base.width });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; // PDF tem fundo transparente; JPEG não
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pagina.render({ canvasContext: ctx, viewport }).promise;

    blobs.push(await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALIDADE)));
  }

  return { blobs, paginas: doc.numPages, enviadas: total };
}

/**
 * Envia um arquivo de comprovante: imagem ou PDF.
 * Um PDF vira uma foto por página (até 10).
 *
 * @returns {{ fotos?: Array, aviso?: string, error?: object }}
 */
export async function enviarArquivo(file, { residentId, monthKey, bucket = BUCKET }) {
  if (!ehPdf(file)) {
    const { foto, error } = await enviarFoto(file, { residentId, monthKey, bucket });
    return error ? { error } : { fotos: [foto] };
  }

  let convertido;
  try {
    convertido = await pdfParaImagens(file);
  } catch {
    return { error: { message: 'Não foi possível ler este PDF.' } };
  }

  const fotos = [];
  for (const blob of convertido.blobs) {
    const path = `${residentId}/${monthKey}/${uid()}.jpg`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) {
      await supabase.storage.from(bucket).remove(fotos.map((f) => f.path));
      return { error };
    }
    fotos.push({ path, caption: '', uploaded_at: new Date().toISOString() });
  }

  return {
    fotos,
    aviso: convertido.paginas > convertido.enviadas
      ? `O PDF tem ${convertido.paginas} páginas; as ${convertido.enviadas} primeiras foram anexadas.`
      : undefined,
  };
}

/**
 * Envia a foto e devolve o registro para guardar na ficha.
 * `bucket` permite reaproveitar o envio para outros anexos (ex.: notas fiscais).
 */
export async function enviarFoto(file, { residentId, monthKey, bucket = BUCKET }) {
  if (!file.type.startsWith('image/')) {
    return { error: { message: 'O arquivo precisa ser uma imagem.' } };
  }

  const { blob, tamanhoOriginal, tamanhoFinal } = await prepararImagem(file);
  const path = `${residentId}/${monthKey}/${uid()}.jpg`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });

  if (error) return { error };

  return {
    foto: { path, caption: '', uploaded_at: new Date().toISOString() },
    reducao: { de: tamanhoOriginal, para: tamanhoFinal },
  };
}

/** URLs assinadas para exibir as fotos de uma ficha. */
export async function assinarFotos(photos, bucket = BUCKET) {
  const lista = Array.isArray(photos) ? photos : [];
  if (lista.length === 0) return [];

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(lista.map((p) => p.path), VALIDADE_URL);

  if (error) return lista.map((p) => ({ ...p, url: null }));

  return lista.map((p) => ({
    ...p,
    url: data.find((d) => d.path === p.path)?.signedUrl || null,
  }));
}

/** Remove o arquivo do bucket. */
export async function removerFoto(path, bucket = BUCKET) {
  return supabase.storage.from(bucket).remove([path]);
}

export function formatarTamanho(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
