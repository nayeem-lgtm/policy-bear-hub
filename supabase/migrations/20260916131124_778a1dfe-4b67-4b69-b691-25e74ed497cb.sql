REVOKE EXECUTE ON FUNCTION public.get_interview_booking_page(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.book_interview_slot(uuid, timestamptz) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_interview_booking_page(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.book_interview_slot(uuid, timestamptz) TO service_role;