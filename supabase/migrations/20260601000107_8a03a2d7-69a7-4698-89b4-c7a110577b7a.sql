ALTER TABLE public.manutencoes_programadas
  ADD COLUMN IF NOT EXISTS notificar_telegram boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS antecedencia_min integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS notificado_inicio_at timestamptz,
  ADD COLUMN IF NOT EXISTS notificado_antes_at timestamptz;