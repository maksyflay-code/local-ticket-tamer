
-- 1) Replace overly permissive storage policies for chamado-anexos bucket
DROP POLICY IF EXISTS "auth read chamado anexos" ON storage.objects;
DROP POLICY IF EXISTS "auth upload chamado anexos" ON storage.objects;
DROP POLICY IF EXISTS "auth delete chamado anexos" ON storage.objects;

CREATE POLICY "read chamado anexos by role"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'chamado-anexos' AND public.can_read(auth.uid()));

CREATE POLICY "upload chamado anexos by role"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chamado-anexos' AND public.can_write(auth.uid()));

CREATE POLICY "delete chamado anexos by admin"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'chamado-anexos' AND public.is_admin(auth.uid()));

-- 2) Restrict Realtime subscriptions to users with an assigned role
CREATE POLICY "realtime subscribe by role"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.can_read(auth.uid()));

-- 3) Pin search_path on remaining functions
ALTER FUNCTION public.handle_sla_pause() SET search_path = public;

-- 4) Defense-in-depth: revoke EXECUTE on SECURITY DEFINER helpers from public/anon.
-- They remain callable by `authenticated` (RLS still works) and `service_role`.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_read(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_write(uuid) FROM PUBLIC, anon;
