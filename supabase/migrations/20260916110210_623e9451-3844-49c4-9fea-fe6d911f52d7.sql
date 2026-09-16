drop policy "onboarding_candidates_read" on public.onboarding_candidates;
create policy "onboarding_candidates_read" on public.onboarding_candidates for select to authenticated
using (
  public.can_manage_onboarding(auth.uid())
  or user_id = auth.uid()
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

create or replace function public.owns_onboarding(_candidate_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.onboarding_candidates c
    where c.id = _candidate_id
      and (c.user_id = _user_id
        or lower(c.email) = lower(coalesce((select u.email from auth.users u where u.id = _user_id), '')))
  )
$$;
revoke all on function public.owns_onboarding(uuid, uuid) from anon;