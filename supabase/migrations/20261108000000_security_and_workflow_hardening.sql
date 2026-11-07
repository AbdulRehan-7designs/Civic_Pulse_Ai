-- Security hardening for civic issue creation and administrator role assignment.
-- Public issue-media reads remain intentional: issue attachments are currently displayed
-- through getPublicUrl() in MultiMediaUploader. Changing this requires a signed-URL UI migration.

-- Citizens may submit report content, but workflow/system fields must remain database-controlled.
revoke insert on table public.issues from anon, authenticated;
grant insert (
  title,
  description,
  category,
  location,
  area,
  coordinates,
  image_url,
  media_url,
  severity,
  user_id
) on table public.issues to authenticated;

-- AI analyses are written only by authenticated Edge Functions after checking
-- the caller and report ownership. Do not expose direct client-side inserts.
revoke insert on table public.ai_analyses from anon, authenticated;

-- Role flags cannot be changed through direct profile updates.
revoke update on table public.profiles from anon, authenticated;
grant update (username, full_name, avatar_url) on table public.profiles to authenticated;

-- Serialize role changes and prevent accidentally removing the final administrator.
create or replace function private.set_user_role(
  target_user_id uuid,
  make_admin boolean,
  make_official boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_is_admin boolean;
  admin_count bigint;
begin
  if not private.is_admin() then
    raise exception 'Only an administrator can assign roles' using errcode = '42501';
  end if;

  lock table public.profiles in share row exclusive mode;

  select p.is_admin
    into target_is_admin
    from public.profiles p
   where p.id = target_user_id
   for update;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  if target_is_admin is true and coalesce(make_admin, false) is false then
    select count(*) into admin_count
      from public.profiles p
     where p.is_admin is true;

    if admin_count <= 1 then
      raise exception 'The final administrator cannot be removed' using errcode = '23514';
    end if;
  end if;

  update public.profiles
     set is_admin = coalesce(make_admin, false),
         is_official = coalesce(make_official, false)
   where id = target_user_id;
end;
$$;

revoke all on function private.set_user_role(uuid, boolean, boolean) from public, anon;
grant execute on function private.set_user_role(uuid, boolean, boolean) to authenticated;
revoke all on function public.set_user_role(uuid, boolean, boolean) from public, anon;
grant execute on function public.set_user_role(uuid, boolean, boolean) to authenticated;
