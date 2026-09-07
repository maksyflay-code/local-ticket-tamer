
CREATE TYPE chamado_status AS ENUM ('aberto', 'em_andamento', 'resolvido', 'fechado');
CREATE TYPE chamado_prioridade AS ENUM ('baixa', 'media', 'alta', 'urgente');
CREATE TYPE cliente_status AS ENUM ('ativo', 'inativo', 'suspenso');

CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  documento TEXT,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  cidade TEXT,
  plano TEXT,
  status cliente_status NOT NULL DEFAULT 'ativo',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.chamados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero SERIAL UNIQUE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT,
  status chamado_status NOT NULL DEFAULT 'aberto',
  prioridade chamado_prioridade NOT NULL DEFAULT 'media',
  tecnico_responsavel TEXT,
  resolvido_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chamados_cliente ON public.chamados(cliente_id);
CREATE INDEX idx_chamados_status ON public.chamados(status);
CREATE INDEX idx_chamados_created ON public.chamados(created_at DESC);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users full access clientes" ON public.clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth users full access chamados" ON public.chamados FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_clientes_updated BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_chamados_updated BEFORE UPDATE ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
