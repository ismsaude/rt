-- ============================================================
-- AUREAN RT — Checagem de medicação compartilhada
--
-- Dois problemas resolvidos aqui:
--
-- 1. A medicação não sabia a quem pertencia. A tabela "Medication"
--    tinha apenas nome, dosagem e estoque; morador, horários e origem
--    viviam no localStorage de cada aparelho — por isso cada celular
--    enxergava uma lista diferente.
--
-- 2. A checagem não era arquivada. Marcar "tomou" existia só na tela:
--    recarregar apagava, e uma cuidadora não via o que a técnica já
--    havia administrado, com risco de dose duplicada.
--
-- Executar com:
--   npx prisma db execute --file supabase/migrations/007_checagem_medicacao.sql \
--     --schema prisma/schema.prisma
-- ============================================================

-- ------------------------------------------------------------
-- 1. A medicação passa a pertencer ao morador
-- ------------------------------------------------------------
ALTER TABLE "Medication"
  ADD COLUMN IF NOT EXISTS resident_id   TEXT,
  ADD COLUMN IF NOT EXISTS resident_name TEXT,
  ADD COLUMN IF NOT EXISTS times         JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS origin        TEXT,
  ADD COLUMN IF NOT EXISTS active        BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN "Medication".times  IS 'Horários de administração, ex.: ["08:00","20:00"]';
COMMENT ON COLUMN "Medication".origin IS 'SUS ou Farmácia';

-- ------------------------------------------------------------
-- 2. Registro de cada dose
--
-- A tabela já existia no formato do Prisma, ligada a "Prescription",
-- que nunca chegou a ser usada. Ganha as colunas que a tela realmente
-- precisa, e prescriptionId deixa de ser obrigatória.
-- ------------------------------------------------------------
ALTER TABLE "MedicationAdministration"
  ADD COLUMN IF NOT EXISTS medication_id    TEXT,
  ADD COLUMN IF NOT EXISTS medication_name  TEXT,
  ADD COLUMN IF NOT EXISTS resident_id      TEXT,
  ADD COLUMN IF NOT EXISTS resident_name    TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_date   DATE,
  ADD COLUMN IF NOT EXISTS scheduled_time   TEXT,
  ADD COLUMN IF NOT EXISTS given_by_name    TEXT,
  ADD COLUMN IF NOT EXISTS given_by_role    TEXT;

ALTER TABLE "MedicationAdministration"
  ALTER COLUMN "prescriptionId" DROP NOT NULL;

ALTER TABLE "MedicationAdministration"
  ALTER COLUMN "userId" DROP NOT NULL;

-- ------------------------------------------------------------
-- 3. Trava contra dose duplicada
--
-- Uma dose é única por medicação, dia e horário previsto. Se a técnica
-- já registrou, a tentativa da cuidadora é recusada pelo próprio banco,
-- e não apenas pela interface.
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS medication_dose_unica_idx
  ON "MedicationAdministration" (medication_id, scheduled_date, scheduled_time)
  WHERE medication_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS medication_adm_data_idx
  ON "MedicationAdministration" (scheduled_date DESC);

CREATE INDEX IF NOT EXISTS medication_adm_morador_idx
  ON "MedicationAdministration" (resident_id, scheduled_date DESC);

-- ------------------------------------------------------------
-- ATENÇÃO — SEGURANÇA
-- Dado sensível de saúde (LGPD, art. 11) em tabela sem RLS.
-- ------------------------------------------------------------
