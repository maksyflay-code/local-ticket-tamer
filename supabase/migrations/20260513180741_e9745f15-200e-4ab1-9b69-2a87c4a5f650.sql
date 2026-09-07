
CREATE TABLE public.equipamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hostname text NOT NULL,
  ipv4 text NOT NULL,
  tipo text NOT NULL DEFAULT 'Switch L3',
  fabricante text NOT NULL DEFAULT 'DATACOM - DmOS',
  pop text,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX equipamentos_hostname_uniq ON public.equipamentos (lower(hostname));
CREATE INDEX equipamentos_ipv4_idx ON public.equipamentos (ipv4);

ALTER TABLE public.equipamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipamentos select" ON public.equipamentos FOR SELECT TO authenticated USING (can_read(auth.uid()));
CREATE POLICY "equipamentos insert" ON public.equipamentos FOR INSERT TO authenticated WITH CHECK (can_write(auth.uid()));
CREATE POLICY "equipamentos update" ON public.equipamentos FOR UPDATE TO authenticated USING (can_write(auth.uid())) WITH CHECK (can_write(auth.uid()));
CREATE POLICY "equipamentos delete" ON public.equipamentos FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER equipamentos_set_updated_at BEFORE UPDATE ON public.equipamentos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
