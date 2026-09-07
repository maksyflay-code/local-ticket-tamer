
-- Enums
CREATE TYPE public.solicitacao_tipo AS ENUM (
  'transito','rfo','compras','manutencao','acesso','reembolso','veiculo'
);

CREATE TYPE public.solicitacao_status AS ENUM (
  'aberta','em_andamento','concluida','cancelada'
);

-- Sequence for numero
CREATE SEQUENCE public.solicitacoes_numero_seq;

-- Tabela principal
CREATE TABLE public.solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL DEFAULT nextval('public.solicitacoes_numero_seq'),
  tipo public.solicitacao_tipo NOT NULL,
  titulo text NOT NULL,
  descricao text,
  status public.solicitacao_status NOT NULL DEFAULT 'aberta',
  prioridade text NOT NULL DEFAULT 'media',
  solicitante_id uuid,
  solicitante_email text,
  responsavel_id uuid,
  responsavel_nome text,
  chamado_id uuid,
  cliente_id uuid,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  documento_id uuid,
  iniciada_at timestamptz,
  concluida_at timestamptz,
  cancelada_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_solicitacoes_tipo ON public.solicitacoes(tipo);
CREATE INDEX idx_solicitacoes_status ON public.solicitacoes(status);
CREATE INDEX idx_solicitacoes_solicitante ON public.solicitacoes(solicitante_id);
CREATE INDEX idx_solicitacoes_responsavel ON public.solicitacoes(responsavel_id);
CREATE INDEX idx_solicitacoes_created_at ON public.solicitacoes(created_at DESC);

CREATE TRIGGER solicitacoes_set_updated_at
BEFORE UPDATE ON public.solicitacoes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.solicitacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solicitacoes select" ON public.solicitacoes
  FOR SELECT TO authenticated USING (public.can_read(auth.uid()));
CREATE POLICY "solicitacoes insert" ON public.solicitacoes
  FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "solicitacoes update" ON public.solicitacoes
  FOR UPDATE TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "solicitacoes delete" ON public.solicitacoes
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Histórico
CREATE TABLE public.solicitacao_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.solicitacoes(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'comentario',
  descricao text NOT NULL,
  status_anterior text,
  status_novo text,
  autor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_solicitacao_hist_sol ON public.solicitacao_historico(solicitacao_id, created_at DESC);

ALTER TABLE public.solicitacao_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sol historico select" ON public.solicitacao_historico
  FOR SELECT TO authenticated USING (public.can_read(auth.uid()));
CREATE POLICY "sol historico insert" ON public.solicitacao_historico
  FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "sol historico update" ON public.solicitacao_historico
  FOR UPDATE TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "sol historico delete" ON public.solicitacao_historico
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Trigger de log de status
CREATE OR REPLACE FUNCTION public.log_solicitacao_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_autor text;
BEGIN
  SELECT email INTO v_autor FROM auth.users WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.solicitacao_historico(solicitacao_id, tipo, descricao, status_novo, autor)
    VALUES (NEW.id, 'criacao', 'Solicitação criada', NEW.status::text, v_autor);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.solicitacao_historico(solicitacao_id, tipo, descricao, status_anterior, status_novo, autor)
      VALUES (NEW.id, 'mudanca_status',
        'Status alterado de ' || OLD.status || ' para ' || NEW.status,
        OLD.status::text, NEW.status::text, v_autor);
    END IF;
    IF OLD.responsavel_id IS DISTINCT FROM NEW.responsavel_id THEN
      INSERT INTO public.solicitacao_historico(solicitacao_id, tipo, descricao, autor)
      VALUES (NEW.id, 'mudanca_responsavel',
        'Responsável alterado de ' || COALESCE(OLD.responsavel_nome,'(ninguém)') ||
        ' para ' || COALESCE(NEW.responsavel_nome,'(ninguém)'), v_autor);
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER solicitacoes_log_status
AFTER INSERT OR UPDATE ON public.solicitacoes
FOR EACH ROW EXECUTE FUNCTION public.log_solicitacao_status_change();

-- Bucket de anexos
INSERT INTO storage.buckets (id, name, public) VALUES ('solicitacao-anexos','solicitacao-anexos', false);

CREATE POLICY "sol anexos read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'solicitacao-anexos' AND public.can_read(auth.uid()));

CREATE POLICY "sol anexos insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'solicitacao-anexos' AND public.can_write(auth.uid()));

CREATE POLICY "sol anexos update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'solicitacao-anexos' AND public.can_write(auth.uid()))
  WITH CHECK (bucket_id = 'solicitacao-anexos' AND public.can_write(auth.uid()));

CREATE POLICY "sol anexos delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'solicitacao-anexos' AND public.is_admin(auth.uid()));
