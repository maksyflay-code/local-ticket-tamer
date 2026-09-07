
CREATE OR REPLACE FUNCTION public.handle_sla_pause()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status::text = 'aguardando_cliente' AND OLD.status::text <> 'aguardando_cliente' THEN
      NEW.sla_pausado_at := now();
    END IF;
    IF OLD.status::text = 'aguardando_cliente' AND NEW.status::text <> 'aguardando_cliente' AND OLD.sla_pausado_at IS NOT NULL THEN
      NEW.sla_pausado_total_seg := COALESCE(OLD.sla_pausado_total_seg,0)
        + GREATEST(0, EXTRACT(EPOCH FROM (now() - OLD.sla_pausado_at))::int);
      NEW.sla_pausado_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
