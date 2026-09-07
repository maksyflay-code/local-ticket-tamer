ALTER TABLE public.chamado_historico REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chamado_historico;