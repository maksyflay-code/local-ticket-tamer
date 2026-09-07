
-- Roles enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'operador', 'visualizador');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.can_write(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','operador'))
$$;

CREATE OR REPLACE FUNCTION public.can_read(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

-- user_roles policies
DROP POLICY IF EXISTS "user_roles select self or admin" ON public.user_roles;
CREATE POLICY "user_roles select self or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "user_roles admin insert" ON public.user_roles;
CREATE POLICY "user_roles admin insert" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "user_roles admin update" ON public.user_roles;
CREATE POLICY "user_roles admin update" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "user_roles admin delete" ON public.user_roles;
CREATE POLICY "user_roles admin delete" ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Update business policies: clientes
DROP POLICY IF EXISTS "clientes select" ON public.clientes;
DROP POLICY IF EXISTS "clientes insert" ON public.clientes;
DROP POLICY IF EXISTS "clientes update" ON public.clientes;
DROP POLICY IF EXISTS "clientes delete" ON public.clientes;
CREATE POLICY "clientes select" ON public.clientes FOR SELECT TO authenticated USING (public.can_read(auth.uid()));
CREATE POLICY "clientes insert" ON public.clientes FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "clientes update" ON public.clientes FOR UPDATE TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "clientes delete" ON public.clientes FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- planos
DROP POLICY IF EXISTS "planos select" ON public.planos;
DROP POLICY IF EXISTS "planos insert" ON public.planos;
DROP POLICY IF EXISTS "planos update" ON public.planos;
DROP POLICY IF EXISTS "planos delete" ON public.planos;
CREATE POLICY "planos select" ON public.planos FOR SELECT TO authenticated USING (public.can_read(auth.uid()));
CREATE POLICY "planos insert" ON public.planos FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "planos update" ON public.planos FOR UPDATE TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "planos delete" ON public.planos FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- chamados
DROP POLICY IF EXISTS "chamados select" ON public.chamados;
DROP POLICY IF EXISTS "chamados insert" ON public.chamados;
DROP POLICY IF EXISTS "chamados update" ON public.chamados;
DROP POLICY IF EXISTS "chamados delete" ON public.chamados;
CREATE POLICY "chamados select" ON public.chamados FOR SELECT TO authenticated USING (public.can_read(auth.uid()));
CREATE POLICY "chamados insert" ON public.chamados FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "chamados update" ON public.chamados FOR UPDATE TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "chamados delete" ON public.chamados FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- chamado_historico
DROP POLICY IF EXISTS "historico select" ON public.chamado_historico;
DROP POLICY IF EXISTS "historico insert" ON public.chamado_historico;
DROP POLICY IF EXISTS "historico update" ON public.chamado_historico;
DROP POLICY IF EXISTS "historico delete" ON public.chamado_historico;
CREATE POLICY "historico select" ON public.chamado_historico FOR SELECT TO authenticated USING (public.can_read(auth.uid()));
CREATE POLICY "historico insert" ON public.chamado_historico FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "historico update" ON public.chamado_historico FOR UPDATE TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "historico delete" ON public.chamado_historico FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- chamado_anexos
DROP POLICY IF EXISTS "anexos select" ON public.chamado_anexos;
DROP POLICY IF EXISTS "anexos insert" ON public.chamado_anexos;
DROP POLICY IF EXISTS "anexos update" ON public.chamado_anexos;
DROP POLICY IF EXISTS "anexos delete" ON public.chamado_anexos;
CREATE POLICY "anexos select" ON public.chamado_anexos FOR SELECT TO authenticated USING (public.can_read(auth.uid()));
CREATE POLICY "anexos insert" ON public.chamado_anexos FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "anexos update" ON public.chamado_anexos FOR UPDATE TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "anexos delete" ON public.chamado_anexos FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Seed first admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'maksyflay@ivitelecom.com.br'
ON CONFLICT (user_id, role) DO NOTHING;
