CREATE TABLE public.manutencoes_programadas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  operadora text NOT NULL,
  trecho text NOT NULL,
  data_inicio timestamp with time zone NOT NULL,
  data_fim timestamp with time zone,
  descricao text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manutencoes_programadas TO authenticated;
GRANT ALL ON public.manutencoes_programadas TO service_role;

ALTER TABLE public.manutencoes_programadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manut select" ON public.manutencoes_programadas
  FOR SELECT TO authenticated USING (public.can_read(auth.uid()));
CREATE POLICY "manut insert" ON public.manutencoes_programadas
  FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "manut update" ON public.manutencoes_programadas
  FOR UPDATE TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "manut delete" ON public.manutencoes_programadas
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_manut_updated_at
  BEFORE UPDATE ON public.manutencoes_programadas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_manut_data_inicio ON public.manutencoes_programadas (data_inicio);