-- ============================================================
-- AUREAN RT — Seção de observações na ficha mensal
--
-- Resumo clínico do morador, que se repete em todas as fichas dele e
-- dá contexto a quem lê o documento sem conhecer o caso.
-- ============================================================

ALTER TABLE "MonthlyReport"
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

COMMENT ON COLUMN "MonthlyReport".observacoes IS
  'Resumo clínico do morador: condições registradas, idade e contexto';
