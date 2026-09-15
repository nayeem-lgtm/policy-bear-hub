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

  const [lastReadAt, setLastReadAt] = useState<string | null>(nullthird? no);
