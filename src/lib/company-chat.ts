import { supabase } from "@/integrations/supabase/client";
import { fetchStaff, uploadAttachment, type StaffProfile } from "@/lib/messaging";

export const COMPANY_ROOM_ID = "11111111-1111-4111-8111-111111111111";

export type { StaffProfile };
export { fetchStaff, uploadAttachment };

export interface ChatMessage {
  id: string;
  conversation_id: string;
  parent_id: string | null;
  sender_id: string | null;
  body: string;
  kind: string;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  attachment_size: number | null;
  edited_at: string | null;
  created_at: string;
}

export interface ReactionRow {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  mine: boolean;
  names: string[];
}

const MESSAGE_COLUMNS =
  "id,conversation_id,parent_id,sender_id,body,kind,attachment_path,attachment_name,attachment_mime,attachment_size,edited_at,created_at";

export const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Reactions",
    emojis: ["👍", "🙏", "🔥", "🎉", "❤️", "😂", "😮", "😢", "👏", "💪", "✅", "👀"],
  },
  {
    label: "Faces",
    emojis: ["😀", "😄", "😅", "😉", "😊", "🙂", "😍", "🤔", "😴", "🤯", "😎", "🥳", "😇", "🤝", "🙌", "🤞"],
  },
  {
    label: "Work",
    emojis: ["📞", "📈", "📉", "💰", "🧾", "📝", "📌", "⏰", "⚠️", "🚀", "🏆", "🎯", "🛡️", "🧠", "☕", "🍕"],
  },
];

export const QUICK_REACTIONS = ["👍", "🎉", "🔥", "❤️", "😂", "👀"];

/** Make sure the signed-in user is a member of the company room (self-join). */
export async function ensureCompanyMembership(userId: string) {
  const { data } = await supabase
    .from("conversation_members")
    .select("id,last_read_at")
    .eq("conversation_id", COMPANY_ROOM_ID)
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return data.last_read_at as string;

  const { data: created } = await supabase
    .from("conversation_members")
    .upsert(
      { conversation_id: COMPANY_ROOM_ID, user_id: userId, member_role: "member" },
      { onConflict: "conversation_id,user_id", ignoreDuplicates: true },
    )
    .select("last_read_at")
    .maybeSingle();
  return (created?.last_read_at as string | undefined) ?? new Date(0).toISOString();
}

export async function fetchRoomMessages(): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", COMPANY_ROOM_ID)
    .order("created_at", { ascending: true })
    .limit(600);
  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export async function fetchReactions(): Promise<ReactionRow[]> {
  const { data, error } = await supabase
    .from("message_reactions")
    .select("id,message_id,user_id,emoji");
  if (error) throw error;
  return (data ?? []) as ReactionRow[];
}

export async function postMessage(input: {
  senderId: string;
  body: string;
  parentId?: string | null;
  attachment?: { path: string; name: string; mime: string; size: number };
}) {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: COMPANY_ROOM_ID,
      sender_id: input.senderId,
      parent_id: input.parentId ?? null,
      body: input.body,
      kind: input.attachment ? "file" : "text",
      attachment_path: input.attachment?.path ?? null,
      attachment_name: input.attachment?.name ?? null,
      attachment_mime: input.attachment?.mime ?? null,
      attachment_size: input.attachment?.size ?? null,
    })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error) throw error;

  const preview = input.attachment ? `📎 ${input.attachment.name}` : input.body.slice(0, 120);
  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString(), last_message_preview: preview })
    .eq("id", COMPANY_ROOM_ID);

  return data as ChatMessage;
}

export async function editMessage(id: string, body: string) {
  const { error } = await supabase
    .from("messages")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteMessage(id: string) {
  const { error } = await supabase.from("messages").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleReaction(messageId: string, userId: string, emoji: string, mine: boolean) {
  if (mine) {
    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", userId)
      .eq("emoji", emoji);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("message_reactions")
    .insert({ message_id: messageId, user_id: userId, emoji });
  if (error && error.code !== "23505") throw error;
}

export async function markRoomRead(userId: string) {
  await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", COMPANY_ROOM_ID)
    .eq("user_id", userId);
}

export function groupReactions(
  rows: ReactionRow[],
  messageId: string,
  userId: string,
  staffById: Map<string, StaffProfile>,
): ReactionGroup[] {
  const map = new Map<string, ReactionGroup>();
  for (const row of rows) {
    if (row.message_id !== messageId) continue;
    const current =
      map.get(row.emoji) ?? { emoji: row.emoji, count: 0, mine: false, names: [] as string[] };
    current.count += 1;
    if (row.user_id === userId) current.mine = true;
    const name = staffById.get(row.user_id)?.name;
    if (name) current.names.push(name);
    map.set(row.emoji, current);
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export function isImage(mime: string | null) {
  return !!mime && mime.startsWith("image/");
}

export function formatBytes(size: number | null) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

export function clockLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Split a message body into plain text, @mentions, links and `code` spans. */
export type BodyToken =
  | { type: "text"; value: string }
  | { type: "mention"; value: string; isMe: boolean }
  | { type: "link"; value: string }
  | { type: "code"; value: string }
  | { type: "bold"; value: string };

export function tokenizeBody(body: string, names: string[], myName?: string): BodyToken[] {
  const sortedNames = [...names].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const mentionPattern = sortedNames.length > 0 ? `@(?:${sortedNames.join("|")})` : "@[\\w.-]+";
  const pattern = new RegExp(
    `(\`[^\`]+\`)|(\\*\\*[^*]+\\*\\*)|(https?://[^\\s]+)|(${mentionPattern})`,
    "g",
  );

  const tokens: BodyToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body))) {
    if (match.index > lastIndex) tokens.push({ type: "text", value: body.slice(lastIndex, match.index) });
    const raw = match[0];
    if (raw.startsWith("`")) tokens.push({ type: "code", value: raw.slice(1, -1) });
    else if (raw.startsWith("**")) tokens.push({ type: "bold", value: raw.slice(2, -2) });
    else if (raw.startsWith("http")) tokens.push({ type: "link", value: raw });
    else
      tokens.push({
        type: "mention",
        value: raw,
        isMe: !!myName && raw.slice(1).toLowerCase() === myName.toLowerCase(),
      });
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < body.length) tokens.push({ type: "text", value: body.slice(lastIndex) });
  return tokens;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function mentionsMe(body: string, myName?: string) {
  if (!myName) return false;
  return body.toLowerCase().includes(`@${myName.toLowerCase()}`);
}
