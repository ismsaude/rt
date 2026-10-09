-- ============================================================
-- AUREAN RT — Recursos do morador em tempo real
--
-- A tela de Recursos do Morador assina as mudanças destas tabelas
-- para se atualizar sozinha quando outra pessoa (ou outra aba)
-- lança, corrige ou apaga algo. O Supabase só envia eventos de
-- tabelas que estão na publicação supabase_realtime.
--
-- Executar com:
--   npx prisma db execute --file supabase/migrations/017_recursos_tempo_real.sql \
--     --schema prisma/schema.prisma
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'ResidentLedger'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "ResidentLedger";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'LedgerMonth'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "LedgerMonth";
  END IF;
END $$;

-- Sem isto, um DELETE chega só com o id da linha apagada, e a tela
-- não saberia de qual morador era.
ALTER TABLE "ResidentLedger" REPLICA IDENTITY FULL;
ALTER TABLE "LedgerMonth"    REPLICA IDENTITY FULL;
