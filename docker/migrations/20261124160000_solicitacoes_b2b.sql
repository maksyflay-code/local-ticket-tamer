ALTER TYPE public.solicitacao_tipo ADD VALUE IF NOT EXISTS 'ativacao';
ALTER TYPE public.solicitacao_tipo ADD VALUE IF NOT EXISTS 'ampliacao';
ALTER TYPE public.solicitacao_tipo ADD VALUE IF NOT EXISTS 'reparo_fibra';
ALTER TYPE public.solicitacao_tipo ADD VALUE IF NOT EXISTS 'configuracao_bgp';
ALTER TYPE public.solicitacao_tipo ADD VALUE IF NOT EXISTS 'conexao_ptt';
ALTER TYPE public.solicitacao_tipo ADD VALUE IF NOT EXISTS 'colocation';
ALTER TYPE public.solicitacao_tipo ADD VALUE IF NOT EXISTS 'protecao_ddos';