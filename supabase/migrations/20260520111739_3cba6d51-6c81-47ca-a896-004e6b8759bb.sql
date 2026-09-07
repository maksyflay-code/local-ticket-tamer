
CREATE OR REPLACE FUNCTION public.handle_sla_pause()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'aguardando_cliente' AND OLD.status <> 'aguardando_cliente' THEN
      NEW.sla_pausado_at := now();
    ELSIF OLD.status = 'aguardando_cliente' AND NEW.status <> 'aguardando_cliente' THEN
      IF OLD.sla_pausado_at IS NOT NULL THEN
        NEW.sla_pausado_total_seg := COALESCE(OLD.sla_pausado_total_seg, 0)
          + EXTRACT(EPOCH FROM (now() - OLD.sla_pausado_at))::int;
      END IF;
      NEW.sla_pausado_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sla_pause ON public.chamados;
CREATE TRIGGER trg_sla_pause
BEFORE UPDATE ON public.chamados
FOR EACH ROW EXECUTE FUNCTION public.handle_sla_pause();
