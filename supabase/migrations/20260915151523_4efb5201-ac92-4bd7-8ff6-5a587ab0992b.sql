CREATE TABLE public.meetings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  agenda jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  starts_at timestamp with time zone NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  timezone text NOT NULL DEFAULT 'UTC',
  status text NOT NULL DEFAULT 'scheduled',
  recurrence text NOT NULL DEFAULT 'none',
  recurrence_until date,
  room_code text NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  host_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meetings_read_authenticated" ON public.meetings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "meetings_insert_host" ON public.meetings
  FOR INSERT TO authenticated WITH CHECK (host_id = auth.uid());
CREATE POLICY "meetings_update_host_or_admin" ON public.meetings
  FOR UPDATE TO authenticated USING (host_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "meetings_delete_host_or_admin" ON public.meetings
  FOR DELETE TO authenticated USING (host_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER meetings_touch BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX meetings_starts_at_idx ON public.meetings (starts_at);

CREATE TABLE public.meeting_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  email text,
  participant_role text NOT NULL DEFAULT 'attendee',
  response text NOT NULL DEFAULT 'pending',
  email_status text NOT NULL DEFAULT 'pending',
  email_sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_participants TO authenticated;
GRANT ALL ON public.meeting_participants TO service_role;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meeting_participants_read_authenticated" ON public.meeting_participants
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "meeting_participants_insert_host" ON public.meeting_participants
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_id AND (m.host_id = auth.uid() OR public.is_admin(auth.uid())))
  );
CREATE POLICY "meeting_participants_update_self_or_host" ON public.meeting_participants
  FOR UPDATE TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_id AND (m.host_id = auth.uid() OR public.is_admin(auth.uid())))
  );
CREATE POLICY "meeting_participants_delete_host" ON public.meeting_participants
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_id AND (m.host_id = auth.uid() OR public.is_admin(auth.uid())))
  );

CREATE TRIGGER meeting_participants_touch BEFORE UPDATE ON public.meeting_participants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.meeting_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  left_at timestamp with time zone,
  seconds integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_attendance TO authenticated;
GRANT ALL ON public.meeting_attendance TO service_role;
ALTER TABLE public.meeting_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meeting_attendance_read_authenticated" ON public.meeting_attendance
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "meeting_attendance_insert_self" ON public.meeting_attendance
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "meeting_attendance_update_self" ON public.meeting_attendance
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER meeting_attendance_touch BEFORE UPDATE ON public.meeting_attendance
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX meeting_attendance_meeting_idx ON public.meeting_attendance (meeting_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_attendance;