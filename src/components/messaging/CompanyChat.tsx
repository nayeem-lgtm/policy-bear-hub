import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  CornerDownRight,
  Hash,
  MessageSquare,
  Search,
  SmilePlus,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AttachmentCard } from "@/components/messaging/AttachmentCard";
import { ChatComposer } from "@/components/messaging/ChatComposer";
import { MessageBody } from "@/components/messaging/MessageBody";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  COMPANY_ROOM_ID,
  EMOJI_GROUPS,
  QUICK_REACTIONS,
  clockLabel,
  dayLabel,
  deleteMessage,
  ensureCompanyMembership,
  fetchReactions,
  fetchRoomMessages,
  fetchStaff,
  groupReactions,
  markRoomRead,
  mentionsMe,
  postMessage,
  toggleReaction,
  uploadAttachment,
  type ChatMessage,
  type StaffProfile,
} from "@/lib/company-chat";
import { cn } from "@/lib/utils";

export function CompanyChat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "";

  const [search, setSearch] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [rootFiles, setRootFiles] = useState<File[]>([]);
  const [threadFiles, setThreadFiles] = useState<File[]>([]);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [atBottom, setAtBottom] = useState(true);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSent = useRef(0);
  const dragDepth = useRef(0);
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const staffQuery = useQuery({ queryKey: ["chat-staff"], queryFn: fetchStaff, enabled: !!userId });
  const messagesQuery = useQuery({
    queryKey: ["chat-messages"],
    queryFn: fetchRoomMessages,
    enabled: !!userId,
  });
  const reactionsQuery = useQuery({
    queryKey: ["chat-reactions"],
    queryFn: fetchReactions,
    enabled: !!userId,
  });

  const staff = staffQuery.data ?? [];
  const messages = messagesQuery.data ?? [];
  const reactions = reactionsQuery.data ?? [];
  const staffById = useMemo(() => new Map(staff.map((person) => [person.id, person] as const)), [staff]);
  const names = useMemo(() => staff.map((person) => person.name), [staff]);

  // Join the room, remember where reading stopped last time.
  useEffect(() => {
    if (!userId) return;
    void ensureCompanyMembership(userId).then((value) => setLastReadAt(value));
  }, [userId]);

  // Live delivery for messages and reactions.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`company-room-${COMPANY_ROOM_ID}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${COMPANY_ROOM_ID}` },
        () => void queryClient.invalidateQueries({ queryKey: ["chat-messages"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () =>
        void queryClient.invalidateQueries({ queryKey: ["chat-reactions"] }),
      )
      .on("broadcast", { event: "typing" }, (payload) => {
        const name = (payload['payload'] as { name?: string; id?: string })?.name;
        const id = (payload['payload'] as { id?: string })?.id;
        if (!name || id === userId) return;
        setTypingNames((current) => (current.includes(name) ? current : [...current, name]));
        setTimeout(() => setTypingNames((current) => current.filter((entry) => entry !== name)), 3500);
      })
      .subscribe();

    typingChannel.current = channel;

    return () => {
      typingChannel.current = null;
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  const roots = useMemo(() => messages.filter((message) => !message.parent_id), [messages]);
  const repliesByParent = useMemo(() => {
    const map = new Map<string, ChatMessage[]>();
    for (const message of messages) {
      if (!message.parent_id) continue;
      map.set(message.parent_id, [...(map.get(message.parent_id) ?? []), message]);
    }
    return map;
  }, [messages]);

  const visibleRoots = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return roots;
    return roots.filter((message) => {
      const sender = message.sender_id ? staffById.get(message.sender_id)?.name ?? "" : "";
      return (
        message.body.toLowerCase().includes(query) ||
        sender.toLowerCase().includes(query) ||
        (message.attachment_name ?? "").toLowerCase().includes(query)
      );
    });
  }, [roots, search, staffById]);

  const unread = useMemo(() => {
    if (!lastReadAt) return 0;
    return messages.filter(
      (message) => message.sender_id !== userId && new Date(message.created_at) > new Date(lastReadAt),
    ).length;
  }, [lastReadAt, messages, userId]);

  const firstUnreadId = useMemo(() => {
    if (!lastReadAt) return null;
    return (
      visibleRoots.find(
        (message) => message.sender_id !== userId && new Date(message.created_at) > new Date(lastReadAt),
      )?.id ?? null
    );
  }, [lastReadAt, userId, visibleRoots]);

  // Auto-scroll while the reader is already at the bottom.
  useEffect(() => {
    if (!atBottom) return;
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [atBottom, visibleRoots.length]);

  // Mark read shortly after messages land while the tab is in view.
  useEffect(() => {
    if (!userId || messages.length === 0) return;
    if (readTimer.current) clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => void markRoomRead(userId), 2500);
    return () => {
      if (readTimer.current) clearTimeout(readTimer.current);
    };
  }, [messages.length, userId]);

  const broadcastTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    void typingChannel.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { id: userId, name: user?.name ?? "Someone" },
    });
  }, [user?.name, userId]);

  const send = useCallback(
    async (body: string, files: File[], parentId: string | null) => {
      if (!userId) return;
      try {
        if (files.length === 0) {
          await postMessage({ senderId: userId, body, parentId });
        } else {
          for (let index = 0; index < files.length; index += 1) {
            const file = files[index]!;
            const attachment = await uploadAttachment(file, userId);
            await postMessage({
              senderId: userId,
              body: index === 0 ? body : "",
              parentId,
              attachment,
            });
          }
        }
        setAtBottom(true);
        await queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Message could not be sent");
      }
    },
    [queryClient, userId],
  );

  const react = useCallback(
    async (messageId: string, emoji: string, mine: boolean) => {
      if (!userId) return;
      try {
        await toggleReaction(messageId, userId, emoji, mine);
        await queryClient.invalidateQueries({ queryKey: ["chat-reactions"] });
      } catch {
        toast.error("Reaction could not be saved");
      }
    },
    [queryClient, userId],
  );

  const remove = useCallback(
    async (messageId: string) => {
      try {
        await deleteMessage(messageId);
        await queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
      } catch {
        toast.error("Message could not be removed");
      }
    },
    [queryClient],
  );

  function onDrop(event: React.DragEvent, target: "root" | "thread") {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const dropped = Array.from(event.dataTransfer?.files ?? []);
    if (dropped.length === 0) return;
    if (target === "thread") setThreadFiles((current) => [...current, ...dropped]);
    else setRootFiles((current) => [...current, ...dropped]);
    toast.success(`${dropped.length} file${dropped.length > 1 ? "s" : ""} ready to send`);
  }

  const thread = threadId ? messages.find((message) => message.id === threadId) ?? null : null;
  const threadReplies = threadId ? repliesByParent.get(threadId) ?? [] : [];
  const online = staff.filter((person) => person.presence === "online");
  const loading = messagesQuery.isLoading || staffQuery.isLoading;

  return (
    <div className="flex h-[calc(100vh-8.5rem)] gap-4">
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
        <header className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
            <Hash className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-sora text-[15px] font-semibold text-foreground">Bear Team Chat</h2>
            <p className="truncate text-[11px] text-muted-foreground">
              Everyone on the floor · {online.length} online · {staff.length} people
            </p>
          </div>
          {unread > 0 && (
            <Badge className="ml-1 rounded-full bg-brand-cyan/15 text-[11px] font-semibold text-brand">
              {unread} new
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search this room"
                className="h-9 w-52 rounded-lg pl-8 text-[13px]"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-lg"
              onClick={() => setShowMembers((value) => !value)}
            >
              <Users className="h-3.5 w-3.5" />
              People
            </Button>
          </div>
        </header>

        <div
          className="relative flex-1 overflow-hidden"
          onDragEnter={(event) => {
            if (!event.dataTransfer?.types.includes("Files")) return;
            dragDepth.current += 1;
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => {
            dragDepth.current -= 1;
            if (dragDepth.current <= 0) setDragging(false);
          }}
          onDrop={(event) => onDrop(event, "root")}
        >
          <div
            ref={scrollRef}
            onScroll={(event) => {
              const node = event.currentTarget;
              setAtBottom(node.scrollHeight - node.scrollTop - node.clientHeight < 80);
            }}
            className="h-full overflow-y-auto px-4 py-4"
          >
            {loading ? (
              <div className="space-y-4">
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="flex gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : visibleRoots.length === 0 ? (
              <EmptyState search={search} />
            ) : (
              visibleRoots.map((message, index) => {
                const previous = visibleRoots[index - 1];
                const newDay =
                  !previous ||
                  new Date(previous.created_at).toDateString() !== new Date(message.created_at).toDateString();
                const grouped =
                  !newDay &&
                  previous?.sender_id === message.sender_id &&
                  new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() < 5 * 60000;

                return (
                  <div key={message.id}>
                    {newDay && (
                      <div className="my-4 flex items-center gap-3">
                        <span className="h-px flex-1 bg-border/70" />
                        <span className="rounded-full border border-border/70 bg-muted/50 px-3 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {dayLabel(message.created_at)}
                        </span>
                        <span className="h-px flex-1 bg-border/70" />
                      </div>
                    )}
                    {firstUnreadId === message.id && (
                      <div className="my-3 flex items-center gap-3">
                        <span className="h-px flex-1 bg-destructive/40" />
                        <span className="rounded-full bg-destructive/10 px-3 py-0.5 text-[11px] font-semibold text-destructive">
                          New messages
                        </span>
                        <span className="h-px flex-1 bg-destructive/40" />
                      </div>
                    )}
                    <MessageRow
                      message={message}
                      sender={message.sender_id ? staffById.get(message.sender_id) : undefined}
                      grouped={grouped}
                      names={names}
                      myName={user?.name}
                      myId={userId}
                      reactions={groupReactions(reactions, message.id, userId, staffById)}
                      replies={repliesByParent.get(message.id) ?? []}
                      onReact={react}
                      onOpenThread={() => setThreadId(message.id)}
                      onDelete={remove}
                    />
                  </div>
                );
              })
            )}
          </div>

          {dragging && (
            <div className="pointer-events-none absolute inset-3 grid place-items-center rounded-2xl border-2 border-dashed border-brand/50 bg-brand/5 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2 text-brand">
                <Upload className="h-6 w-6" />
                <p className="font-sora text-sm font-semibold">Drop files to attach</p>
                <p className="text-[11px] text-brand/70">Images, PDFs, spreadsheets — anything</p>
              </div>
            </div>
          )}

          {!atBottom && (
            <Button
              size="sm"
              variant="outline"
              className="absolute bottom-4 right-4 h-8 gap-1.5 rounded-full shadow-md"
              onClick={() => {
                setAtBottom(true);
                const node = scrollRef.current;
                if (node) node.scrollTop = node.scrollHeight;
              }}
            >
              <ArrowDown className="h-3.5 w-3.5" />
              Latest
            </Button>
          )}
        </div>

        <div className="border-t border-border/70 px-4 py-3">
          {typingNames.length > 0 && (
            <p className="mb-1.5 text-[11px] italic text-muted-foreground">
              {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
            </p>
          )}
          <ChatComposer
            staff={staff}
            files={rootFiles}
            setFiles={setRootFiles}
            autoFocus
            onTyping={broadcastTyping}
            placeholder="Message Bear Team Chat…"
            onSend={(body, files) => send(body, files, null)}
          />
        </div>
      </section>

      {thread && (
        <aside
          className="flex w-[22rem] shrink-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => onDrop(event, "thread")}
        >
          <header className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
            <MessageSquare className="h-4 w-4 text-brand" />
            <h3 className="font-sora text-[13px] font-semibold text-foreground">Thread</h3>
            <span className="text-[11px] text-muted-foreground">
              {threadReplies.length} {threadReplies.length === 1 ? "reply" : "replies"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-7 w-7"
              onClick={() => setThreadId(null)}
              aria-label="Close thread"
            >
              <X className="h-4 w-4" />
            </Button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            <MessageRow
              message={thread}
              sender={thread.sender_id ? staffById.get(thread.sender_id) : undefined}
              names={names}
              myName={user?.name}
              myId={userId}
              reactions={groupReactions(reactions, thread.id, userId, staffById)}
              replies={[]}
              onReact={react}
              onDelete={remove}
              dense
            />
            <div className="h-px bg-border/70" />
            {threadReplies.map((reply) => (
              <MessageRow
                key={reply.id}
                message={reply}
                sender={reply.sender_id ? staffById.get(reply.sender_id) : undefined}
                names={names}
                myName={user?.name}
                myId={userId}
                reactions={groupReactions(reactions, reply.id, userId, staffById)}
                replies={[]}
                onReact={react}
                onDelete={remove}
                dense
              />
            ))}
          </div>
          <div className="border-t border-border/70 px-3 py-3">
            <ChatComposer
              staff={staff}
              files={threadFiles}
              setFiles={setThreadFiles}
              compact
              autoFocus
              placeholder="Reply in thread…"
              onSend={(body, files) => send(body, files, thread.id)}
            />
          </div>
        </aside>
      )}

      {showMembers && !thread && (
        <aside className="hidden w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card xl:flex">
          <header className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
            <Users className="h-4 w-4 text-brand" />
            <h3 className="font-sora text-[13px] font-semibold text-foreground">People</h3>
            <span className="ml-auto text-[11px] text-muted-foreground">{staff.length}</span>
          </header>
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {staff.map((person) => (
              <div key={person.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50">
                <span className="relative">
                  <Avatar className="h-7 w-7">
                    {person.avatar_url && <AvatarImage src={person.avatar_url} alt={person.name} />}
                    <AvatarFallback className="text-[10px]">{person.avatar_initials}</AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                      person.presence === "online" ? "bg-success" : "bg-muted-foreground/40",
                    )}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-medium text-foreground">{person.name}</span>
                  <span className="block truncate text-[10.5px] text-muted-foreground">
                    {person.title || person.department}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="grid h-full place-items-center py-16 text-center">
      <div className="max-w-sm space-y-2">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand">
          <Hash className="h-5 w-5" />
        </span>
        <h3 className="font-sora text-[15px] font-semibold text-foreground">
          {search ? "Nothing matches that search" : "This is the start of Bear Team Chat"}
        </h3>
        <p className="text-[12.5px] text-muted-foreground">
          {search
            ? "Try a different word, a file name, or a teammate's name."
            : "Say hello, share a file by dragging it in, mention a teammate with @ and reply in threads to keep things tidy."}
        </p>
      </div>
    </div>
  );
}

function MessageRow({
  message,
  sender,
  grouped,
  names,
  myName,
  myId,
  reactions,
  replies,
  onReact,
  onOpenThread,
  onDelete,
  dense,
}: {
  message: ChatMessage;
  sender?: StaffProfile | undefined;
  grouped?: boolean | undefined;
  names: string[];
  myName?: string | undefined;
  myId: string;
  reactions: ReturnType<typeof groupReactions>;
  replies: ChatMessage[];
  onReact: (messageId: string, emoji: string, mine: boolean) => Promise<void>;
  onOpenThread?: (() => void) | undefined;
  onDelete: (messageId: string) => Promise<void>;
  dense?: boolean | undefined;
}) {
  const highlighted = mentionsMe(message.body, myName);
  const mine = message.sender_id === myId;

  return (
    <div
      className={cn(
        "group relative flex gap-3 rounded-xl px-2 py-1.5 transition hover:bg-muted/40",
        highlighted && "bg-brand-cyan/5 ring-1 ring-brand-cyan/25",
        grouped ? "mt-0.5" : "mt-3",
      )}
    >
      <div className="w-9 shrink-0">
        {!grouped && (
          <Avatar className="h-9 w-9">
            {sender?.avatar_url && <AvatarImage src={sender.avatar_url} alt={sender.name} />}
            <AvatarFallback className="text-[11px]">{sender?.avatar_initials ?? "??"}</AvatarFallback>
          </Avatar>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {!grouped && (
          <p className="flex flex-wrap items-baseline gap-2">
            <span className="font-sora text-[13px] font-semibold text-foreground">{sender?.name ?? "Unknown"}</span>
            {sender?.title && !dense && (
              <span className="text-[10.5px] text-muted-foreground">{sender.title}</span>
            )}
            <span className="text-[10.5px] text-muted-foreground">{clockLabel(message.created_at)}</span>
            {message.edited_at && <span className="text-[10px] text-muted-foreground">(edited)</span>}
          </p>
        )}

        <MessageBody body={message.body} names={names} myName={myName} />

        {message.attachment_path && (
          <AttachmentCard
            path={message.attachment_path}
            name={message.attachment_name}
            mime={message.attachment_mime}
            size={message.attachment_size}
          />
        )}

        {reactions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                type="button"
                title={reaction.names.join(", ")}
                onClick={() => void onReact(message.id, reaction.emoji, reaction.mine)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition",
                  reaction.mine
                    ? "border-brand/40 bg-brand/10 text-brand"
                    : "border-border/70 bg-muted/40 text-muted-foreground hover:border-brand/30",
                )}
              >
                <span className="text-[13px] leading-none">{reaction.emoji}</span>
                {reaction.count}
              </button>
            ))}
          </div>
        )}

        {replies.length > 0 && onOpenThread && (
          <button
            type="button"
            onClick={onOpenThread}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/30 px-2 py-1 text-[11.5px] font-medium text-brand transition hover:border-brand/40"
          >
            <CornerDownRight className="h-3.5 w-3.5" />
            {replies.length} {replies.length === 1 ? "reply" : "replies"}
          </button>
        )}
      </div>

      <div className="absolute right-2 top-1 hidden items-center gap-0.5 rounded-lg border border-border/70 bg-card p-0.5 shadow-sm group-hover:flex">
        {QUICK_REACTIONS.slice(0, 3).map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => void onReact(message.id, emoji, reactions.some((r) => r.emoji === emoji && r.mine))}
            className="grid h-7 w-7 place-items-center rounded-md text-[14px] hover:bg-muted"
          >
            {emoji}
          </button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-brand"
              aria-label="Add reaction"
            >
              <SmilePlus className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-3">
            <div className="space-y-3">
              {EMOJI_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-8 gap-1">
                    {group.emojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() =>
                          void onReact(message.id, emoji, reactions.some((r) => r.emoji === emoji && r.mine))
                        }
                        className="grid h-7 w-7 place-items-center rounded-md text-[15px] hover:bg-muted"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        {onOpenThread && (
          <button
            type="button"
            onClick={onOpenThread}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-brand"
            aria-label="Reply in thread"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
        )}
        {mine && (
          <button
            type="button"
            onClick={() => void onDelete(message.id)}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete message"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
