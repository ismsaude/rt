import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Paperclip, X } from 'lucide-react';
import {
  BUCKET_COMPROVANTES, assinarFotos, enviarArquivo, removerFoto,
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
  const camera = useRef(null);
  const pickFile = useRef(null);
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
      const { fotos, aviso, error } = await enviarArquivo(arquivo, {
        residentId, monthKey, bucket: BUCKET_COMPROVANTES,
      });
      if (error) toast.error(`Não foi possível enviar ${arquivo.name || 'o arquivo'}: ${error.message}`);
      else {
        fotos.forEach((f) => novas.push({ path: f.path, uploaded_at: f.uploaded_at }));
        if (aviso) toast.info(aviso);
      }
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
        <>
          <Button
            variant="secondary"
            icon={Camera}
            loading={enviando}
            onClick={() => camera.current?.click()}
          >
            {(photos || []).length > 0 ? 'Fotografar outra' : label}
          </Button>
          <Button
            variant="secondary"
            icon={Paperclip}
            loading={enviando}
            onClick={() => pickFile.current?.click()}
          >
            Imagem ou PDF
          </Button>
        </>
      )}

      {/* Câmera: no celular `capture` abre direto a câmera, sem opção de arquivo. */}
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={adicionar}
      />
      <input
        ref={pickFile}
        type="file"
        accept="image/*,application/pdf,.pdf"
        multiple
        style={{ display: 'none' }}
        onChange={adicionar}
      />
    </div>
  );
}
