
create or replace function public.can_manage_onboarding(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('CEO','Administrator','HR','Operations')
  )
$$;

create table public.onboarding_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  stage text not null default 'Candidate',
  assigned_admin text,
  source text,
  first_name text not null default '',
  middle_name text,
  last_name text not null default '',
  preferred_name text,
  email text not null,
  phone text,
  date_of_birth date,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  mailing_same boolean not null default true,
  mailing_address_line1 text,
  mailing_city text,
  mailing_state text,
  mailing_zip text,
  licensing jsonb not null default '{}'::jsonb,
  banking jsonb not null default '{}'::jsonb,
  authorizations jsonb not null default '{}'::jsonb,
  form_progress jsonb not null default '{}'::jsonb,
  form_submitted_at timestamptz,
  hired_at timestamptz,
  offer_status text not null default 'Not Sent',
  offer_sent_at timestamptz,
  offer_viewed_at timestamptz,
  offer_signed_at timestamptz,
  offer_template text,
  carrier text,
  carrier_status text not null default 'Locked',
  carrier_requested_at timestamptz,
  carrier_decided_at timestamptz,
  carrier_notes text,
  agreement_status text not null default 'Not Sent',
  agreement_sent_at timestamptz,
  agreement_viewed_at timestamptz,
  agreement_signed_at timestamptz,
  agreement_template text,
  access_status text not null default 'Pending',
  access_sent_at timestamptz,
  access_completed_at timestamptz,
  completed_at timestamptz,
  interview_at timestamptz,
  not_hired_reason text,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index onboarding_candidates_email_idx on public.onboarding_candidates (lower(email));

create table public.onboarding_documents (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.onboarding_candidates(id) on delete cascade,
  name text not null,
  required boolean not null default true,
  status text not null default 'Missing',
  file_path text,
  file_name text,
  file_size integer,
  uploaded_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  review_note text,
  created_at timestamptz not null default now()
);
create index onboarding_documents_candidate_idx on public.onboarding_documents (candidate_id);

create table public.onboarding_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.onboarding_candidates(id) on delete cascade,
  event text not null,
  detail text,
  actor text,
  source text not null default 'system',
  created_at timestamptz not null default now()
);
create index onboarding_events_candidate_idx on public.onboarding_events (candidate_id, created_at desc);

create table public.onboarding_notes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.onboarding_candidates(id) on delete cascade,
  author_id uuid,
  author_name text,
  body text not null,
  created_at timestamptz not null default now()
);
create index onboarding_notes_candidate_idx on public.onboarding_notes (candidate_id, created_at desc);

create table public.onboarding_emails (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.onboarding_candidates(id) on delete cascade,
  template_key text not null,
  email_type text not null,
  recipient text not null,
  subject text,
  stage text,
  trigger text,
  sender text,
  status text not null default 'queued',
  error text,
  sent_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now()
);
create index onboarding_emails_candidate_idx on public.onboarding_emails (candidate_id, created_at desc);

create table public.onboarding_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  name text not null,
  category text not null default 'Onboarding',
  subject text not null,
  body text not null,
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.onboarding_candidates to authenticated;
grant select, insert, update, delete on public.onboarding_documents to authenticated;
grant select, insert, update, delete on public.onboarding_events to authenticated;
grant select, insert, update, delete on public.onboarding_notes to authenticated;
grant select, insert, update, delete on public.onboarding_emails to authenticated;
grant select, insert, update, delete on public.onboarding_templates to authenticated;
grant all on public.onboarding_candidates to service_role;
grant all on public.onboarding_documents to service_role;
grant all on public.onboarding_events to service_role;
grant all on public.onboarding_notes to service_role;
grant all on public.onboarding_emails to service_role;
grant all on public.onboarding_templates to service_role;

alter table public.onboarding_candidates enable row level security;
alter table public.onboarding_documents enable row level security;
alter table public.onboarding_events enable row level security;
alter table public.onboarding_notes enable row level security;
alter table public.onboarding_emails enable row level security;
alter table public.onboarding_templates enable row level security;

create or replace function public.owns_onboarding(_candidate_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.onboarding_candidates c
    where c.id = _candidate_id
      and (c.user_id = _user_id
        or lower(c.email) = lower(coalesce((select email from auth.users where id = _user_id), '')))
  )
$$;

create policy "onboarding_candidates_read" on public.onboarding_candidates for select to authenticated
using (public.can_manage_onboarding(auth.uid()) or user_id = auth.uid()
  or lower(email) = lower(coalesce((select u.email from auth.users u where u.id = auth.uid()), '')));
create policy "onboarding_candidates_insert" on public.onboarding_candidates for insert to authenticated
with check (public.can_manage_onboarding(auth.uid()));
create policy "onboarding_candidates_update" on public.onboarding_candidates for update to authenticated
using (public.can_manage_onboarding(auth.uid()) or public.owns_onboarding(id, auth.uid()));
create policy "onboarding_candidates_delete" on public.onboarding_candidates for delete to authenticated
using (public.can_manage_onboarding(auth.uid()));

create policy "onboarding_documents_read" on public.onboarding_documents for select to authenticated
using (public.can_manage_onboarding(auth.uid()) or public.owns_onboarding(candidate_id, auth.uid()));
create policy "onboarding_documents_insert" on public.onboarding_documents for insert to authenticated
with check (public.can_manage_onboarding(auth.uid()) or public.owns_onboarding(candidate_id, auth.uid()));
create policy "onboarding_documents_update" on public.onboarding_documents for update to authenticated
using (public.can_manage_onboarding(auth.uid()) or public.owns_onboarding(candidate_id, auth.uid()));
create policy "onboarding_documents_delete" on public.onboarding_documents for delete to authenticated
using (public.can_manage_onboarding(auth.uid()));

create policy "onboarding_events_read" on public.onboarding_events for select to authenticated
using (public.can_manage_onboarding(auth.uid()) or public.owns_onboarding(candidate_id, auth.uid()));
create policy "onboarding_events_insert" on public.onboarding_events for insert to authenticated
with check (public.can_manage_onboarding(auth.uid()) or public.owns_onboarding(candidate_id, auth.uid()));

create policy "onboarding_notes_manage" on public.onboarding_notes for all to authenticated
using (public.can_manage_onboarding(auth.uid())) with check (public.can_manage_onboarding(auth.uid()));

create policy "onboarding_emails_manage" on public.onboarding_emails for all to authenticated
using (public.can_manage_onboarding(auth.uid())) with check (public.can_manage_onboarding(auth.uid()));

create policy "onboarding_templates_read" on public.onboarding_templates for select to authenticated using (true);
create policy "onboarding_templates_write" on public.onboarding_templates for all to authenticated
using (public.can_manage_onboarding(auth.uid())) with check (public.can_manage_onboarding(auth.uid()));

create policy "onboarding_docs_read" on storage.objects for select to authenticated
using (bucket_id = 'onboarding-docs');
create policy "onboarding_docs_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'onboarding-docs');
create policy "onboarding_docs_update" on storage.objects for update to authenticated
using (bucket_id = 'onboarding-docs');
create policy "onboarding_docs_delete" on storage.objects for delete to authenticated
using (bucket_id = 'onboarding-docs');

insert into public.onboarding_templates (template_key, name, category, subject, body) values
('interview_invitation','Interview invitation','Hiring','Your PolicyBear interview','Hi {{agent_first_name}},

Thank you for applying to {{company_name}}. We would like to invite you to an interview.

Please reply to confirm a time that works for you.

- {{company_name}} Hiring Team'),
('onboarding_form_invitation','Onboarding form invitation','Onboarding','Complete your PolicyBear agent onboarding','Hi {{agent_first_name}},

Welcome aboard. Please complete your agent onboarding form here: {{onboarding_form_link}}

You will need your licensing details, banking details and required documents.

- {{company_name}}'),
('offer_letter','Offer letter notification','Onboarding','Your PolicyBear offer letter','Hi {{agent_first_name}},

Your offer letter is ready for review and signature: {{offer_letter_link}}

- {{company_name}}'),
('carrier_approval','Carrier approval request','Onboarding','Carrier approval request - {{agent_first_name}} {{agent_last_name}}','Hello,

We are requesting carrier appointment approval for {{agent_first_name}} {{agent_last_name}} ({{agent_email}}).

Licensing and onboarding documentation is available on request.

- {{company_name}}'),
('employment_agreement','Employment agreement notification','Onboarding','Your PolicyBear employment agreement','Hi {{agent_first_name}},

Your employment agreement is ready for signature: {{employment_agreement_link}}

- {{company_name}}'),
('arm_access','PolicyBear ARM access','Onboarding','Your PolicyBear ARM access','Hi {{agent_first_name}},

Your PolicyBear ARM access is being issued. You will receive your sign-in details shortly.

- {{company_name}}')
on conflict (template_key) do nothing;
