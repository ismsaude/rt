import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import {
  assinarFotos, enviarFoto, formatarTamanho, removerFoto,
} from '../../lib/photos';
import { useConfirm, useToast } from '../ui';

/**
 * Fotos anexadas à ficha.
 *
 * Quando não há foto alguma, nada é renderizado — nem título, nem
 * moldura: o documento impresso segue como se a seção não existisse.
 * O botão de adicionar só aparece na tela.
 */
export default function SheetPhotos({ photos, onChange, residentId, monthKey }) {
  const toast = useToast();
  const confirm = useConfirm();
  const input = useRef(null);

  const [comUrl, setComUrl] = useState([]);
  const [enviando, setEnviando] = useState(false);

  const assinar = useCallback(async () => {
    setComUrl(await assinarFotos(photos));
  }, [photos]);

  useEffect(() => { assinar(); }, [assinar]);

  const adicionar = async (event) => {
    const arquivos = Array.from(event.target.files || []);
    event.target.value = '';
    if (arquivos.length === 0) return;

    setEnviando(true);
    const novas = [];
    let economia = 0;

    for (const arquivo of arquivos) {
      const { foto, error, reducao } = await enviarFoto(arquivo, { residentId, monthKey });
      if (error) {
        toast.error(`Não foi possível enviar ${arquivo.name}: ${error.message}`);
        continue;
      }
      novas.push(foto);
      economia += reducao.de - reducao.para;
    }

    setEnviando(false);

    if (novas.length > 0) {
      onChange([...(photos || []), ...novas]);
      toast.success(
        `${novas.length === 1 ? '1 foto anexada' : `${novas.length} fotos anexadas`}. ` +
        `Reduzidas em ${formatarTamanho(economia)} antes do envio.`
      );
    }
  };

  const remover = async (foto) => {
    const ok = await confirm({
      title: 'Remover foto',
      message: 'A imagem será apagada e sai da ficha.',
      confirmLabel: 'Remover',
    });
    if (!ok) return;

    await removerFoto(foto.path);
    onChange((photos || []).filter((p) => p.path !== foto.path));
  };

  const legendar = (path, caption) =>
    onChange((photos || []).map((p) => (p.path === path ? { ...p, caption } : p)));

  const total = (photos || []).length;
  const vazia = total === 0;

  // Todas as fotos dividem uma única linha, com a mesma largura: duas
  // ocupam metade cada, seis ocupam um sexto. Uma foto sozinha fica em
  // meia largura, para não dominar a página.
  const porLinha = Math.max(total, 2);

  return (
    <section className="sheet__section">
      {!vazia && <h2 className="sheet__section-title">REGISTRO FOTOGRÁFICO</h2>}

      <div className="sheet__photos" style={{ '--fotos-por-linha': porLinha }}>
        {comUrl.map((foto) => (
          <figure className="sheet__photo" key={foto.path}>
            <div className="sheet__photo-frame">
              {foto.url ? (
                <img src={foto.url} alt={foto.caption || 'Registro fotográfico'} />
              ) : (
                <div className="u-row" style={{ height: '100%', justifyContent: 'center' }}>
                  <span className="u-subtle" style={{ fontSize: 'var(--text-xs)' }}>
                    Imagem indisponível
                  </span>
                </div>
              )}
              <button
                type="button"
                className="sheet__photo-remove print-hide"
                onClick={() => remover(foto)}
                aria-label="Remover foto"
              >
                <X size={15} />
              </button>
            </div>

            <figcaption>
              <input
                className="sheet__photo-caption-input"
                placeholder="Legenda (opcional)"
                value={foto.caption || ''}
                onChange={(e) => legendar(foto.path, e.target.value)}
                aria-label="Legenda da foto"
              />
            </figcaption>
          </figure>
        ))}

        <button
          type="button"
          className="sheet__photo-upload print-hide"
          onClick={() => input.current?.click()}
          disabled={enviando}
        >
          <ImagePlus size={22} aria-hidden="true" />
          {enviando ? 'Enviando…' : vazia ? 'Anexar fotos' : 'Adicionar mais'}
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>
            reduzidas automaticamente
          </span>
        </button>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={adicionar}
      />
    </section>
  );
}
