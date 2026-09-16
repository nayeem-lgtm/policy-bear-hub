CREATE TABLE public.onboarding_automation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  interview_days_ahead integer NOT NULL DEFAULT 14,
  daily_start time NOT NULL DEFAULT '09:00',
  daily_end time NOT NULL DEFAULT '17:00',
  slot_minutes integer NOT NULL DEFAULT 30,
  timezone text NOT NULL DEFAULT 'America/New_York',
  meeting_link text,
  auto_interview_invite boolean NOT NULL DEFAULT true,
  auto_form_invite boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.onboarding_automation_settings TO authenticated;
GRANT ALL ON public.onboarding_automation_settings TO service_role;

ALTER TABLE public.onboarding_automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Onboarding managers read automation settings"
ON public.onboarding_automation_settings FOR SELECT TO authenticated
USING (public.can_manage_onboarding(auth.uid()));

CREATE POLICY "Onboarding managers insert automation settings"
ON public.onboarding_automation_settings FOR INSERT TO authenticated
WITH CHECK (public.can_manage_onboarding(auth.uid()));

CREATE POLICY "Onboarding managers update automation settings"
ON public.onboarding_automation_settings FOR UPDATE TO authenticated
USING (public.can_manage_onboarding(auth.uid()))
WITH CHECK (public.can_manage_onboarding(auth.uid()));

CREATE TRIGGER onboarding_automation_settings_touch
BEFORE UPDATE ON public.onboarding_automation_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.onboarding_automation_settings (singleton) VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

UPDATE public.onboarding_sequence_steps
SET anchor = 'candidate_added', name = 'Interview invitation with booking link', offset_minutes = 0
WHERE step_key = 'invite_on_schedule';

INSERT INTO public.onboarding_sequence_steps (step_key, name, template_key, anchor, offset_minutes, enabled, sort_order)
VALUES ('form_invite', 'Onboarding form invitation', 'onboarding_form_invitation', 'interview_completed', 60, true, 6)
ON CONFLICT (step_key) DO NOTHING;