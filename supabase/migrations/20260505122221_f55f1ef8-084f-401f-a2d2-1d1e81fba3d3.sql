
ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chamados_responsavel ON public.chamados(responsavel_id);
