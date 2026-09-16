-- ============================================================
-- AUREAN RT — Relatório diário de enfermagem
--
-- A técnica de enfermagem produz um relatório todos os dias,
-- mesmo quando não há aferição de sinais vitais. Até aqui não
-- havia onde registrá-lo: o que não virava sinal vital ou
-- medicação simplesmente não era arquivado.
--
-- As observações por morador ficam em JSONB, no mesmo formato
-- usado em "ShiftReport".reports, para que a consolidação mensal
-- possa reuni-las na ficha de cada morador.
--
-- Executar com:
--   npx prisma db execute --file supabase/migrations/006_relatorio_enfermagem.sql \
--     --schema prisma/schema.prisma
-- ============================================================

CREATE TABLE IF NOT EXISTS "NursingReport" (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shift          TEXT,
    content        TEXT NOT NULL,
    procedures     JSONB DEFAULT '[]'::jsonb,
    resident_notes JSONB DEFAULT '{}'::jsonb,
    author_id      TEXT,
    author_name    TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nursing_report_date_idx ON "NursingReport" (date DESC);

COMMENT ON TABLE  "NursingReport"                IS 'Relatório diário da enfermagem';
COMMENT ON COLUMN "NursingReport".content        IS 'Evolução de enfermagem do dia';
COMMENT ON COLUMN "NursingReport".procedures     IS 'Procedimentos realizados no período';
COMMENT ON COLUMN "NursingReport".resident_notes IS 'Observações por morador: { residentId: texto }';

-- ------------------------------------------------------------
-- ATENÇÃO — SEGURANÇA
-- Dado sensível de saúde (LGPD, art. 11) em tabela sem RLS.
-- ------------------------------------------------------------
