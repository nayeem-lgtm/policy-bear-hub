ALTER TABLE public.onboarding_candidates
  ADD COLUMN IF NOT EXISTS interview_link text,
  ADD COLUMN IF NOT EXISTS interview_notes text,
  ADD COLUMN IF NOT EXISTS interview_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS interview_duration_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS sequence_paused boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.onboarding_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_key text NOT NULL UNIQUE,
  name text NOT NULL,
  template_key text NOT NULL,
  anchor text NOT NULL,
  offset_minutes integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.onboarding_sequence_steps TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.onboarding_sequence_steps TO authenticated;
GRANT ALL ON public.onboarding_sequence_steps TO service_role;
ALTER TABLE public.onboarding_sequence_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sequence_steps_read" ON public.onboarding_sequence_steps;
CREATE POLICY "sequence_steps_read" ON public.onboarding_sequence_steps
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sequence_steps_manage" ON public.onboarding_sequence_steps;
CREATE POLICY "sequence_steps_manage" ON public.onboarding_sequence_steps
  FOR ALL TO authenticated
  USING (public.can_manage_onboarding(auth.uid()))
  WITH CHECK (public.can_manage_onboarding(auth.uid()));

CREATE TRIGGER onboarding_sequence_steps_touch BEFORE UPDATE ON public.onboarding_sequence_steps
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.onboarding_templates (template_key, name, subject, body, category) VALUES
  ('interview_reminder_24h', 'Interview reminder (24h before)', 'Reminder: your PolicyBear interview is tomorrow',
   E'Hi {{agent_first_name}},\n\nA quick reminder that your interview with {{company_name}} is scheduled for {{interview_time}}.\n\nJoin here: {{interview_link}}\n\nPlease have your license details handy. Reply to this email if you need to reschedule.\n\n— {{company_name}} Hiring Team', 'Hiring'),
  ('interview_reminder_1h', 'Interview reminder (1h before)', 'Your PolicyBear interview starts in 1 hour',
   E'Hi {{agent_first_name}},\n\nYour interview starts in about an hour ({{interview_time}}).\n\nJoin here: {{interview_link}}\n\nSee you soon.\n\n— {{company_name}} Hiring Team', 'Hiring'),
  ('interview_thank_you', 'Post-interview thank you', 'Thanks for interviewing with PolicyBear',
   E'Hi {{agent_first_name}},\n\nThank you for taking the time to speak with us today. Our team is reviewing your interview and will be in touch with next steps shortly.\n\nIf you have not completed it yet, please fill in your onboarding form: {{onboarding_form_link}}\n\n— {{company_name}} Hiring Team', 'Hiring'),
  ('interview_follow_up', 'Post-interview follow-up', 'Next steps after your PolicyBear interview',
   E'Hi {{agent_first_name}},\n\nFollowing up on your interview: the next step is completing your agent onboarding form so we can finalise your file.\n\nStart here: {{onboarding_form_link}}\n\nLet us know if you have any questions.\n\n— {{company_name}} Hiring Team', 'Hiring')
ON CONFLICT (template_key) DO NOTHING;

INSERT INTO public.onboarding_sequence_steps (step_key, name, template_key, anchor, offset_minutes, sort_order) VALUES
  ('invite_on_schedule', 'Interview invitation', 'interview_invitation', 'interview_scheduled', 0, 1),
  ('reminder_24h', 'Reminder 24 hours before', 'interview_reminder_24h', 'interview_start', -1440, 2),
  ('reminder_1h', 'Reminder 1 hour before', 'interview_reminder_1h', 'interview_start', -60, 3),
  ('thank_you', 'Thank you after interview', 'interview_thank_you', 'interview_completed', 30, 4),
  ('follow_up', 'Follow-up with form link', 'interview_follow_up', 'interview_completed', 2880, 5)
ON CONFLICT (step_key) DO NOTHING;