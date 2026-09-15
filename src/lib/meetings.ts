import { supabase } from "@/integrations/supabase/client";
import { fetchStaff, type StaffProfile } from "@/lib/messaging";

export type { StaffProfile };
export { fetchStaff };

export type MeetingStatus = "scheduled" | "live" | "ended" | "cancelled";
export type Recurrence = "none" | "daily" | "weekdays" | "weekly" | "biweekly" | "monthly";
export type InviteResponse = "pending" | "accepted" | "declined" | "tentative";

export interface AgendaItem {
  id: string;
  text: string;
  minutes?: number;
  done?: boolean;
}

export interface ActionItem {
  id: string;
  text: string;
  owner?: string;
  done?: boolean;
}

export interface MeetingRecord {
  id: string;
  title: string;
  description: string | null;
  agenda: AgendaItem[];
  notes: string | null;
  action_items: ActionItem[];
  starts_at: string;
  duration_minutes: number;
  timezone: string;
  status: MeetingStatus;
  recurrence: Recurrence;
  recurrence_until: string | null;
  room_code: string;
  host_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface ParticipantRecord {
  id: string;
  meeting_id: string;
  user_id: string | null;
  name: string | null;
  email: string | null;
  participant_role: string;
  response: InviteResponse;
  email_status: string;
  email_sent_at: string | null;
}

export interface AttendanceRecord {
  id: string;
  meeting_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  seconds: number;
}

const MEETING_COLUMNS =
  "id,title,description,agenda,notes,action_items,starts_at,duration_minutes,timezone,status,recurrence,recurrence_until,room_code,host_id,started_at,ended_at,created_at";

export const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Every weekday (Mon–Fri)" },
  { value: "weekly", label: "Every week" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Every month" },
];

export const DURATION_OPTIONS = [15, 20, 30, 45, 60, 90, 120];

/* ------------------------------------------------------------------ reads */

export async function fetchMeetings(): Promise<MeetingRecord[]> {
  const { data, error } = await supabase
    .from("meetings")
    .select(MEETING_COLUMNS)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...(row as unknown as MeetingRecord),
    agenda: normaliseList<AgendaItem>((row as { agenda?: unknown }).agenda),
    action_items: normaliseList<ActionItem>((row as { action_items?: unknown }).action_items),
  }));
}

export async function fetchParticipants(): Promise<ParticipantRecord[]> {
  const { data, error } = await supabase
    .from("meeting_participants")
    .select("id,meeting_id,user_id,name,email,participant_role,response,email_status,email_sent_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ParticipantRecord[];
}

export async function fetchAttendance(): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from("meeting_attendance")
    .select("id,meeting_id,user_id,joined_at,left_at,seconds")
    .order("joined_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AttendanceRecord[];
}

function normaliseList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/* --------------------------------------------------------------- creation */

export interface CreateMeetingInput {
  title: string;
  description?: string;
  agenda: AgendaItem[];
  startsAt: Date;
  durationMinutes: number;
  timezone: string;
  recurrence: Recurrence;
  recurrenceUntil?: string | null;
  hostId: string;
  hostName: string;
  hostEmail: string;
  invitees: { userId: string; name: string; email: string; role?: string }[];
}

/** Expand a recurrence rule into concrete start times (capped for safety). */
export function occurrenceDates(
  start: Date,
  recurrence: Recurrence,
  until: string | null | undefined,
  cap = 40,
): Date[] {
  if (recurrence === "none" || !until) return [start];
  const limit = new Date(`${until}T23:59:59`);
  if (Number.isNaN(limit.getTime()) || limit < start) return [start];

  const dates: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= limit && dates.length < cap) {
    if (recurrence !== "weekdays" || (cursor.getDay() !== 0 && cursor.getDay() !== 6)) {
      dates.push(new Date(cursor));
    }
    switch (recurrence) {
      case "daily":
      case "weekdays":
        cursor.setDate(cursor.getDate() + 1);
        break;
      case "weekly":
        cursor.setDate(cursor.getDate() + 7);
        break;
      case "biweekly":
        cursor.setDate(cursor.getDate() + 14);
        break;
      case "monthly":
        cursor.setMonth(cursor.getMonth() + 1);
        break;
      default:
        return dates;
    }
  }
  return dates.length ? dates : [start];
}

export async function createMeeting(input: CreateMeetingInput): Promise<MeetingRecord[]> {
  const dates = occurrenceDates(input.startsAt, input.recurrence, input.recurrenceUntil);
  const rows = dates.map((date) => ({
    title: input.title,
    description: input.description ?? null,
    agenda: input.agenda,
    starts_at: date.toISOString(),
    duration_minutes: input.durationMinutes,
    timezone: input.timezone,
    recurrence: input.recurrence,
    recurrence_until: input.recurrenceUntil ?? null,
    host_id: input.hostId,
    status: "scheduled",
  }));

  const { data, error } = await supabase
    .from("meetings")
    .insert(rows as never)
    .select(MEETING_COLUMNS);
  if (error) throw error;
  const created = (data ?? []) as unknown as MeetingRecord[];

  const guests = [
    { userId: input.hostId, name: input.hostName, email: input.hostEmail, role: "host" },
    ...input.invitees.filter((guest) => guest.userId !== input.hostId),
  ];
  const participantRows = created.flatMap((meeting) =>
    guests.map((guest) => ({
      meeting_id: meeting.id,
      user_id: guest.userId,
      name: guest.name,
      email: guest.email,
      participant_role: guest.role ?? "attendee",
      response: guest.role === "host" ? "accepted" : "pending",
    })),
  );
  if (participantRows.length) {
    const { error: guestError } = await supabase.from("meeting_participants").insert(participantRows);
    if (guestError) throw guestError;
  }
  return created;
}

export async function updateMeeting(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase
    .from("meetings")
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteMeeting(id: string) {
  const { error } = await supabase.from("meetings").delete().eq("id", id);
  if (error) throw error;
}

export async function cancelMeeting(id: string) {
  await updateMeeting(id, { status: "cancelled" });
}

export async function addParticipants(
  meetingId: string,
  guests: { userId: string; name: string; email: string }[],
) {
  if (!guests.length) return;
  const { error } = await supabase.from("meeting_participants").insert(
    guests.map((guest) => ({
      meeting_id: meetingId,
      user_id: guest.userId,
      name: guest.name,
      email: guest.email,
      participant_role: "attendee",
      response: "pending",
    })),
  );
  if (error) throw error;
}

export async function removeParticipant(participantId: string) {
  const { error } = await supabase.from("meeting_participants").delete().eq("id", participantId);
  if (error) throw error;
}

export async function respondToInvite(participantId: string, response: InviteResponse) {
  const { error } = await supabase
    .from("meeting_participants")
    .update({ response })
    .eq("id", participantId);
  if (error) throw error;
}

/* ------------------------------------------------------------- attendance */

export async function recordJoin(meetingId: string, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("meeting_attendance")
    .insert({ meeting_id: meetingId, user_id: userId })
    .select("id")
    .maybeSingle();
  if (error) return null;
  return (data?.id as string | undefined) ?? null;
}

export async function recordLeave(attendanceId: string, seconds: number) {
  await supabase
    .from("meeting_attendance")
    .update({ left_at: new Date().toISOString(), seconds })
    .eq("id", attendanceId);
}

/* ---------------------------------------------------------------- helpers */

export function meetingEnd(meeting: MeetingRecord) {
  return new Date(new Date(meeting.starts_at).getTime() + meeting.duration_minutes * 60_000);
}

export type Phase = "live" | "soon" | "upcoming" | "past" | "cancelled";

export function meetingPhase(meeting: MeetingRecord, now = new Date()): Phase {
  if (meeting.status === "cancelled") return "cancelled";
  if (meeting.status === "ended") return "past";
  const start = new Date(meeting.starts_at);
  const end = meetingEnd(meeting);
  if (meeting.status === "live") return "live";
  if (now >= start && now <= end) return "live";
  if (now < start && start.getTime() - now.getTime() <= 15 * 60_000) return "soon";
  return now > end ? "past" : "upcoming";
}

export function canJoin(meeting: MeetingRecord, now = new Date()) {
  const phase = meetingPhase(meeting, now);
  return phase === "live" || phase === "soon";
}

export function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function dateLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (sameDay) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function rangeLabel(meeting: MeetingRecord) {
  return `${timeLabel(meeting.starts_at)} – ${meetingEnd(meeting).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function durationLabel(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function localInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

export function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}
