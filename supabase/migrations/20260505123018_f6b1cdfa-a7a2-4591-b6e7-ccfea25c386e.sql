-- Revoke from PUBLIC (segurança), conceder apenas a authenticated
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_write(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read(uuid) TO authenticated;

-- Garantir papel admin para o usuário principal
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'maksyflay@ivitelecom.com.br'
ON CONFLICT (user_id, role) DO NOTHING;
