-- Two test users for the integration run (the trigger creates their profiles).
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'alice@example.test', '{"full_name":"Alice Test"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bob@example.test',   '{"full_name":"Bob Test"}');
