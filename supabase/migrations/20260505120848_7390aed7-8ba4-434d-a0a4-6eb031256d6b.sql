
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'maksyflay@ivitelecom.com.br', crypt('mimoso30M$', gen_salt('bf')),
  now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}',
  '', '', '', ''
);
