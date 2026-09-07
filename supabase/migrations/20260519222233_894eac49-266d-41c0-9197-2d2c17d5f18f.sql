
-- =========================================
-- 1. documentos_gerados
-- =========================================
CREATE TABLE public.documentos_gerados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('rfo','transito')),
  titulo text NOT NULL,
  chamado_id uuid REFERENCES public.chamados(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  storage_path text,
  criado_por uuid,
  autor_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_documentos_gerados_tipo_data
  ON public.documentos_gerados (tipo, created_at DESC);

ALTER TABLE public.documentos_gerados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documentos select" ON public.documentos_gerados
  FOR SELECT TO authenticated
  USING (public.can_read(auth.uid()));

CREATE POLICY "documentos insert" ON public.documentos_gerados
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write(auth.uid()) AND criado_por = auth.uid());

CREATE POLICY "documentos delete" ON public.documentos_gerados
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- =========================================
-- 2. Storage bucket
-- =========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-gerados', 'documentos-gerados', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "documentos-gerados read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos-gerados' AND public.can_read(auth.uid()));

CREATE POLICY "documentos-gerados insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-gerados' AND public.can_write(auth.uid()));

CREATE POLICY "documentos-gerados delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-gerados' AND public.is_admin(auth.uid()));

-- =========================================
-- 3. SLA pause em chamados
-- =========================================
ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS sla_pausado_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_pausado_total_seg integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.handle_sla_pause()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Pausando
    IF NEW.status::text = 'aguardando_cliente' AND OLD.status::text <> 'aguardando_cliente' THEN
      NEW.sla_pausado_at := now();
    END IF;
    -- Retomando
    IF OLD.status::text = 'aguardando_cliente' AND NEW.status::text <> 'aguardando_cliente' AND OLD.sla_pausado_at IS NOT NULL THEN
      NEW.sla_pausado_total_seg := COALESCE(OLD.sla_pausado_total_seg,0)
        + GREATEST(0, EXTRACT(EPOCH FROM (now() - OLD.sla_pausado_at))::int);
      NEW.sla_pausado_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_sla_pause ON public.chamados;
CREATE TRIGGER trg_handle_sla_pause
  BEFORE UPDATE ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.handle_sla_pause();
