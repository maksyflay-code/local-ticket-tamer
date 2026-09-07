CREATE TABLE IF NOT EXISTS public.server_function_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  message text NOT NULL,
  function_name text,
  route text,
  deploy_url text,
  app_version text,
  build_id text,
  build_time text,
  user_agent text,
  client_timestamp timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.server_function_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create own server function failures" ON public.server_function_failures;
CREATE POLICY "Users can create own server function failures"
ON public.server_function_failures
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view server function failures" ON public.server_function_failures;
CREATE POLICY "Admins can view server function failures"
ON public.server_function_failures
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update server function failures" ON public.server_function_failures;
CREATE POLICY "Admins can update server function failures"
ON public.server_function_failures
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_server_function_failures_created_at
ON public.server_function_failures (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_server_function_failures_build
ON public.server_function_failures (build_id, app_version, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_server_function_failures_message
ON public.server_function_failures (message);