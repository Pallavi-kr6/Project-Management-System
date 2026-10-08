-- RLS / schema tests. Run via: npm run test:rls   (needs a local PostgreSQL)
-- Everything happens in one transaction that is rolled back at the end.
\set ON_ERROR_STOP on
begin;

create schema tap;
grant usage on schema tap to anon, authenticated;

create function tap.eq(label text, actual bigint, expected bigint) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL: % (expected %, got %)', label, expected, actual;
  end if;
  raise notice 'ok   - %', label;
end $$;
grant execute on function tap.eq(text, bigint, bigint) to anon, authenticated;

-- two users; the on_auth_user_created trigger must create their profiles
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'alice@example.test', '{"full_name":"Alice Test"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bob@example.test',   '{}');
select tap.eq('profiles are created by trigger', (select count(*) from public.profiles), 2);
select tap.eq('full_name comes from metadata', (select count(*) from public.profiles where full_name = 'Alice Test'), 1);
select tap.eq('full_name falls back to email prefix', (select count(*) from public.profiles where full_name = 'bob'), 1);

-- ---------------------------------------------------------------- Alice
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}', true);

insert into public.projects (id, owner_id, name, status)
  values ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alice Project', 'In Progress');
insert into public.tasks (id, project_id, name, status)
  values ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Alice Task', 'Completed'),
         ('a2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Alice Task 2', 'Pending');

select tap.eq('alice sees her project', (select count(*) from public.projects), 1);
select tap.eq('alice sees her tasks', (select count(*) from public.tasks), 2);
select tap.eq('projects_with_stats total_tasks', (select total_tasks from public.projects_with_stats), 2);
select tap.eq('projects_with_stats completed_tasks', (select completed_tasks from public.projects_with_stats), 1);
select tap.eq('dashboard totalProjects (alice)', ((public.get_dashboard_stats() ->> 'totalProjects')::bigint), 1);
select tap.eq('dashboard totalTasks (alice)', ((public.get_dashboard_stats() ->> 'totalTasks')::bigint), 2);
select tap.eq('dashboard completed tasks (alice)', ((public.get_dashboard_stats() -> 'tasksByStatus' ->> 'Completed')::bigint), 1);

do $$ begin  -- cannot create a project owned by someone else
  begin
    insert into public.projects (owner_id, name) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Forged');
    raise exception 'FAIL: alice created a project for bob';
  exception when insufficient_privilege then raise notice 'ok   - cannot insert project owned by another user'; end;
end $$;

do $$ begin  -- invalid enum value rejected by CHECK
  begin
    insert into public.projects (owner_id, name, status) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bad', 'Archived');
    raise exception 'FAIL: invalid status accepted';
  exception when check_violation then raise notice 'ok   - invalid project status rejected'; end;
end $$;

do $$ begin  -- end date before start date rejected
  begin
    insert into public.projects (owner_id, name, start_date, end_date)
      values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bad dates', '2026-02-01', '2026-01-01');
    raise exception 'FAIL: invalid date order accepted';
  exception when check_violation then raise notice 'ok   - end_date < start_date rejected'; end;
end $$;

do $$ begin  -- blank names rejected
  begin
    insert into public.tasks (project_id, name) values ('a1000000-0000-0000-0000-000000000001', '   ');
    raise exception 'FAIL: blank task name accepted';
  exception when check_violation then raise notice 'ok   - blank task name rejected'; end;
end $$;

-- ---------------------------------------------------------------- Bob
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}', true);
insert into public.projects (id, owner_id, name)
  values ('b1000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Bob Project');

select tap.eq('bob sees only his project', (select count(*) from public.projects), 1);
select tap.eq('bob cannot read alice project by id', (select count(*) from public.projects where id = 'a1000000-0000-0000-0000-000000000001'), 0);
select tap.eq('bob sees no tasks', (select count(*) from public.tasks), 0);
select tap.eq('bob cannot read alice task by id', (select count(*) from public.tasks where id = 'a2000000-0000-0000-0000-000000000001'), 0);
select tap.eq('bob sees no other profiles', (select count(*) from public.profiles where id <> 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0);
select tap.eq('dashboard totalProjects (bob)', ((public.get_dashboard_stats() ->> 'totalProjects')::bigint), 1);
select tap.eq('dashboard totalTasks (bob)', ((public.get_dashboard_stats() ->> 'totalTasks')::bigint), 0);

with u as (update public.projects set name = 'Hacked' where id = 'a1000000-0000-0000-0000-000000000001' returning 1)
  select tap.eq('bob cannot update alice project (0 rows)', (select count(*) from u), 0);
with d as (delete from public.projects where id = 'a1000000-0000-0000-0000-000000000001' returning 1)
  select tap.eq('bob cannot delete alice project (0 rows)', (select count(*) from d), 0);
with u as (update public.tasks set name = 'Hacked' where id = 'a2000000-0000-0000-0000-000000000001' returning 1)
  select tap.eq('bob cannot update alice task (0 rows)', (select count(*) from u), 0);
with d as (delete from public.tasks where id = 'a2000000-0000-0000-0000-000000000001' returning 1)
  select tap.eq('bob cannot delete alice task (0 rows)', (select count(*) from d), 0);

do $$ begin  -- cannot add a task to someone else's project
  begin
    insert into public.tasks (project_id, name) values ('a1000000-0000-0000-0000-000000000001', 'Injected');
    raise exception 'FAIL: bob inserted a task into alice project';
  exception when insufficient_privilege then raise notice 'ok   - cannot insert task into another user''s project'; end;
end $$;

do $$ begin  -- cannot steal a project by changing owner_id
  begin
    update public.projects set owner_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' where id = 'b1000000-0000-0000-0000-000000000001';
    raise exception 'FAIL: bob reassigned his project to alice';
  exception when insufficient_privilege then raise notice 'ok   - cannot change project owner_id to another user'; end;
end $$;

-- ---------------------------------------------------------------- Alice again
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}', true);
do $$ begin  -- cannot move own task into someone else's project
  begin
    update public.tasks set project_id = 'b1000000-0000-0000-0000-000000000001'
     where id = 'a2000000-0000-0000-0000-000000000001';
    raise exception 'FAIL: alice moved a task into bob project';
  exception when insufficient_privilege then raise notice 'ok   - cannot move a task into another user''s project'; end;
end $$;

select tap.eq('alice project untouched by bob', (select count(*) from public.projects where name = 'Alice Project'), 1);

-- deleting a project cascades to its tasks
delete from public.projects where id = 'a1000000-0000-0000-0000-000000000001';
select tap.eq('tasks cascade-deleted with project', (select count(*) from public.tasks), 0);

-- ---------------------------------------------------------------- anonymous
reset role;
set local role anon;
do $$ begin
  begin
    perform count(*) from public.projects;
    raise exception 'FAIL: anon could query projects';
  exception when insufficient_privilege then raise notice 'ok   - anon role has no access to projects'; end;
end $$;
do $$ begin
  begin
    perform public.get_dashboard_stats();
    raise exception 'FAIL: anon could execute get_dashboard_stats';
  exception when insufficient_privilege then raise notice 'ok   - anon cannot execute get_dashboard_stats'; end;
end $$;

reset role;
rollback;
\echo 'ALL RLS TESTS PASSED'
