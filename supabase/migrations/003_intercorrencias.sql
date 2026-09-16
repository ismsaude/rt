-- ============================================================
-- AUREAN RT — Intercorrências, comportamento, autonomia e
--              tipificação da agenda
--
-- Fecha as três lacunas entre o que as cuidadoras registram e o
-- que a Ficha de Acompanhamento Mensal exige, e cria o registro
-- de intercorrências que a vigilância sanitária cobra.
--
-- Executar com:
--   npx prisma db execute --file supabase/migrations/003_intercorrencias.sql \
--     --schema prisma/schema.prisma
-- ============================================================

-- ------------------------------------------------------------
-- 1. LIVRO DE INTERCORRÊNCIAS
--
-- Uma intercorrência pertence à casa, mas envolve moradores
-- específicos. Guardar os envolvidos em array permite que o
-- mesmo episódio apareça no prontuário de cada um deles —
-- que é justamente o que hoje se perde no relato geral.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Incident" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    type            TEXT NOT NULL,
    severity        TEXT NOT NULL DEFAULT 'Leve',
    description     TEXT NOT NULL,
    conduct         TEXT,
    notified        TEXT,
    resident_ids    JSONB DEFAULT '[]'::jsonb,
    resident_names  JSONB DEFAULT '[]'::jsonb,
    reporter_id     TEXT,
    reporter_name   TEXT,
    shift_report_id TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS incident_occurred_idx  ON "Incident" (occurred_at DESC);
CREATE INDEX IF NOT EXISTS incident_type_idx      ON "Incident" (type);
CREATE INDEX IF NOT EXISTS incident_severity_idx  ON "Incident" (severity);
-- Busca por morador envolvido (operador de contenção em JSONB)
CREATE INDEX IF NOT EXISTS incident_residents_idx ON "Incident" USING GIN (resident_ids);

COMMENT ON TABLE  "Incident"                IS 'Registro de intercorrências e eventos adversos';
COMMENT ON COLUMN "Incident".resident_ids   IS 'Array de ids dos moradores envolvidos';
COMMENT ON COLUMN "Incident".conduct        IS 'Conduta adotada pela equipe';
COMMENT ON COLUMN "Incident".notified       IS 'Quem foi comunicado (supervisão, família, SAMU...)';

-- ------------------------------------------------------------
-- 2. TIPO NA AGENDA
--
-- Separa o que é intervenção clínica (consulta, exame) do que é
-- interação social (visita, passeio, festividade). Com isso as
-- seções INTERVENÇÕES e INTERAÇÕES SOCIAIS da ficha passam a se
-- preencher a partir da mesma tabela.
-- ------------------------------------------------------------
ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS done BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS outcome TEXT;

COMMENT ON COLUMN "Event".type    IS 'Consulta, Exame, Visita de familiar, Atividade coletiva, Passeio, Outro';
COMMENT ON COLUMN "Event".outcome IS 'O que foi feito / desfecho, usado nas INTERVENÇÕES da ficha';

-- Compromissos antigos entram como Consulta, que é o caso dominante.
UPDATE "Event" SET type = 'Consulta' WHERE type IS NULL;

-- ------------------------------------------------------------
-- 3. NÍVEL DE AUTONOMIA DO MORADOR
--
-- Autonomia não muda de um plantão para o outro: é atributo do
-- morador, revisado pela supervisão ao fechar o mês. Evita três
-- perguntas a mais, duas vezes por dia, para um dado estável.
-- ------------------------------------------------------------
ALTER TABLE "Resident"
  ADD COLUMN IF NOT EXISTS autonomy_hygiene    TEXT,
  ADD COLUMN IF NOT EXISTS autonomy_food       TEXT,
  ADD COLUMN IF NOT EXISTS autonomy_activities TEXT,
  ADD COLUMN IF NOT EXISTS autonomy_updated_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- 4. COMPORTAMENTO NA PASSAGEM DE PLANTÃO
--
-- Não exige coluna nova: o campo "reports" do ShiftReport é JSONB
-- por morador e passa a carregar também { behavior: [...] }.
-- Registros antigos simplesmente não têm a chave.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- ATENÇÃO — SEGURANÇA
-- "Incident" contém dado sensível de saúde (LGPD, art. 11) e
-- nasce sem RLS, como o restante do schema.
-- ------------------------------------------------------------
