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

/** Envia a foto e devolve o registro para guardar na ficha. */
export async function enviarFoto(file, { residentId, monthKey }) {
  if (!file.type.startsWith('image/')) {
    return { error: { message: 'O arquivo precisa ser uma imagem.' } };
  }

  const { blob, tamanhoOriginal, tamanhoFinal } = await prepararImagem(file);
  const path = `${residentId}/${monthKey}/${uid()}.jpg`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });

  if (error) return { error };

  return {
    foto: { path, caption: '', uploaded_at: new Date().toISOString() },
    reducao: { de: tamanhoOriginal, para: tamanhoFinal },
  };
}

/** URLs assinadas para exibir as fotos de uma ficha. */
export async function assinarFotos(photos) {
  const lista = Array.isArray(photos) ? photos : [];
  if (lista.length === 0) return [];

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(lista.map((p) => p.path), VALIDADE_URL);

  if (error) return lista.map((p) => ({ ...p, url: null }));

  return lista.map((p) => ({
    ...p,
    url: data.find((d) => d.path === p.path)?.signedUrl || null,
  }));
}

/** Remove o arquivo do bucket. */
export async function removerFoto(path) {
  return supabase.storage.from(BUCKET).remove([path]);
}

export function formatarTamanho(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
