-- Civic Pulse baseline schema. Roles are assigned only by trusted administrators.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 username text not null unique,
 full_name text not null,
 avatar_url text,
 is_admin boolean not null default false,
 is_official boolean not null default false,
 issues_reported integer not null default 0 check (issues_reported >= 0),
 issues_voted integer not null default 0 check (issues_voted >= 0)
);
create table public.issues (
 id uuid primary key default gen_random_uuid(),
 title text not null, description text not null, category text not null,
 status text not null default 'reported' check (status in ('reported','new','unverified','verified','in_progress','resolved','fake')),
 location text not null, area text not null default '',
 coordinates point not null,
 votes integer not null default 0 check (votes >= 0),
 image_url text, media_url text,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(), time_uploaded timestamptz not null default now(),
 severity smallint not null default 3 check (severity between 1 and 5),
 resolved_at timestamptz, resolved_by uuid references public.profiles(id) on delete set null,
 blockchain_hash text
);
create table public.votes (
 id uuid primary key default gen_random_uuid(),
 issue_id uuid not null references public.issues(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 constraint votes_one_per_user_per_issue unique(issue_id,user_id)
);
create table public.comments (
 id uuid primary key default gen_random_uuid(),
 issue_id uuid references public.issues(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete set null,
 comment_text text not null, created_at timestamptz default now()
);
create table public.issue_updates (
 id uuid primary key default gen_random_uuid(),
 issue_id uuid references public.issues(id) on delete cascade,
 status text, update_description text, updated_at timestamptz default now(),
 updated_by uuid references public.profiles(id) on delete set null,
 user_id uuid references public.profiles(id) on delete set null
);
create table public.ai_analyses (
 id uuid primary key default gen_random_uuid(),
 issue_id uuid not null references public.issues(id) on delete cascade,
 alternative_categories jsonb, assigned_departments text[], category_confidence double precision,
 created_at timestamptz not null default now(), detected_patterns jsonb,
 duplicate_score double precision, estimated_response_time double precision,
 extracted_keywords text[], impact_assessment text, predicted_category text,
 priority_score double precision not null default 0, resource_requirements jsonb,
 seasonal_factors jsonb, similar_issue_ids text[], similarity_scores jsonb,
 trend_indicators jsonb, urgency_level text
);
create table public.issue_trends (
 id uuid primary key default gen_random_uuid(), area text, avg_resolution_time double precision,
 category text, created_at timestamptz not null default now(), hotspot_coordinates jsonb,
 issue_count integer not null default 0 check (issue_count >= 0), trend_data jsonb,
 trend_period text not null
);

create index issues_created_at_idx on public.issues(created_at desc);
create index issues_area_idx on public.issues(area);
create index issues_category_idx on public.issues(category);
create index issues_status_idx on public.issues(status);
create index issues_user_id_idx on public.issues(user_id);
create index votes_issue_id_idx on public.votes(issue_id);
create index comments_issue_id_idx on public.comments(issue_id);
create index issue_updates_issue_id_idx on public.issue_updates(issue_id);
create index ai_analyses_issue_id_idx on public.ai_analyses(issue_id);
create index profiles_is_official_idx on public.profiles(is_official) where is_official = true;

create function public.update_updated_at_column() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := pg_catalog.now(); return new; end; $$;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.update_updated_at_column();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_username text; v_full_name text;
begin
 v_username := coalesce(nullif(new.raw_user_meta_data ->> 'username',''),split_part(coalesce(new.email,'user'),'@',1));
 v_full_name := coalesce(nullif(new.raw_user_meta_data ->> 'full_name',''),split_part(coalesce(new.email,'User'),'@',1));
 begin
  insert into public.profiles(id,username,full_name) values(new.id,v_username,v_full_name) on conflict(id) do nothing;
 exception when unique_violation then
  insert into public.profiles(id,username,full_name) values(new.id,v_username || '_' || substr(new.id::text,1,8),v_full_name) on conflict(id) do nothing;
 end;
 return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_admin is true); $$;
create function private.is_official() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_official is true); $$;
create function private.is_staff() returns boolean language sql stable security definer set search_path = '' as $$
 select private.is_admin() or private.is_official(); $$;
create function private.set_user_role(target_user_id uuid,make_admin boolean,make_official boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not private.is_admin() then raise exception 'Only an administrator can assign roles' using errcode='42501'; end if;
 update public.profiles set is_admin=coalesce(make_admin,false),is_official=coalesce(make_official,false) where id=target_user_id;
 if not found then raise exception 'Profile not found' using errcode='P0002'; end if;
end; $$;
create function public.set_user_role(target_user_id uuid,make_admin boolean,make_official boolean)
returns void language sql security invoker set search_path = '' as $$
 select private.set_user_role(target_user_id,make_admin,make_official); $$;

create function private.sync_issue_vote_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if tg_op='INSERT' then update public.issues set votes=votes+1 where id=new.issue_id; return new;
 elsif tg_op='DELETE' then update public.issues set votes=greatest(votes-1,0) where id=old.issue_id; return old; end if;
 return null;
end; $$;
create trigger votes_update_issue_count after insert or delete on public.votes
for each row execute function private.sync_issue_vote_count();

alter table public.profiles enable row level security;
alter table public.issues enable row level security;
alter table public.votes enable row level security;
alter table public.comments enable row level security;
alter table public.issue_updates enable row level security;
alter table public.ai_analyses enable row level security;
alter table public.issue_trends enable row level security;

create policy profiles_select_authenticated on public.profiles for select to authenticated using(true);
create policy profiles_update_own on public.profiles for update to authenticated using((select auth.uid())=id) with check((select auth.uid())=id);
create policy profiles_update_admin on public.profiles for update to authenticated using((select private.is_admin())) with check((select private.is_admin()));
create policy issues_public_read on public.issues for select to anon,authenticated using(true);
create policy issues_create_own on public.issues for insert to authenticated with check((select auth.uid())=user_id);
create policy issues_update_staff on public.issues for update to authenticated using((select private.is_staff())) with check((select private.is_staff()));
create policy issues_delete_admin on public.issues for delete to authenticated using((select private.is_admin()));
create policy votes_read_own on public.votes for select to authenticated using((select auth.uid())=user_id);
create policy votes_create_own on public.votes for insert to authenticated with check((select auth.uid())=user_id);
create policy comments_read_authenticated on public.comments for select to authenticated using(true);
create policy comments_create_own on public.comments for insert to authenticated with check((select auth.uid())=user_id);
create policy comments_delete_own_or_admin on public.comments for delete to authenticated using((select auth.uid())=user_id or (select private.is_admin()));
create policy issue_updates_public_read on public.issue_updates for select to anon,authenticated using(true);
create policy issue_updates_create_staff on public.issue_updates for insert to authenticated with check((select private.is_staff()));
create policy issue_updates_update_staff on public.issue_updates for update to authenticated using((select private.is_staff())) with check((select private.is_staff()));
create policy ai_analyses_read_authenticated on public.ai_analyses for select to authenticated using(true);
create policy issue_trends_public_read on public.issue_trends for select to anon,authenticated using(true);

revoke all on table public.profiles,public.issues,public.votes,public.comments,public.issue_updates,public.ai_analyses,public.issue_trends from anon,authenticated;
grant usage on schema public to anon,authenticated,service_role;
grant select on public.issues,public.issue_updates,public.issue_trends to anon;
grant select on public.profiles,public.issues,public.votes,public.comments,public.issue_updates,public.ai_analyses,public.issue_trends to authenticated;
grant insert on public.issues,public.votes,public.comments,public.issue_updates to authenticated;
grant update,delete on public.issues to authenticated;
grant update on public.issue_updates to authenticated;
grant update(username,full_name,avatar_url) on public.profiles to authenticated;
grant execute on function public.set_user_role(uuid,boolean,boolean) to authenticated;
revoke all on function private.is_admin() from public,anon;
revoke all on function private.is_official() from public,anon;
revoke all on function private.is_staff() from public,anon;
revoke all on function private.set_user_role(uuid,boolean,boolean) from public,anon;
revoke all on function private.sync_issue_vote_count() from public,anon,authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_official() to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.set_user_role(uuid,boolean,boolean) to authenticated;
revoke all on function public.set_user_role(uuid,boolean,boolean) from public,anon;
grant execute on function public.set_user_role(uuid,boolean,boolean) to authenticated;
grant all privileges on all tables in schema public to service_role;

do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')
 and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='issues') then
  alter publication supabase_realtime add table public.issues;
 end if;
end; $$;
