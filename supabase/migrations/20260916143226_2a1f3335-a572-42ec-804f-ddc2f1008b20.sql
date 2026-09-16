ALTER TABLE public.onboarding_automation_settings
  ADD COLUMN IF NOT EXISTS available_weekdays smallint[] NOT NULL DEFAULT '{1,2,3,4,5}',
  ADD COLUMN IF NOT EXISTS min_notice_hours integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS page_title text NOT NULL DEFAULT 'Agent interview',
  ADD COLUMN IF NOT EXISTS page_description text,
  ADD COLUMN IF NOT EXISTS host_name text,
  ADD COLUMN IF NOT EXISTS location_label text NOT NULL DEFAULT 'Google Meet',
  ADD COLUMN IF NOT EXISTS confirmation_note text;

ALTER TABLE public.onboarding_interview_availability
  ADD COLUMN IF NOT EXISTS available_weekdays smallint[] NOT NULL DEFAULT '{1,2,3,4,5}',
  ADD COLUMN IF NOT EXISTS min_notice_hours integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS page_title text NOT NULL DEFAULT 'Agent interview',
  ADD COLUMN IF NOT EXISTS page_description text,
  ADD COLUMN IF NOT EXISTS host_name text,
  ADD COLUMN IF NOT EXISTS location_label text NOT NULL DEFAULT 'Google Meet',
  ADD COLUMN IF NOT EXISTS confirmation_note text;

CREATE OR REPLACE FUNCTION public.get_interview_booking_page(_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'pageTitle', a.page_title,
    'pageDescription', a.page_description,
    'hostName', a.host_name,
    'locationLabel', a.location_label,
    'confirmationNote', a.confirmation_note,
    'meetingLink', CASE WHEN b.id IS NOT NULL THEN b.meeting_link ELSE NULL END,
    'availableSlots', COALESCE((
      SELECT jsonb_agg(slot_start ORDER BY slot_start)
      FROM (
        SELECT ((day_value::date + (a.daily_start + make_interval(mins => i * a.slot_minutes))) AT TIME ZONE a.timezone) AS slot_start
        FROM generate_series(a.starts_on, a.ends_on, interval '1 day') day_value
        CROSS JOIN LATERAL generate_series(
          0,
          GREATEST(
            (floor((extract(epoch from (a.daily_end - a.daily_start)) / 60) / a.slot_minutes))::int - 1,
            -1
          )
        ) AS i
        WHERE extract(isodow from day_value)::smallint = ANY(a.available_weekdays)
          AND ((day_value::date + (a.daily_start + make_interval(mins => i * a.slot_minutes))) AT TIME ZONE a.timezone)
              > now() + make_interval(hours => a.min_notice_hours)
          AND a.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM public.onboarding_interview_bookings existing
            WHERE existing.availability_id = a.id
              AND existing.starts_at = ((day_value::date + (a.daily_start + make_interval(mins => i * a.slot_minutes))) AT TIME ZONE a.timezone)
              AND existing.status = 'confirmed'
          )
      ) slots
    ), '[]'::jsonb)
  ) INTO result
  FROM public.onboarding_interview_availability a
  JOIN public.onboarding_candidates c ON c.id = a.candidate_id
  LEFT JOIN public.onboarding_interview_bookings b
    ON b.availability_id = a.id AND b.status = 'confirmed'
  WHERE a.booking_token = _token;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.book_interview_slot(_token uuid, _starts_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    OR NOT (extract(isodow from local_start)::smallint = ANY(a.available_weekdays))
    OR _starts_at <= now() + make_interval(hours => a.min_notice_hours)
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
$function$;