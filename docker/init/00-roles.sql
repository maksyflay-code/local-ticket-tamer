-- Ajusta as senhas das roles internas do Supabase self-hosted.
-- Executado apenas na primeira inicialização do banco.
-- Só altera as roles que realmente existem, para não abortar a inicialização.
DO $$
DECLARE
  r text;
  pass text := current_setting('custom.pgpass', true);
BEGIN
  IF pass IS NULL OR pass = '' THEN
    RAISE NOTICE 'Senha nao informada; nada a fazer.';
    RETURN;
  END IF;

  FOREACH r IN ARRAY ARRAY[
    'authenticator',
    'pgbouncer',
    'supabase_auth_admin',
    'supabase_functions_admin',
    'supabase_storage_admin',
    'supabase_read_only_user',
    'supabase_replication_admin',
    'supabase_realtime_admin'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', r, pass);
    END IF;
  END LOOP;
END
$$;
