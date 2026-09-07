ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS iniciado_at timestamptz,
  ADD COLUMN IF NOT EXISTS finalizado_at timestamptz;