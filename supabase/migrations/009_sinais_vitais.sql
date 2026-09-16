-- ============================================================
-- AUREAN RT — Destravar a gravação de sinais vitais
--
-- "VitalSigns" acumula dois conjuntos de colunas: as originais do
-- Prisma (residentId, bloodPressure, temperature, userId...) e as que
-- a aplicação realmente escreve (resident_id, bp, glucose, temp, spo2).
--
-- As colunas do Prisma continuaram NOT NULL, com chave estrangeira em
-- residentId e userId. Como o app nunca as preenche, TODA aferição era
-- recusada pelo banco — a tabela está vazia. A técnica aferia, via a
-- mensagem de erro e o dado se perdia.
--
-- Aqui as colunas herdadas deixam de ser obrigatórias, preservando os
-- dados antigos (não há nenhum) e liberando o caminho que o app usa.
-- A unificação das duas nomenclaturas fica para uma limpeza posterior,
-- que exige migrar dados e não apenas afrouxar restrições.
-- ============================================================

ALTER TABLE "VitalSigns" ALTER COLUMN "residentId" DROP NOT NULL;
ALTER TABLE "VitalSigns" ALTER COLUMN "userId"     DROP NOT NULL;

-- Chaves estrangeiras herdadas impediriam gravar com id ausente.
ALTER TABLE "VitalSigns" DROP CONSTRAINT IF EXISTS "VitalSigns_residentId_fkey";
ALTER TABLE "VitalSigns" DROP CONSTRAINT IF EXISTS "VitalSigns_userId_fkey";

-- Consulta mais frequente: aferições de um dia, para o relatório.
CREATE INDEX IF NOT EXISTS vitalsigns_created_idx  ON "VitalSigns" (created_at DESC);
CREATE INDEX IF NOT EXISTS vitalsigns_morador_idx  ON "VitalSigns" (resident_id, created_at DESC);

COMMENT ON TABLE "VitalSigns" IS
  'Aferições. O app usa resident_id/bp/glucose/temp/spo2/notes/created_at; as colunas em camelCase são herança do Prisma e estão em desuso.';
