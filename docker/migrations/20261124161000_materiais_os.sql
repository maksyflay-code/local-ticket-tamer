-- Requer 20261124150000_estoque.sql. A baixa e o histórico são uma transação.
ALTER TABLE public.estoque_itens ADD CONSTRAINT estoque_saldo_valido CHECK (quantidade >= 0 AND minimo >= 0);
ALTER TABLE public.estoque_movimentos ADD COLUMN solicitacao_id uuid REFERENCES public.solicitacoes(id) ON DELETE RESTRICT;
ALTER TABLE public.estoque_movimentos ADD COLUMN operacao_id uuid;
ALTER TABLE public.estoque_movimentos ADD CONSTRAINT estoque_mov_quantidade_valida CHECK (
  (tipo = 'ajuste' AND quantidade >= 0) OR (tipo IN ('entrada', 'saida') AND quantidade > 0)
);
ALTER TABLE public.estoque_movimentos DROP CONSTRAINT estoque_movimentos_item_id_fkey;
ALTER TABLE public.estoque_movimentos ADD CONSTRAINT estoque_movimentos_item_id_fkey
  FOREIGN KEY (item_id) REFERENCES public.estoque_itens(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX estoque_operacao_item ON public.estoque_movimentos(operacao_id, item_id) WHERE operacao_id IS NOT NULL;
CREATE INDEX estoque_mov_os ON public.estoque_movimentos(solicitacao_id, created_at);

DROP POLICY IF EXISTS "estoque mov gravar" ON public.estoque_movimentos;
CREATE POLICY "estoque mov gravar" ON public.estoque_movimentos FOR INSERT TO authenticated
  WITH CHECK (public.can_write(auth.uid()) AND user_id = auth.uid() AND solicitacao_id IS NULL AND operacao_id IS NULL);
GRANT SELECT, INSERT ON public.estoque_movimentos TO authenticated;
REVOKE UPDATE, DELETE ON public.estoque_movimentos FROM authenticated;
GRANT ALL ON public.estoque_itens, public.estoque_movimentos TO service_role;
GRANT EXECUTE ON FUNCTION public.can_write(uuid), public.can_read(uuid) TO authenticated;

-- Ignora um proprietário fornecido pelo chamador: a sessão determina o autor.
CREATE OR REPLACE FUNCTION public.estoque_autor_sessao() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN NEW.user_id := auth.uid(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER estoque_autor BEFORE INSERT ON public.estoque_movimentos
  FOR EACH ROW EXECUTE FUNCTION public.estoque_autor_sessao();

CREATE OR REPLACE FUNCTION public.registrar_materiais_os(
  p_solicitacao_id uuid, p_operacao_id uuid, p_materiais jsonb, p_observacao text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_os public.solicitacoes%ROWTYPE;
  v_item record;
  v_nome text;
  v_saldo integer;
  v_count integer := 0;
  v_autor uuid := auth.uid();
  v_email text;
BEGIN
  IF v_autor IS NULL OR NOT public.can_write(v_autor) THEN
    RAISE EXCEPTION 'Sem permissão para baixar materiais' USING ERRCODE = '42501';
  END IF;
  IF p_operacao_id IS NULL THEN RAISE EXCEPTION 'Identificador de operação obrigatório'; END IF;
  SELECT * INTO v_os FROM public.solicitacoes WHERE id = p_solicitacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OS não encontrada'; END IF;
  SELECT count(*) INTO v_count FROM public.estoque_movimentos WHERE operacao_id = p_operacao_id
    AND solicitacao_id = p_solicitacao_id AND user_id = v_autor;
  IF v_count > 0 THEN RETURN v_count; END IF;
  IF EXISTS (SELECT 1 FROM public.estoque_movimentos WHERE operacao_id = p_operacao_id) THEN
    RAISE EXCEPTION 'Identificador de operação já utilizado';
  END IF;
  IF v_os.status IN ('concluida', 'cancelada') THEN RAISE EXCEPTION 'OS encerrada não permite baixa'; END IF;
  IF jsonb_typeof(p_materiais) IS DISTINCT FROM 'array' OR jsonb_array_length(p_materiais) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos um material';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_materiais) m WHERE
    m->>'item_id' IS NULL OR jsonb_typeof(m->'quantidade') IS DISTINCT FROM 'number'
    OR (m->>'quantidade')::numeric <= 0 OR (m->>'quantidade')::numeric <> trunc((m->>'quantidade')::numeric)) THEN
    RAISE EXCEPTION 'Informe quantidades inteiras maiores que zero';
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_autor;
  v_count := 0;
  FOR v_item IN SELECT (m->>'item_id')::uuid AS id, sum((m->>'quantidade')::integer)::integer AS qtd
    FROM jsonb_array_elements(p_materiais) m GROUP BY (m->>'item_id')::uuid ORDER BY (m->>'item_id')::uuid
  LOOP
    SELECT nome, quantidade INTO v_nome, v_saldo FROM public.estoque_itens WHERE id = v_item.id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Material não encontrado'; END IF;
    IF v_saldo < v_item.qtd THEN RAISE EXCEPTION 'Estoque insuficiente: % (saldo %, solicitado %)', v_nome, v_saldo, v_item.qtd; END IF;
    INSERT INTO public.estoque_movimentos(item_id, tipo, quantidade, observacao, user_id, solicitacao_id, operacao_id)
      VALUES(v_item.id, 'saida', v_item.qtd, format('OS #%s · %s · %s', v_os.numero, v_nome, coalesce(p_observacao, 'Material utilizado')), v_autor, v_os.id, p_operacao_id);
    INSERT INTO public.solicitacao_historico(solicitacao_id, tipo, descricao, autor)
      VALUES(v_os.id, 'material', format('%s × %s baixado do estoque. %s', v_item.qtd, v_nome, coalesce(p_observacao, '')), v_email);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.registrar_materiais_os(uuid, uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_materiais_os(uuid, uuid, jsonb, text) TO authenticated;
NOTIFY pgrst, 'reload schema';