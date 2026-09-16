-- ============================================================
-- AUREAN RT — Políticas de acesso às fotos
--
-- storage.objects nasce com RLS habilitado, ao contrário das tabelas
-- do schema public neste projeto. Sem política nenhuma, todo envio é
-- recusado com "new row violates row-level security policy".
--
-- As políticas abaixo liberam o bucket para a chave anônima, que é o
-- que a aplicação usa hoje. Isso mantém o mesmo nível de proteção do
-- restante do sistema — nem mais, nem menos.
--
-- O que já se ganha: o bucket é PRIVADO. A imagem não é acessível por
-- URL pública, apenas por URL assinada de validade curta. Quem obtiver
-- o endereço de uma foto não consegue abri-la depois que a assinatura
-- expira.
--
-- O que falta: enquanto a autenticação não migrar para o Supabase
-- Auth, qualquer portador da chave anônima — que é pública no bundle —
-- consegue listar e baixar as fotos. Fechar isso exige trocar
-- "anon" por "authenticated" nas políticas abaixo e passar a exigir
-- sessão real, o que faz parte da etapa de RLS.
-- ============================================================

DROP POLICY IF EXISTS "ficha_fotos_leitura"  ON storage.objects;
DROP POLICY IF EXISTS "ficha_fotos_envio"    ON storage.objects;
DROP POLICY IF EXISTS "ficha_fotos_remocao"  ON storage.objects;
DROP POLICY IF EXISTS "ficha_fotos_ajuste"   ON storage.objects;

CREATE POLICY "ficha_fotos_leitura" ON storage.objects
  FOR SELECT USING (bucket_id = 'ficha-fotos');

CREATE POLICY "ficha_fotos_envio" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'ficha-fotos');

CREATE POLICY "ficha_fotos_ajuste" ON storage.objects
  FOR UPDATE USING (bucket_id = 'ficha-fotos');

CREATE POLICY "ficha_fotos_remocao" ON storage.objects
  FOR DELETE USING (bucket_id = 'ficha-fotos');
