-- ============================================================
-- AUREAN RT — Parecer mensal por morador
--
-- Guarda a análise que a supervisão escreve ao fechar o mês.
-- Os números (plantões, recusas, observações) continuam sendo
-- calculados a partir de "ShiftReport"; esta tabela armazena
-- apenas o texto do parecer, para que ele não se perca.
--
-- Executar no SQL Editor do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS "MonthlyReport" (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resident_id    TEXT NOT NULL,
    resident_name  TEXT,
    month          TEXT NOT NULL,          -- formato 'YYYY-MM'
    narrative      TEXT NOT NULL,
    author_name    TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Um único parecer por morador e mês.
CREATE UNIQUE INDEX IF NOT EXISTS monthly_report_resident_month_idx
    ON "MonthlyReport" (resident_id, month);

-- Consulta mais frequente: buscar o parecer de um morador/mês.
CREATE INDEX IF NOT EXISTS monthly_report_month_idx
    ON "MonthlyReport" (month);

-- ------------------------------------------------------------
-- ATENÇÃO — SEGURANÇA
-- Esta tabela contém dado sensível de saúde (LGPD, art. 11).
-- Enquanto o RLS não for habilitado em todo o schema, ela fica
-- acessível a qualquer portador da chave anônima, que é pública
-- no bundle do frontend. Habilitar políticas de acesso faz parte
-- da etapa de fundação de dados.
-- ------------------------------------------------------------
