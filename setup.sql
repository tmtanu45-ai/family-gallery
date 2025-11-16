-- setup.sql

-- 1. Create activity log table
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  object_path text,
  created_at timestamptz default now()
);

grant select, insert on public.activity_logs to authenticated;

-- 2. Ensure storage schema exists (it will in Supabase)
-- Create buckets (you can also create them via the dashboard)
select
  storage.create_bucket('private_photos', true) -- private
  where not exists (select 1 from storage.buckets where id = 'private_photos');

select
  storage.create_bucket('public_photos', false) -- public for thumbnails
  where not exists (select 1 from storage.buckets where id = 'public_photos');

select
  storage.create_bucket('trash_photos', true)
  where not exists (select 1 from storage.buckets where id = 'trash_photos');


-- 3. Enable RLS on storage.objects
-- NOTE: Supabase's storage.objects is a managed table. Enabling RLS and applying policies is standard.
alter table if exists storage.objects enable row level security;

-- 4. Policies for INSERT: require metadata->>'user_id' = auth.uid()
create policy if not exists "Allow insert only when metadata user_id matches authenticated user"
  on storage.objects
  for insert
  with check (
    auth.role() = 'authenticated'
    and ( (metadata->> 'user_id') = auth.uid() )
  );

-- 5. Policies for SELECT: allow if:
--  - bucket_id = 'public_photos' OR
--  - metadata->>'user_id' = auth.uid() OR
--  - auth.role() = 'service_role' (service role can bypass)
create policy if not exists "Allow select owner or public bucket"
  on storage.objects
  for select
  using (
    auth.role() = 'authenticated' and (
      bucket_id = 'public_photos'
      or (metadata->> 'user_id') = auth.uid()
    )
  );

-- 6. Policies for DELETE and UPDATE: require owner or admin
create policy if not exists "Allow delete/update owner or admin"
  on storage.objects
  for delete, update
  using (
    auth.role() = 'authenticated' and (
      (metadata->> 'user_id') = auth.uid()
      or (auth.jwt() ->> 'role') = 'admin' -- if you assign admin role in JWT custom claims
    )
  );

-- 7. Grant insert/select on activity_logs to authenticated role
grant insert on public.activity_logs to authenticated;
grant select on public.activity_logs to authenticated;

-- 8. Optional: create a view to make listing user files easier (owner files)
create or replace view public.user_files as
select id, name, bucket_id, metadata, updated_at, created_at
from storage.objects
where (metadata->>'user_id') = auth.uid();

-- 9. Example trigger: none required; client will call RPC to record logs.

-- NOTE / REMINDER:
-- Many Supabase-managed tables and functions exist in the "storage" schema; policies must be created in SQL Editor.
-- If you use custom JWT claims (e.g., is_admin or role), set them when generating user tokens on signup or via serveral admin endpoints.
