-- ============================================================
-- AUREAN RT — Fotos anexadas à ficha mensal
--
-- Fotografia de morador é dado sensível: identifica a pessoa e revela
-- que ela está em tratamento de saúde mental. Por isso o bucket nasce
-- PRIVADO — o arquivo só é acessível por URL assinada, com validade
-- curta, gerada no momento em que a ficha é aberta. Um bucket público
-- deixaria as imagens acessíveis a qualquer um que descobrisse o
-- endereço, para sempre.
--
-- O limite de 3 MB por arquivo é folgado: a aplicação reduz a imagem
-- no próprio aparelho antes de enviar, e o limite serve como rede de
-- proteção contra envio acidental de arquivo grande.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ficha-fotos',
  'ficha-fotos',
  false,
  3145728,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Caminho e legenda de cada foto ficam na própria ficha.
ALTER TABLE "MonthlyReport"
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN "MonthlyReport".photos IS
  'Fotos da ficha: [{ path, caption, uploaded_at }] — o arquivo vive no bucket ficha-fotos';

-- ------------------------------------------------------------
-- ATENÇÃO — SEGURANÇA
-- O bucket é privado, mas as políticas de acesso do storage seguem
-- abertas enquanto o RLS não for habilitado: qualquer portador da
-- chave anônima consegue gerar URL assinada. Fechar isso faz parte da
-- etapa de autenticação.
-- ------------------------------------------------------------
