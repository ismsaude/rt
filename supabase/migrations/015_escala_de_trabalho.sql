-- ============================================================
-- AUREAN RT — Escala de trabalho
--
-- Substitui a escala que ficava só no navegador (localStorage).
--
-- Duas camadas, de propósito:
--
--   1. REGRAS  (ScheduleShift, ScheduleHoliday): como a casa funciona —
--      quem cobre cada posto, em que dias e horários, e se trabalha
--      em feriado. Mudam quando a equipe muda.
--
--   2. ESCALA DO MÊS (ScheduleEntry): o que foi gerado e publicado
--      para um mês, dia a dia. É gravada, não recalculada: ao olhar
--      um mês passado você vê o que valeu naquele mês, mesmo que as
--      regras tenham mudado depois.
--
-- Cada lançamento guarda o nome do posto e o nome da pessoa como
-- estavam na época, para o histórico sobreviver à saída de alguém.
--
-- Executar com:
--   npx prisma db execute --file supabase/migrations/015_escala_de_trabalho.sql \
--     --schema prisma/schema.prisma
-- ============================================================

-- ------------------------------------------------------------
-- 1. Postos de trabalho
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ScheduleShift" (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT NOT NULL,                       -- "Cuidadora diurno"
    category          TEXT NOT NULL DEFAULT 'cuidadora',   -- cuidadora | tecnica | supervisao | outro
    pattern           TEXT NOT NULL CHECK (pattern IN ('12x36', 'semanal')),
    start_time        TEXT NOT NULL,                       -- 'HH:MM'
    end_time          TEXT NOT NULL,
    weekdays          JSONB NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb, -- 0=dom … 6=sáb (só 'semanal')
    weekday_hours     JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {"6": {"start":"07:00","end":"11:00"}}
    works_on_holidays BOOLEAN NOT NULL DEFAULT FALSE,
    people            JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ user_id, name }]
    anchor_date       DATE,                                -- 12x36: dia em que people[0] trabalha
    position          INTEGER NOT NULL DEFAULT 0,
    active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN "ScheduleShift".people IS
  '12x36: pessoas que se revezam, na ordem. semanal: uma pessoa fixa.';
COMMENT ON COLUMN "ScheduleShift".anchor_date IS
  '12x36: data em que a primeira pessoa da lista trabalha; as demais datas seguem o revezamento.';

-- ------------------------------------------------------------
-- 2. Feriados (nacionais e municipais)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ScheduleHoliday" (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    holiday_date  DATE NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 3. Escala do mês — um lançamento por posto e dia
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ScheduleEntry" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_date      DATE NOT NULL,
    shift_id        TEXT NOT NULL,
    shift_name      TEXT NOT NULL,
    shift_hours     TEXT,                 -- "7–19h", para o rótulo da linha
    shift_category  TEXT,
    shift_position  INTEGER NOT NULL DEFAULT 0,
    kind            TEXT NOT NULL DEFAULT 'plantao'
                    CHECK (kind IN ('plantao', 'folga', 'feriado')),
    user_id         TEXT,
    person_name     TEXT,
    start_time      TEXT,
    end_time        TEXT,
    note            TEXT,
    manual          BOOLEAN NOT NULL DEFAULT FALSE, -- ajustado à mão: a regeneração preserva
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS schedule_entry_shift_date_idx
    ON "ScheduleEntry" (shift_id, entry_date);
CREATE INDEX IF NOT EXISTS schedule_entry_date_idx
    ON "ScheduleEntry" (entry_date);

-- ------------------------------------------------------------
-- 4. Fechamento do mês: a escala assinada vira "Escala Executada"
--
-- Enquanto não há assinatura, o documento é a ESCALA DE TRABALHO
-- (o previsto, ainda ajustável). Assinada pela supervisão, passa a
-- ESCALA EXECUTADA e os lançamentos do mês ficam travados.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ScheduleMonth" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month           TEXT NOT NULL UNIQUE,   -- 'YYYY-MM'
    closed_at       TIMESTAMPTZ,
    signed_by_name  TEXT,
    signed_by_role  TEXT,
    signed_council  TEXT,
    signed_at       TIMESTAMPTZ,
    signed_ip       TEXT,
    signed_device   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- ATENÇÃO — SEGURANÇA
-- Mesmo regime do restante do sistema: sem RLS por decisão registrada.
-- ------------------------------------------------------------
