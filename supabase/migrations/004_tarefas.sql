-- ============================================================
-- AUREAN RT — Tarefas da rotina
--
-- A tela de Tarefas gravava em colunas que não existem no banco
-- ("time", "done") e sempre caía num fallback silencioso para o
-- localStorage do aparelho. Esta migração acrescenta o horário
-- previsto; o restante do código passa a usar as colunas que já
-- existiam (isDone, doneAt, doneBy), que também dão rastreabilidade
-- de quem concluiu cada tarefa.
--
-- Executar com:
--   npx prisma db execute --file supabase/migrations/004_tarefas.sql \
--     --schema prisma/schema.prisma
-- ============================================================

ALTER TABLE "Task"
  ADD COLUMN IF NOT EXISTS time TEXT;

COMMENT ON COLUMN "Task".time   IS 'Horário previsto no formato HH:MM';
COMMENT ON COLUMN "Task"."doneBy" IS 'Nome de quem marcou a tarefa como concluída';
COMMENT ON COLUMN "Task"."doneAt" IS 'Quando a tarefa foi concluída';
