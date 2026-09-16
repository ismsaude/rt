-- ============================================================
-- AUREAN RT — Separar alergias de condições clínicas
--
-- O campo "allergies" vinha sendo usado para comorbidades: diabético,
-- hipertensivo, esquizofrênico, cardiopata, prolapso, perna fraturada
-- com pino. Nenhuma delas é alergia.
--
-- A distinção não é semântica. Alergia é informação de emergência: se
-- "alergia a dipirona" for cadastrada no meio de seis comorbidades, ela
-- aparece num selo igual aos outros, e quem está com pressa não
-- distingue o que mata do que é crônico.
--
-- Aqui o conteúdo atual passa para "conditions", e "allergies" fica
-- vazio para receber apenas alergias reais.
-- ============================================================

ALTER TABLE "Resident"
  ADD COLUMN IF NOT EXISTS conditions TEXT;

-- Move o que está registrado hoje, sem perder nada.
UPDATE "Resident"
   SET conditions = allergies
 WHERE conditions IS NULL
   AND allergies IS NOT NULL
   AND btrim(allergies) <> '';

-- Zera o campo de alergias para que seja preenchido com alergias reais.
UPDATE "Resident"
   SET allergies = NULL
 WHERE conditions IS NOT NULL;

COMMENT ON COLUMN "Resident".conditions IS 'Comorbidades e condições clínicas';
COMMENT ON COLUMN "Resident".allergies  IS 'Somente alergias e reações adversas — informação de emergência';
