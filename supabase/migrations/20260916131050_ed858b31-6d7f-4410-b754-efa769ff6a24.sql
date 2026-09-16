CREATE TABLE public.onboarding_interview_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.onboarding_candidates(id) ON DELETE CASCADE,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  daily_start time NOT NULL,
  daily_end time NOT NULL,
  slot_minutes integer NOT NULL DEFAULT 30 CHECK (slot_minutes IN (15, 30, 45, 60, 90, 120)),
  timezone text NOT NULL DEFAULT 'America/New_York',
  meeting_link text,
  booking_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on),
  CHECK (daily_end > daily_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_interview_availability TO authenticated;
GRANT ALL ON public.onboarding_interview_availability TO service_role;

ALTER TABLE public.onboarding_interview_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Onboarding managers can view interview availability"
ON public.onboarding_interview_availability FOR SELECT TO authenticated
USING (public.can_manage_onboarding(auth.uid()));

CREATE POLICY "Onboarding managers can create interview availability"
ON public.onboarding_interview_availability FOR INSERT TO authenticated
WITH CHECK (public.can_manage_onboarding(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Onboarding managers can update interview availability"
ON public.onboarding_interview_availability FOR UPDATE TO authenticated
USING (public.can_manage_onboarding(auth.uid()))
WITH CHECK (public.can_manage_onboarding(auth.uid()));

CREATE POLICY "Onboarding managers can delete interview availability"
ON public.onboarding_interview_availability FOR DELETE TO authenticated
USING (public.can_manage_onboarding(auth.uid()));

CREATE TRIGGER onboarding_interview_availability_touch
BEFORE UPDATE ON public.onboarding_interview_availability
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.onboarding_interview_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  availability_id uuid NOT NULL REFERENCES public.onboarding_interview_availability(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.onboarding_candidates(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL,
  meeting_link text,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE UNIQUE INDEX onboarding_interview_bookings_active_candidate
ON public.onboarding_interview_bookings(candidate_id) WHERE status = 'confirmed';
CREATE UNIQUE INDEX onboarding_interview_bookings_active_slot
ON public.onboarding_interview_bookings(availability_id, starts_at) WHERE status = 'confirmed';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_interview_bookings TO authenticated;
GRANT ALL ON public.onboarding_interview_bookings TO service_role;

ALTER TABLE public.onboarding_interview_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Onboarding managers can view interview bookings"
ON public.onboarding_interview_bookings FOR SELECT TO authenticated
USING (public.can_manage_onboarding(auth.uid()));

CREATE POLICY "Onboarding managers can create interview bookings"
ON public.onboarding_interview_bookings FOR INSERT TO authenticated
WITH CHECK (public.can_manage_onboarding(auth.uid()));

CREATE POLICY "Onboarding managers can update interview bookings"
ON public.onboarding_interview_bookings FOR UPDATE TO authenticated
USING (public.can_manage_onboarding(auth.uid()))
WITH CHECK (public.can_manage_onboarding(auth.uid()));

CREATE POLICY "Onboarding managers can delete interview bookings"
ON public.onboarding_interview_bookings FOR DELETE TO authenticated
USING (public.can_manage_onboarding(auth.uid()));

CREATE TRIGGER onboarding_interview_bookings_touch
BEFORE UPDATE ON public.onboarding_interview_bookings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.get_interview_booking_page(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'availabilityId', a.id,
    'candidateFirstName', c.first_name,
    'startsOn', a.starts_on,
    'endsOn', a.ends_on,
    'dailyStart', a.daily_start,
    'dailyEnd', a.daily_end,
    'slotMinutes', a.slot_minutes,
    'timezone', a.timezone,
    'isActive', a.is_active,
    'bookedStartsAt', b.starts_at,
    'meetingLink', CASE WHEN b.id IS NOT NULL THEN b.meeting_link ELSE NULL END
  ) INTO result
  FROM public.onboarding_interview_availability a
  JOIN public.onboarding_candidates c ON c.id = a.candidate_id
  LEFT JOIN public.onboarding_interview_bookings b
    ON b.availability_id = a.id AND b.status = 'confirmed'
  WHERE a.booking_token = _token;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.book_interview_slot(_token uuid, _starts_at timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.onboarding_interview_availability%ROWTYPE;
  slot_end timestamptz;
  local_start timestamp;
  booking_id uuid;
BEGIN
  SELECT * INTO a
  FROM public.onboarding_interview_availability
  WHERE booking_token = _token AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'This booking link is unavailable'; END IF;

  local_start := _starts_at AT TIME ZONE a.timezone;
  slot_end := _starts_at + make_interval(mins => a.slot_minutes);

  IF local_start::date < a.starts_on OR local_start::date > a.ends_on
    OR local_start::time < a.daily_start
    OR (local_start + make_interval(mins => a.slot_minutes))::time > a.daily_end
    OR extract(isodow from local_start) IN (6, 7)
    OR _starts_at <= now()
  THEN RAISE EXCEPTION 'That time is outside the available interview period'; END IF;

  INSERT INTO public.onboarding_interview_bookings (
    availability_id, candidate_id, starts_at, ends_at, timezone, meeting_link
  ) VALUES (a.id, a.candidate_id, _starts_at, slot_end, a.timezone, a.meeting_link)
  RETURNING id INTO booking_id;

  UPDATE public.onboarding_candidates
  SET interview_at = _starts_at,
      interview_duration_minutes = a.slot_minutes,
      interview_link = a.meeting_link,
      interview_completed_at = NULL,
      stage = CASE WHEN hired_at IS NULL THEN 'Interview Scheduled' ELSE stage END,
      last_activity_at = now(),
      updated_at = now()
  WHERE id = a.candidate_id;

  UPDATE public.onboarding_interview_availability
  SET is_active = false
  WHERE candidate_id = a.candidate_id;

  INSERT INTO public.onboarding_events (candidate_id, event, detail, actor, source)
  VALUES (a.candidate_id, 'Interview self-booked', _starts_at::text, 'Candidate', 'system');

  RETURN jsonb_build_object(
    'bookingId', booking_id,
    'startsAt', _starts_at,
    'endsAt', slot_end,
    'timezone', a.timezone,
    'meetingLink', a.meeting_link
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'That interview slot is no longer available';
END;
$$;

REVOKE ALL ON FUNCTION public.get_interview_booking_page(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.book_interview_slot(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_interview_booking_page(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.book_interview_slot(uuid, timestamptz) TO anon, authenticated, service_role;