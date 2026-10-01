-- ============================================================
-- AUREAN RT — Recursos de benefícios do morador
--
-- Livro-caixa da conta bancária de cada morador. Cada compra,
-- saque, tarifa ou rendimento vira uma linha; o relatório mensal
-- é a leitura dessas linhas, com o saldo calculado a cada uma.
--
-- O saldo de cada linha NUNCA é gravado: é recalculado na leitura.
-- Assim, corrigir ou apagar um lançamento não deixa saldo errado
-- para trás.
--
-- Executar com:
--   npx prisma db execute --file supabase/migrations/014_recursos_morador.sql \
--     --schema prisma/schema.prisma
-- ============================================================

-- ------------------------------------------------------------
-- 1. Endereço do morador — consta no cabeçalho do relatório
-- ------------------------------------------------------------
ALTER TABLE "Resident"
  ADD COLUMN IF NOT EXISTS address TEXT;

-- ------------------------------------------------------------
-- 2. Lançamentos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ResidentLedger" (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resident_id   TEXT NOT NULL,
    entry_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    description   TEXT NOT NULL,
    kind          TEXT NOT NULL CHECK (kind IN ('entrada', 'saida')),
    amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    obs           TEXT,
    receipts      JSONB DEFAULT '[]'::jsonb,   -- [{ path, uploaded_at }]
    author_name   TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS resident_ledger_resident_date_idx
    ON "ResidentLedger" (resident_id, entry_date, created_at);

COMMENT ON TABLE  "ResidentLedger"          IS 'Livro-caixa da conta do morador';
COMMENT ON COLUMN "ResidentLedger".kind     IS 'entrada | saida — o valor é sempre positivo';
COMMENT ON COLUMN "ResidentLedger".receipts IS 'Fotos de notas fiscais no bucket comprovantes';

-- ------------------------------------------------------------
-- 3. Mês de cada morador: saldo inicial, extrato e fechamento
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "LedgerMonth" (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resident_id          TEXT NOT NULL,
    month                TEXT NOT NULL,               -- 'YYYY-MM'
    opening_balance      NUMERIC(12,2),               -- só preenchido quando informado à mão
    bank_closing_balance NUMERIC(12,2),               -- saldo final conforme o extrato
    statement_photos     JSONB DEFAULT '[]'::jsonb,   -- fotos do extrato impresso
    closed_at            TIMESTAMPTZ,
    signed_by_name       TEXT,
    signed_by_role       TEXT,
    signed_council       TEXT,
    signed_at            TIMESTAMPTZ,
    signed_ip            TEXT,
    signed_device        TEXT,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ledger_month_resident_month_idx
    ON "LedgerMonth" (resident_id, month);

COMMENT ON COLUMN "LedgerMonth".opening_balance IS
  'Saldo inicial informado à mão (1º mês do morador ou correção). Se nulo, vale o saldo final do mês anterior.';
COMMENT ON COLUMN "LedgerMonth".bank_closing_balance IS
  'Saldo final lido do extrato (conta + aplicação automática do último dia), para conferência.';

-- ------------------------------------------------------------
-- 4. Bucket privado de comprovantes
--
-- Nota fiscal tem CPF, itens comprados e local: dado pessoal.
-- O bucket nasce privado e o acesso é por URL assinada.
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comprovantes',
  'comprovantes',
  false,
  3145728,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Políticas do Storage para o bucket, no mesmo molde do ficha-fotos.
-- O bucket é privado: sem URL assinada a imagem não abre. Estas políticas
-- só permitem que a aplicação (chave anônima) envie, assine e apague.
DROP POLICY IF EXISTS comprovantes_leitura ON storage.objects;
DROP POLICY IF EXISTS comprovantes_envio   ON storage.objects;
DROP POLICY IF EXISTS comprovantes_ajuste  ON storage.objects;
DROP POLICY IF EXISTS comprovantes_remocao ON storage.objects;

CREATE POLICY comprovantes_leitura ON storage.objects FOR SELECT
  USING (bucket_id = 'comprovantes');
CREATE POLICY comprovantes_envio   ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'comprovantes');
CREATE POLICY comprovantes_ajuste  ON storage.objects FOR UPDATE
  USING (bucket_id = 'comprovantes');
CREATE POLICY comprovantes_remocao ON storage.objects FOR DELETE
  USING (bucket_id = 'comprovantes');

-- ------------------------------------------------------------
-- ATENÇÃO — SEGURANÇA
-- Dado financeiro de pessoa em tutela, em tabela ainda sem RLS
-- (decisão registrada: o RLS entra na etapa de autenticação).
-- ------------------------------------------------------------
