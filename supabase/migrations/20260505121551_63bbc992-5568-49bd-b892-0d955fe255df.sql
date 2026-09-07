
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_write(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_read(uuid) FROM anon, authenticated, public;
