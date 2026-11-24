CREATE TABLE IF NOT EXISTS public.estoque_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  unidade text NOT NULL DEFAULT 'un',
  quantidade integer NOT NULL DEFAULT 0,
  minimo integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.estoque_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.estoque_itens(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida','ajuste')),
  quantidade integer NOT NULL,
  observacao text,
  user_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_itens, public.estoque_movimentos TO authenticated;
GRANT ALL ON public.estoque_itens, public.estoque_movimentos TO service_role;
ALTER TABLE public.estoque_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_movimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "estoque itens ler" ON public.estoque_itens;
DROP POLICY IF EXISTS "estoque itens gravar" ON public.estoque_itens;
DROP POLICY IF EXISTS "estoque mov ler" ON public.estoque_movimentos;
DROP POLICY IF EXISTS "estoque mov gravar" ON public.estoque_movimentos;
CREATE POLICY "estoque itens ler" ON public.estoque_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "estoque itens gravar" ON public.estoque_itens FOR ALL TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "estoque mov ler" ON public.estoque_movimentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "estoque mov gravar" ON public.estoque_movimentos FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));

-- Movimento atualiza o saldo automaticamente
CREATE OR REPLACE FUNCTION public.estoque_aplicar_movimento() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE novo integer;
BEGIN
  IF NEW.tipo = 'ajuste' THEN
    UPDATE estoque_itens SET quantidade = NEW.quantidade, updated_at = now() WHERE id = NEW.item_id RETURNING quantidade INTO novo;
  ELSE
    IF NEW.quantidade <= 0 THEN RAISE EXCEPTION 'Quantidade deve ser maior que zero'; END IF;
    UPDATE estoque_itens SET quantidade = quantidade + CASE WHEN NEW.tipo='entrada' THEN NEW.quantidade ELSE -NEW.quantidade END,
      updated_at = now() WHERE id = NEW.item_id RETURNING quantidade INTO novo;
    IF novo < 0 THEN RAISE EXCEPTION 'Estoque insuficiente para essa saída'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_estoque_mov ON public.estoque_movimentos;
CREATE TRIGGER trg_estoque_mov AFTER INSERT ON public.estoque_movimentos FOR EACH ROW EXECUTE FUNCTION public.estoque_aplicar_movimento();

INSERT INTO public.estoque_itens (nome, quantidade) VALUES
 ('BAPES',0),('OLHAL',0),('PARAFUSO J',0),('SUPORTE SUCO',0),('SAPATILHA',0),
 ('ALÇAS AS120',0),('ALÇAS AS80',0),('CAIXA DE EMENDA',18)
ON CONFLICT (nome) DO NOTHING;
