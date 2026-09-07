CREATE TABLE public.sla_config (
  prioridade text PRIMARY KEY,
  horas_resolucao integer NOT NULL CHECK (horas_resolucao > 0),
  horas_resposta integer CHECK (horas_resposta IS NULL OR horas_resposta > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sla_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sla_config select" ON public.sla_config
  FOR SELECT TO authenticated USING (can_read(auth.uid()));

CREATE POLICY "sla_config admin update" ON public.sla_config
  FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "sla_config admin insert" ON public.sla_config
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));

CREATE TRIGGER sla_config_set_updated_at
  BEFORE UPDATE ON public.sla_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.sla_config (prioridade, horas_resolucao, horas_resposta) VALUES
  ('urgente', 4, 1),
  ('alta', 8, 2),
  ('media', 24, 4),
  ('baixa', 72, 8);