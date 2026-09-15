import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { COMPANY_ROOM_ID, fetchRoomMessages } from "@/lib/company-chat";
import { cn } from "@/lib/utils";

/** Header chat button with a live unread badge for the company room. */
export function ChatIndicator() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onChatPage = pathname.startsWith("/messages");

  const [lastReadAt, setLastReadAt] = useState<string | null>(null);

  const messagesQuery = useQuery({
    queryKey: ["chat-messages"],
    queryFn: fetchRoomMessages,
    enabled: !!userId,
  });

  const refreshReadMarker = useCallback(() => {
    if (!userId) return;
    void supabase
      .from("conversation_members")
      .select("last_read_at")
      .eq("conversation_id", COMPANY_ROOM_ID)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) =>
        setLastReadAt((data?.last_read_at as string | undefined) ?? null),
      );
  }, [userId]);

  useEffect(() => {
    refreshReadMarker();
  }, [refreshReadMarker]);

  // Re-check the read marker when leaving the chat page.
  const wasOnChatPage = useRef(onChatPage);
  useEffect(() => {
    if (wasOnChatPage.current && !onChatPage) refreshReadMarker();
    wasOnChatPage.current = onChatPage;
  }, [onChatPage, refreshReadMarker]);

  // Live delivery — same query key as the chat page, so both stay in sync.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`chat-indicator-${COMPANY_ROOM_ID}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${COMPANY_ROOM_ID}` },
        () => void queryClient.invalidateQueries({ queryKey: ["chat-messages"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const unread = useMemo(() => {
    if (!lastReadAt) return 0;
    return (messagesQuery.data ?? []).filter(
      (m) => m.sender_id !== userId && m.created_at > lastReadAt,
    ).length;
  }, [messagesQuery.data, lastReadAt, userId]);

  if (!user) return null;

  return (
    <Button asChild variant="ghost" size="icon" className={cn("relative", onChatPage && "text-brand")}>
      <Link to="/messages" aria-label="Team chat">
        <MessageSquare className="size-4" />
        {unread > 0 && !onChatPage && (
          <Badge
            variant="destructive"
            className="absolute -top-0.5 -right-0.5 size-4 justify-center rounded-full p-0 text-[0.6rem]"
          >
            {unread > 99 ? "99+" : unread}
          </Badge>
        )}
      </Link>
    </Button>
  );
}
