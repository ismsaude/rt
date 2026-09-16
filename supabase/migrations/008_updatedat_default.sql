-- ============================================================
-- AUREAN RT — Valor padrão para updatedAt
--
-- As tabelas herdadas do Prisma têm "updatedAt" NOT NULL sem valor
-- padrão, porque o Prisma preenchia a coluna no código. Como o app
-- escreve direto pelo Supabase, qualquer insert que esquecesse esse
-- campo era recusado pelo banco — foi o que aconteceu ao cadastrar
-- medicamento: "null value in column updatedAt violates not-null
-- constraint".
--
-- Definir o padrão no próprio banco elimina a classe inteira do erro,
-- em vez de depender de cada tela lembrar de enviar o campo.
--
-- Executar com:
--   npx prisma db execute --file supabase/migrations/008_updatedat_default.sql \
--     --schema prisma/schema.prisma
-- ============================================================

ALTER TABLE "Medication" ALTER COLUMN "updatedAt" SET DEFAULT NOW();
ALTER TABLE "Resident"   ALTER COLUMN "updatedAt" SET DEFAULT NOW();
ALTER TABLE "FoodItem"   ALTER COLUMN "updatedAt" SET DEFAULT NOW();
ALTER TABLE "User"       ALTER COLUMN "updatedAt" SET DEFAULT NOW();
ALTER TABLE "Menu"       ALTER COLUMN "updatedAt" SET DEFAULT NOW();

-- ------------------------------------------------------------
-- Quem administrou a dose, sem chave estrangeira
--
-- "MedicationAdministration".userId aponta para "User" por herança do
-- Prisma. Registrar uma dose com qualquer id ausente da tabela — como
-- o acesso de desenvolvedor, que não existe no banco — era recusado
-- pela restrição. O nome de quem administrou já é guardado; o id passa
-- a ser apenas informativo, sem travar a checagem.
-- ------------------------------------------------------------
ALTER TABLE "MedicationAdministration"
  ADD COLUMN IF NOT EXISTS given_by_id TEXT;

COMMENT ON COLUMN "MedicationAdministration".given_by_id IS 'Id de quem administrou, sem integridade referencial';
