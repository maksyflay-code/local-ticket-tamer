
-- Tabela de Planos
CREATE TABLE public.planos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  velocidade_download INTEGER,
  velocidade_upload INTEGER,
  preco NUMERIC(10,2) NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL DEFAULT 'residencial',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users full access planos"
ON public.planos FOR ALL
TO authenticated
USING (true) WITH CHECK (true);

CREATE TRIGGER planos_set_updated_at
BEFORE UPDATE ON public.planos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Vincular cliente a plano (mantém coluna texto antiga para compat)
ALTER TABLE public.clientes
  ADD COLUMN plano_id UUID REFERENCES public.planos(id) ON DELETE SET NULL,
  ADD COLUMN data_contrato DATE;

-- Histórico de chamados
CREATE TABLE public.chamado_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chamado_id UUID NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'comentario',
  descricao TEXT NOT NULL,
  autor TEXT,
  status_anterior TEXT,
  status_novo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chamado_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users full access chamado_historico"
ON public.chamado_historico FOR ALL
TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX idx_historico_chamado ON public.chamado_historico(chamado_id, created_at DESC);

-- Anexos de chamados
CREATE TABLE public.chamado_anexos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chamado_id UUID NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  tamanho INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chamado_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users full access chamado_anexos"
ON public.chamado_anexos FOR ALL
TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX idx_anexos_chamado ON public.chamado_anexos(chamado_id);

-- Bucket de anexos
INSERT INTO storage.buckets (id, name, public)
VALUES ('chamado-anexos', 'chamado-anexos', false);

CREATE POLICY "auth read chamado anexos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chamado-anexos');

CREATE POLICY "auth upload chamado anexos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chamado-anexos');

CREATE POLICY "auth delete chamado anexos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chamado-anexos');

-- Trigger: registrar histórico automaticamente em mudanças de status
CREATE OR REPLACE FUNCTION public.log_chamado_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.chamado_historico(chamado_id, tipo, descricao, status_novo)
    VALUES (NEW.id, 'criacao', 'Chamado criado', NEW.status::text);
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.chamado_historico(chamado_id, tipo, descricao, status_anterior, status_novo)
    VALUES (NEW.id, 'mudanca_status',
      'Status alterado de ' || OLD.status || ' para ' || NEW.status,
      OLD.status::text, NEW.status::text);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER chamados_log_status
AFTER INSERT OR UPDATE OF status ON public.chamados
FOR EACH ROW EXECUTE FUNCTION public.log_chamado_status_change();
