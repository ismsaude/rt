-- ============================================================
-- AUREAN RT — Assinatura eletrônica dos registros
--
-- A passagem de plantão já exigia a senha da cuidadora, mas nada disso
-- ficava gravado: o registro não guardava prova de que a autenticação
-- havia ocorrido, nem de onde e quando. O relatório de enfermagem e a
-- ficha mensal sequer pediam senha.
--
-- Estas colunas guardam o que sustenta a assinatura numa auditoria:
-- quem assinou, o registro profissional no momento da assinatura, o
-- instante exato, o IP de origem e o dispositivo.
-- ============================================================

-- Passagem de plantão (cuidadoras)
ALTER TABLE "ShiftReport"
  ADD COLUMN IF NOT EXISTS signed_by_name   TEXT,
  ADD COLUMN IF NOT EXISTS signed_by_role   TEXT,
  ADD COLUMN IF NOT EXISTS signed_council   TEXT,
  ADD COLUMN IF NOT EXISTS signed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_ip        TEXT,
  ADD COLUMN IF NOT EXISTS signed_device    TEXT;

-- Relatório de enfermagem (técnica)
ALTER TABLE "NursingReport"
  ADD COLUMN IF NOT EXISTS signed_by_name   TEXT,
  ADD COLUMN IF NOT EXISTS signed_by_role   TEXT,
  ADD COLUMN IF NOT EXISTS signed_council   TEXT,
  ADD COLUMN IF NOT EXISTS signed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_ip        TEXT,
  ADD COLUMN IF NOT EXISTS signed_device    TEXT;

-- Ficha mensal (supervisão)
ALTER TABLE "MonthlyReport"
  ADD COLUMN IF NOT EXISTS signed_by_name   TEXT,
  ADD COLUMN IF NOT EXISTS signed_by_role   TEXT,
  ADD COLUMN IF NOT EXISTS signed_council   TEXT,
  ADD COLUMN IF NOT EXISTS signed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_ip        TEXT,
  ADD COLUMN IF NOT EXISTS signed_device    TEXT;

COMMENT ON COLUMN "ShiftReport".signed_council IS 'Registro profissional no momento da assinatura';
COMMENT ON COLUMN "ShiftReport".signed_ip      IS 'IP de origem, para rastreabilidade em auditoria';
