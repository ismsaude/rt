-- ============================================================
-- AUREAN RT — Horário de refeição remunerado na escala
--
-- Quem trabalha sem poder sair para comer recebe 1h extra pela
-- refeição. A regra é do POSTO, não da pessoa:
--
--   'sempre'       todo plantão do posto dá a hora (ex.: noturno —
--                  a pessoa não pode sair para jantar);
--   'fds_feriado'  só plantões de sábado, domingo e feriado (ex.:
--                  diurno — sozinha na casa, sem sair para almoçar);
--   'nenhuma'      não dá direito.
--
-- Cada lançamento da escala guarda uma cópia da regra do posto na
-- época em que foi gerado, como já faz com o nome e o horário: mudar
-- a regra depois não altera meses já gerados.
--
-- Executar com:
--   npx prisma db execute --file supabase/migrations/016_refeicao_remunerada.sql \
--     --schema prisma/schema.prisma
-- ============================================================

ALTER TABLE "ScheduleShift"
  ADD COLUMN IF NOT EXISTS meal_rule  TEXT NOT NULL DEFAULT 'nenhuma',
  ADD COLUMN IF NOT EXISTS meal_hours NUMERIC(3,1) NOT NULL DEFAULT 1;

ALTER TABLE "ScheduleEntry"
  ADD COLUMN IF NOT EXISTS shift_meal_rule  TEXT,
  ADD COLUMN IF NOT EXISTS shift_meal_hours NUMERIC(3,1);

COMMENT ON COLUMN "ScheduleShift".meal_rule IS
  'nenhuma | sempre | fds_feriado — quando o plantão dá direito à hora de refeição remunerada';
COMMENT ON COLUMN "ScheduleShift".meal_hours IS
  'Horas extras pagas por plantão que dá direito (padrão: 1)';

-- Postos 12x36 que já existem: noturno (termina no dia seguinte) dá a hora
-- em todo plantão; diurno, só em sábado, domingo e feriado. Só preenche
-- onde ainda não há regra definida.
UPDATE "ScheduleShift"
   SET meal_rule = 'sempre'
 WHERE pattern = '12x36' AND meal_rule = 'nenhuma' AND end_time <= start_time;

UPDATE "ScheduleShift"
   SET meal_rule = 'fds_feriado'
 WHERE pattern = '12x36' AND meal_rule = 'nenhuma' AND end_time > start_time;

-- Escalas já geradas: copia a regra para os lançamentos existentes.
UPDATE "ScheduleEntry" e
   SET shift_meal_rule = s.meal_rule, shift_meal_hours = s.meal_hours
  FROM "ScheduleShift" s
 WHERE e.shift_id = s.id::text AND e.shift_meal_rule IS NULL;
