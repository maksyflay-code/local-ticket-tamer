
-- Recreate policies without USING(true) / WITH CHECK(true)
DROP POLICY IF EXISTS "auth users full access clientes" ON public.clientes;
DROP POLICY IF EXISTS "auth users full access chamados" ON public.chamados;
DROP POLICY IF EXISTS "auth users full access planos" ON public.planos;
DROP POLICY IF EXISTS "auth users full access chamado_historico" ON public.chamado_historico;
DROP POLICY IF EXISTS "auth users full access chamado_anexos" ON public.chamado_anexos;

-- clientes
CREATE POLICY "clientes select" ON public.clientes FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "clientes insert" ON public.clientes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "clientes update" ON public.clientes FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "clientes delete" ON public.clientes FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- chamados
CREATE POLICY "chamados select" ON public.chamados FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "chamados insert" ON public.chamados FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "chamados update" ON public.chamados FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "chamados delete" ON public.chamados FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- planos
CREATE POLICY "planos select" ON public.planos FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "planos insert" ON public.planos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "planos update" ON public.planos FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "planos delete" ON public.planos FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- historico
CREATE POLICY "historico select" ON public.chamado_historico FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "historico insert" ON public.chamado_historico FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "historico update" ON public.chamado_historico FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "historico delete" ON public.chamado_historico FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- anexos
CREATE POLICY "anexos select" ON public.chamado_anexos FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "anexos insert" ON public.chamado_anexos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "anexos update" ON public.chamado_anexos FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "anexos delete" ON public.chamado_anexos FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
