-- ============================================================
-- AUREAN RT — Conselho de classe dos profissionais
--
-- O registro profissional era um campo de texto livre. Como ele
-- sai impresso na assinatura da Ficha de Acompanhamento Mensal —
-- documento que a vigilância sanitária lê —, passa a ser
-- estruturado: conselho, número e UF em colunas próprias.
--
-- Executar com:
--   npx prisma db execute --file supabase/migrations/005_conselho_classe.sql \
--     --schema prisma/schema.prisma
-- ============================================================

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS professional_council TEXT,
  ADD COLUMN IF NOT EXISTS professional_uf      TEXT;

COMMENT ON COLUMN "User".professional_council IS 'Sigla do conselho: CRESS, COREN, CRM, CRP...';
COMMENT ON COLUMN "User".professional_id      IS 'Número da inscrição no conselho';
COMMENT ON COLUMN "User".professional_uf      IS 'UF do registro, quando o conselho for regional';
