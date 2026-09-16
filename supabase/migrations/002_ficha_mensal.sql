-- ============================================================
-- AUREAN RT — Ficha de Acompanhamento Mensal
--
-- Estrutura a ficha que a supervisão emite por morador, nas
-- mesmas seções do documento oficial em uso na residência.
--
-- Executar no SQL Editor do Supabase ou via:
--   npx prisma db execute --file supabase/migrations/002_ficha_mensal.sql \
--     --schema prisma/schema.prisma
-- ============================================================

-- ------------------------------------------------------------
-- 1. Seções da ficha mensal
-- ------------------------------------------------------------
ALTER TABLE "MonthlyReport"
  ADD COLUMN IF NOT EXISTS intervencoes           TEXT,
  ADD COLUMN IF NOT EXISTS comportamento          TEXT,
  ADD COLUMN IF NOT EXISTS adesao                 TEXT,
  ADD COLUMN IF NOT EXISTS autonomia_higiene      TEXT,
  ADD COLUMN IF NOT EXISTS autonomia_alimentacao  TEXT,
  ADD COLUMN IF NOT EXISTS autonomia_atividades   TEXT,
  ADD COLUMN IF NOT EXISTS interacoes             TEXT,
  ADD COLUMN IF NOT EXISTS emitido_em             DATE;

-- "narrative" passa a ser a análise interna da supervisão; as
-- colunas acima são o que sai impresso na ficha oficial.
ALTER TABLE "MonthlyReport" ALTER COLUMN narrative DROP NOT NULL;

COMMENT ON COLUMN "MonthlyReport".intervencoes  IS 'Consultas, exames e avaliações do período';
COMMENT ON COLUMN "MonthlyReport".comportamento IS 'Mudanças observadas no comportamento';
COMMENT ON COLUMN "MonthlyReport".adesao        IS 'Adesão ao tratamento e às medicações';
COMMENT ON COLUMN "MonthlyReport".interacoes    IS 'Interações sociais e familiares';

-- ------------------------------------------------------------
-- 2. Sexo do morador — consta no cabeçalho da ficha
-- ------------------------------------------------------------
ALTER TABLE "Resident"
  ADD COLUMN IF NOT EXISTS sex TEXT;

-- ------------------------------------------------------------
-- 3. Registro profissional — consta na assinatura da ficha
--    (ex.: CRESS 50.834, COREN, CRP)
-- ------------------------------------------------------------
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS professional_id TEXT,
  ADD COLUMN IF NOT EXISTS job_title       TEXT;

-- ------------------------------------------------------------
-- ATENÇÃO — SEGURANÇA
-- Dado sensível de saúde (LGPD, art. 11) em tabela ainda sem RLS.
-- ------------------------------------------------------------
