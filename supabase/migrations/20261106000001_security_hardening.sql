-- Security hardening and indexes for the Civic Pulse baseline.
revoke all on function public.handle_new_user() from public,anon,authenticated;
create index if not exists comments_user_id_idx on public.comments(user_id);
create index if not exists issue_updates_updated_by_idx on public.issue_updates(updated_by);
create index if not exists issue_updates_user_id_idx on public.issue_updates(user_id);
create index if not exists issues_resolved_by_idx on public.issues(resolved_by);
create index if not exists votes_user_id_idx on public.votes(user_id);
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_own_or_admin on public.profiles for update to authenticated
using((select auth.uid())=id or (select private.is_admin()))
with check((select auth.uid())=id or (select private.is_admin()));
