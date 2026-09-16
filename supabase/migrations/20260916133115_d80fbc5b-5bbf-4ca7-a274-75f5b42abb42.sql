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
        WHERE extract(isodow from day_value) NOT IN (6, 7)
          AND ((day_value::date + (a.daily_start + make_interval(mins => i * a.slot_minutes))) AT TIME ZONE a.timezone) > now()
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