CREATE OR REPLACE FUNCTION public.log_chamado_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_autor text;
BEGIN
  SELECT email INTO v_autor FROM auth.users WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.chamado_historico(chamado_id, tipo, descricao, status_novo, autor)
    VALUES (NEW.id, 'criacao', 'Chamado criado', NEW.status::text, v_autor);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.chamado_historico(chamado_id, tipo, descricao, status_anterior, status_novo, autor)
      VALUES (NEW.id, 'mudanca_status',
        'Status alterado de ' || OLD.status || ' para ' || NEW.status,
        OLD.status::text, NEW.status::text, v_autor);
    END IF;
    IF OLD.prioridade IS DISTINCT FROM NEW.prioridade THEN
      INSERT INTO public.chamado_historico(chamado_id, tipo, descricao, autor)
      VALUES (NEW.id, 'mudanca_prioridade',
        'Prioridade alterada de ' || OLD.prioridade || ' para ' || NEW.prioridade, v_autor);
    END IF;
    IF OLD.responsavel_id IS DISTINCT FROM NEW.responsavel_id THEN
      INSERT INTO public.chamado_historico(chamado_id, tipo, descricao, autor)
      VALUES (NEW.id, 'mudanca_responsavel',
        'Responsável alterado de ' || COALESCE(OLD.tecnico_responsavel,'(ninguém)') ||
        ' para ' || COALESCE(NEW.tecnico_responsavel,'(ninguém)'), v_autor);
    END IF;
  END IF;
  RETURN NEW;
END $function$;
