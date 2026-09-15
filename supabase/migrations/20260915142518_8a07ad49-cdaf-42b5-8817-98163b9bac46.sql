-- Threaded replies
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.messages(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS messages_parent_idx ON public.messages(parent_id);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON public.messages(conversation_id, created_at);

-- Emoji reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reactions_read ON public.message_reactions;
CREATE POLICY reactions_read ON public.message_reactions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id));

DROP POLICY IF EXISTS reactions_insert_own ON public.message_reactions;
CREATE POLICY reactions_insert_own ON public.message_reactions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS reactions_delete_own ON public.message_reactions;
CREATE POLICY reactions_delete_own ON public.message_reactions FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Open company channels: any signed-in staff member can see and post
DROP POLICY IF EXISTS conversations_read_open_channels ON public.conversations;
CREATE POLICY conversations_read_open_channels ON public.conversations FOR SELECT TO authenticated
USING (kind = 'channel');

DROP POLICY IF EXISTS messages_read_open_channels ON public.messages;
CREATE POLICY messages_read_open_channels ON public.messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.kind = 'channel'));

DROP POLICY IF EXISTS messages_insert_open_channels ON public.messages;
CREATE POLICY messages_insert_open_channels ON public.messages FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.kind = 'channel'));

-- Seed the single company-wide room
INSERT INTO public.conversations (id, kind, name, topic, avatar_initials, last_message_preview)
VALUES ('11111111-1111-4111-8111-111111111111', 'channel', 'Company', 'One room for the whole floor — announcements, questions and wins.', '#', 'Welcome to the company chat.')
ON CONFLICT (id) DO NOTHING;

-- Live updates
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_members REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;