-- ============================================================
-- AUREAN RT — Comprovantes obrigatórios nos recursos do morador
--
-- Toda saída passa a exigir foto da nota/comprovante, salvo as
-- marcadas como dispensadas (tarifa bancária, seguro, débito
-- automático: não há nota). E o mês só fecha com a foto ou PDF do
-- extrato, salvo para o morador que não tem conta em banco.
--
-- Executar com:
--   npx prisma db execute --file supabase/migrations/018_comprovante_obrigatorio.sql \
--     --schema prisma/schema.prisma
-- ============================================================

ALTER TABLE "ResidentLedger"
  ADD COLUMN IF NOT EXISTS receipt_exempt BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN "ResidentLedger".receipt_exempt IS
  'Saída sem comprovante por natureza (tarifa, seguro, débito automático): dispensa a foto.';

ALTER TABLE "Resident"
  ADD COLUMN IF NOT EXISTS no_bank_account BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN "Resident".no_bank_account IS
  'Morador sem conta em banco: não há extrato, e o fechamento do mês não exige a foto dele.';
