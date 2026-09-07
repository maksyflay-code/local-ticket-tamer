
-- 1) Add columns
ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS tipo_problema text;

-- 2) Trigger function to generate codigo as YYYYDDMM-NN (year+day+month, sequence per day)
CREATE OR REPLACE FUNCTION public.set_chamado_codigo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_seq int;
BEGIN
  IF NEW.codigo IS NOT NULL AND NEW.codigo <> '' THEN
    RETURN NEW;
  END IF;
  v_prefix := to_char(COALESCE(NEW.created_at, now()), 'YYYY') ||
              to_char(COALESCE(NEW.created_at, now()), 'DD') ||
              to_char(COALESCE(NEW.created_at, now()), 'MM');
  -- Lock by prefix to avoid race conditions
  PERFORM pg_advisory_xact_lock(hashtext('chamado_codigo_' || v_prefix));
  SELECT COALESCE(MAX(NULLIF(split_part(codigo, '-', 2), '')::int), 0) + 1
    INTO v_seq
  FROM public.chamados
  WHERE codigo LIKE v_prefix || '-%';
  NEW.codigo := v_prefix || '-' || lpad(v_seq::text, 2, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chamados_set_codigo ON public.chamados;
CREATE TRIGGER chamados_set_codigo
BEFORE INSERT ON public.chamados
FOR EACH ROW EXECUTE FUNCTION public.set_chamado_codigo();

-- 3) Backfill existing rows (ordered by created_at, sequence per day)
WITH ranked AS (
  SELECT id,
         to_char(created_at, 'YYYY') || to_char(created_at, 'DD') || to_char(created_at, 'MM') AS prefix,
         row_number() OVER (
           PARTITION BY to_char(created_at, 'YYYY-MM-DD')
           ORDER BY created_at, numero
         ) AS seq
  FROM public.chamados
  WHERE codigo IS NULL OR codigo = ''
)
UPDATE public.chamados c
   SET codigo = r.prefix || '-' || lpad(r.seq::text, 2, '0')
  FROM ranked r
 WHERE c.id = r.id;

-- 4) Unique index on codigo
CREATE UNIQUE INDEX IF NOT EXISTS chamados_codigo_uniq ON public.chamados(codigo);
