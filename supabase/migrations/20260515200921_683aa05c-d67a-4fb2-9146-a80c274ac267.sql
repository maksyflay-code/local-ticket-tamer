ALTER TABLE public.chamados REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chamados;