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
    'meetingLink', CASE WHEN b.id IS NOT NULL THEN b.meeting_link ELSE NULL END,
    'availableSlots', COALESCE((
      SELECT jsonb_agg(slot_start ORDER BY slot_start)
      FROM (
        SELECT ((day_value::date + slot_time::time) AT TIME ZONE a.timezone) AS slot_start
        FROM generate_series(a.starts_on, a.ends_on, interval '1 day') day_value
        CROSS JOIN LATERAL generate_series(
          a.daily_start::interval,
          a.daily_end::interval - make_interval(mins => a.slot_minutes),
          make_interval(mins => a.slot_minutes)
        ) slot_time
        WHERE extract(isodow from day_value) NOT IN (6, 7)
          AND ((day_value::date + slot_time::time) AT TIME ZONE a.timezone) > now()
          AND a.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM public.onboarding_interview_bookings existing
            WHERE existing.availability_id = a.id
              AND existing.starts_at = ((day_value::date + slot_time::time) AT TIME ZONE a.timezone)
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
$$;
REVOKE ALL ON FUNCTION public.get_interview_booking_page(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_interview_booking_page(uuid) TO service_role;