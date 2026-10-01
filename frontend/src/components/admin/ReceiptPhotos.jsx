import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import {
  BUCKET_COMPROVANTES, assinarFotos, enviarFoto, removerFoto,
} from '../../lib/photos';
import { Button, useToast } from '../ui';

/**
 * Fotos de comprovantes (nota fiscal, extrato impresso).
 *
 * O botão abre direto a câmera do celular (`capture`). Em computador, o
 * mesmo botão abre o seletor de arquivos. A imagem é reduzida no
 * aparelho antes do envio, como nas fotos da ficha.
 *
 * `onChange` recebe a lista nova inteira; quem usa decide quando gravar.
 */
export default function ReceiptPhotos({
  photos, onChange, residentId, monthKey, label = 'Fotografar nota', readOnly = false,
}) {
  const toast = useToast();
  const input = useRef(null);
  const [comUrl, setComUrl] = useState([]);
  const [enviando, setEnviando] = useState(false);

  const assinar = useCallback(async () => {
    setComUrl(await assinarFotos(photos, BUCKET_COMPROVANTES));
  }, [photos]);

  useEffect(() => { assinar(); }, [assinar]);

  const adicionar = async (event) => {
    const arquivos = Array.from(event.target.files || []);
    event.target.value = '';
    if (arquivos.length === 0) return;

    setEnviando(true);
    const novas = [];
    for (const arquivo of arquivos) {
      const { foto, error } = await enviarFoto(arquivo, {
        residentId, monthKey, bucket: BUCKET_COMPROVANTES,
      });
      if (error) toast.error(`Não foi possível enviar a foto: ${error.message}`);
      else novas.push({ path: foto.path, uploaded_at: foto.uploaded_at });
    }
    setEnviando(false);

    if (novas.length > 0) onChange([...(photos || []), ...novas]);
  };

  const remover = async (foto) => {
    await removerFoto(foto.path, BUCKET_COMPROVANTES);
    onChange((photos || []).filter((p) => p.path !== foto.path));
  };

  return (
    <div className="receipts">
      {comUrl.map((foto) => (
        <div className="receipts__item" key={foto.path}>
          {foto.url ? (
            <a href={foto.url} target="_blank" rel="noreferrer">
              <img src={foto.url} alt="Comprovante" />
            </a>
          ) : (
            <span className="u-subtle">Indisponível</span>
          )}
          {!readOnly && (
            <button
              type="button"
              className="receipts__remove"
              onClick={() => remover(foto)}
              aria-label="Remover foto"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}

      {!readOnly && (
        <Button
          variant="secondary"
          icon={Camera}
          loading={enviando}
          onClick={() => input.current?.click()}
        >
          {(photos || []).length > 0 ? 'Adicionar outra' : label}
        </Button>
      )}

      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={adicionar}
      />
    </div>
  );
}
