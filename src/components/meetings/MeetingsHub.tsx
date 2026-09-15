import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Link2,
  Plus,
  Repeat,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  DURATION_OPTIONS,
  RECURRENCE_OPTIONS,
  cancelMeeting,
  createMeeting,
  dateLabel,
  deleteMeeting,
  fetchMeetings,
  fetchParticipants,
  fetchStaff,
  localInputValue,
  meetingPhase,
  newId,
  rangeLabel,
  respondToInvite,
  type AgendaItem,
  type MeetingRecord,
  type ParticipantRecord,
  type Recurrence,
} from "@/lib/meetings";
import { sendMeetingInvites } from "@/lib/meetings.functions";
import { cn } from "@/lib/utils";

const PHASE_STYLES: Record<string, string> = {
  live: "bg-red-500/10 text-red-600 border-red-500/30",
  soon: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  upcoming: "bg-primary/10 text-primary border-primary/30",
  past: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-muted text-muted-foreground line-through border-border",
};

function useMeetingsData() {
  const queryClient = useQueryClient();
  const meetings = useQuery({ queryKey: ["meetings"], queryFn: fetchMeetings });
  const participants = useQuery({ queryKey: ["meeting-participants"], queryFn: fetchParticipants });
  const staff = useQuery({ queryKey: ["staff-directory"], queryFn: fetchStaff });

  useEffect(() => {
    const channel = supabase
      .channel("meetings-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["meetings"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_participants" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["meeting-participants"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return { meetings, participants, staff };
}

export function MeetingsHub() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { meetings, participants, staff } = useMeetingsData();
  const [createOpen, setCreateOpen] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const rows = meetings.data ?? [];
  const guests = participants.data ?? [];

  const guestsByMeeting = useMemo(() => {
    const map = new Map<string, ParticipantRecord[]>();
    guests.forEach((guest) => {
      const list = map.get(guest.meeting_id) ?? [];
      list.push(guest);
      map.set(guest.meeting_id, list);
    });
    return map;
  }, [guests]);

  const mine = useMemo(
    () => new Set(guests.filter((guest) => guest.user_id === user?.id).map((guest) => guest.meeting_id)),
    [guests, user?.id],
  );

  const live = rows.filter((meeting) => meetingPhase(meeting) === "live");
  const upcoming = rows.filter((meeting) => ["upcoming", "soon"].includes(meetingPhase(meeting)));
  const past = rows
    .filter((meeting) => ["past", "cancelled"].includes(meetingPhase(meeting)))
    .slice()
    .reverse();
  const invites = guests.filter(
    (guest) =>
      guest.user_id === user?.id &&
      guest.response === "pending" &&
      rows.some(
        (meeting) => meeting.id === guest.meeting_id && !["past", "cancelled"].includes(meetingPhase(meeting)),
      ),
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["meetings"] });
    void queryClient.invalidateQueries({ queryKey: ["meeting-participants"] });
  };

  const rsvp = useMutation({
    mutationFn: ({ id, response }: { id: string; response: "accepted" | "declined" | "tentative" }) =>
      respondToInvite(id, response),
    onSuccess: () => {
      toast.success("Your reply was saved.");
      refresh();
    },
    onError: () => toast.error("Could not save your reply."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteMeeting(id),
    onSuccess: () => {
      toast.success("Meeting removed.");
      refresh();
    },
    onError: () => toast.error("Only the host or an admin can remove this meeting."),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelMeeting(id),
    onSuccess: () => {
      toast.success("Meeting cancelled.");
      refresh();
    },
    onError: () => toast.error("Only the host or an admin can cancel this meeting."),
  });

  const stats = [
    { label: "Live now", value: live.length, icon: Video, tone: "text-red-600" },
    { label: "Coming up", value: upcoming.length, icon: CalendarDays, tone: "text-primary" },
    { label: "Awaiting your reply", value: invites.length, icon: Clock, tone: "text-amber-600" },
    { label: "On your calendar", value: mine.size, icon: Users, tone: "text-emerald-600" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[Sora] text-xl font-semibold tracking-tight">Meetings</h1>
          <p className="text-sm text-muted-foreground">
            Schedule, invite the floor, and meet face to face without leaving the workspace.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="size-4" /> New meeting
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border/50 bg-card/70">
            <CardContent className="flex items-center gap-3 p-4">
              <span className={cn("rounded-xl bg-muted/60 p-2", stat.tone)}>
                <stat.icon className="size-4" />
              </span>
              <div>
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {stat.label}
                </p>
                <p className="font-[Sora] text-xl font-semibold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {invites.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-semibold">Invitations waiting for your reply</p>
            {invites.map((invite) => {
              const meeting = rows.find((row) => row.id === invite.meeting_id);
              if (!meeting) return null;
              return (
                <div
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 bg-card/80 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{meeting.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {dateLabel(meeting.starts_at)} · {rangeLabel(meeting)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => rsvp.mutate({ id: invite.id, response: "accepted" })}>
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rsvp.mutate({ id: invite.id, response: "tentative" })}
                    >
                      Maybe
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => rsvp.mutate({ id: invite.id, response: "declined" })}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4 space-y-3">
          {live.map((meeting) => (
            <MeetingRow
              key={meeting.id}
              meeting={meeting}
              guests={guestsByMeeting.get(meeting.id) ?? []}
              onCancel={() => cancel.mutate(meeting.id)}
              onDelete={() => remove.mutate(meeting.id)}
              canManage={meeting.host_id === user?.id || user?.role === "CEO" || user?.role === "Administrator"}
            />
          ))}
          {upcoming.length === 0 && live.length === 0 ? (
            <EmptyState onCreate={() => setCreateOpen(true)} />
          ) : (
            upcoming.map((meeting) => (
              <MeetingRow
                key={meeting.id}
                meeting={meeting}
                guests={guestsByMeeting.get(meeting.id) ?? []}
                onCancel={() => cancel.mutate(meeting.id)}
                onDelete={() => remove.mutate(meeting.id)}
                canManage={
                  meeting.host_id === user?.id || user?.role === "CEO" || user?.role === "Administrator"
                }
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <MonthCalendar
            cursor={monthCursor}
            meetings={rows}
            onCursorChange={setMonthCursor}
          />
        </TabsContent>

        <TabsContent value="past" className="mt-4 space-y-3">
          {past.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              No past meetings yet.
            </p>
          ) : (
            past.map((meeting) => (
              <MeetingRow
                key={meeting.id}
                meeting={meeting}
                guests={guestsByMeeting.get(meeting.id) ?? []}
                onCancel={() => cancel.mutate(meeting.id)}
                onDelete={() => remove.mutate(meeting.id)}
                canManage={
                  meeting.host_id === user?.id || user?.role === "CEO" || user?.role === "Administrator"
                }
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      <CreateMeetingDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        staff={staff.data ?? []}
        onCreated={refresh}
      />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
      <CalendarDays className="mx-auto size-6 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">Nothing scheduled yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Create a meeting, pick who should be there, and everyone gets an invitation.
      </p>
      <Button className="mt-4 gap-2" onClick={onCreate}>
        <Plus className="size-4" /> New meeting
      </Button>
    </div>
  );
}

function MeetingRow({
  meeting,
  guests,
  canManage,
  onCancel,
  onDelete,
}: {
  meeting: MeetingRecord;
  guests: ParticipantRecord[];
  canManage: boolean;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const phase = meetingPhase(meeting);
  const accepted = guests.filter((guest) => guest.response === "accepted").length;

  const copyLink = async () => {
    const url = `${window.location.origin}/meetings/${meeting.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Meeting link copied.");
    } catch {
      toast.error("Could not copy the link.");
    }
  };

  return (
    <Card className="border-border/50 bg-card/70 transition hover:border-primary/40">
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <div className="flex w-24 shrink-0 flex-col rounded-xl border border-border/50 bg-muted/40 px-3 py-2 text-center">
          <span className="text-[11px] font-medium text-muted-foreground uppercase">
            {dateLabel(meeting.starts_at)}
          </span>
          <span className="font-[Sora] text-sm font-semibold">
            {new Date(meeting.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/meetings/$meetingId"
              params={{ meetingId: meeting.id }}
              className="truncate font-[Sora] text-sm font-semibold hover:underline"
            >
              {meeting.title}
            </Link>
            <Badge variant="outline" className={cn("capitalize", PHASE_STYLES[phase])}>
              {phase === "soon" ? "Starting soon" : phase}
            </Badge>
            {meeting.recurrence !== "none" && (
              <Badge variant="secondary" className="gap-1">
                <Repeat className="size-3" /> Repeats
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {rangeLabel(meeting)} · {meeting.duration_minutes} min · {accepted}/{guests.length} confirmed
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center sm:flex">
            {guests.slice(0, 4).map((guest, index) => (
              <Avatar
                key={guest.id}
                className={cn("size-7 border border-background", index > 0 && "-ml-2")}
              >
                <AvatarFallback className="text-[10px]">
                  {(guest.name ?? "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {guests.length > 4 && (
              <span className="-ml-2 grid size-7 place-items-center rounded-full border border-background bg-muted text-[10px] font-medium">
                +{guests.length - 4}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => void copyLink()} aria-label="Copy meeting link">
            <Link2 className="size-4" />
          </Button>
          {canManage && phase !== "past" && (
            <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Cancel meeting">
              <X className="size-4" />
            </Button>
          )}
          {canManage && (
            <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete meeting">
              <Trash2 className="size-4 text-destructive" />
            </Button>
          )}
          <Button asChild size="sm" variant={phase === "live" || phase === "soon" ? "default" : "outline"}>
            <Link to="/meetings/$meetingId" params={{ meetingId: meeting.id }}>
              {phase === "live" ? "Join" : "Open"}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MonthCalendar({
  cursor,
  meetings,
  onCursorChange,
}: {
  cursor: Date;
  meetings: MeetingRecord[];
  onCursorChange: (date: Date) => void;
}) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(cursor.getFullYear(), cursor.getMonth(), index + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const byDay = new Map<string, MeetingRecord[]>();
  meetings.forEach((meeting) => {
    const key = new Date(meeting.starts_at).toDateString();
    const list = byDay.get(key) ?? [];
    list.push(meeting);
    byDay.set(key, list);
  });

  const today = new Date().toDateString();

  return (
    <Card className="border-border/50 bg-card/70">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-[Sora] text-sm font-semibold">
            {cursor.toLocaleDateString([], { month: "long", year: "numeric" })}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onCursorChange(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const now = new Date();
                onCursorChange(new Date(now.getFullYear(), now.getMonth(), 1));
              }}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onCursorChange(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground uppercase">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <span key={day} className="py-1">
              {day}
            </span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((date, index) => {
            const key = date?.toDateString();
            const dayMeetings = key ? (byDay.get(key) ?? []) : [];
            return (
              <div
                key={index}
                className={cn(
                  "min-h-[86px] rounded-lg border border-border/40 p-1.5",
                  !date && "border-transparent bg-transparent",
                  key === today && "border-primary/50 bg-primary/5",
                )}
              >
                {date && (
                  <>
                    <p className="text-[11px] font-semibold text-muted-foreground">{date.getDate()}</p>
                    <div className="mt-1 space-y-1">
                      {dayMeetings.slice(0, 3).map((meeting) => (
                        <Link
                          key={meeting.id}
                          to="/meetings/$meetingId"
                          params={{ meetingId: meeting.id }}
                          className="block truncate rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20"
                        >
                          {new Date(meeting.starts_at).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}{" "}
                          {meeting.title}
                        </Link>
                      ))}
                      {dayMeetings.length > 3 && (
                        <p className="text-[10px] text-muted-foreground">+{dayMeetings.length - 3} more</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateMeetingDialog({
  open,
  onOpenChange,
  staff,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: { id: string; name: string; email?: string | null; department: string; avatar_initials: string }[];
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState(() => {
    const next = new Date();
    next.setMinutes(next.getMinutes() + 30 - (next.getMinutes() % 15), 0, 0);
    return localInputValue(next);
  });
  const [duration, setDuration] = useState("30");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [until, setUntil] = useState("");
  const [agendaDraft, setAgendaDraft] = useState("");
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredStaff = staff.filter(
    (person) =>
      person.id !== user?.id &&
      (person.name.toLowerCase().includes(search.toLowerCase()) ||
        person.department.toLowerCase().includes(search.toLowerCase())),
  );

  const reset = () => {
    setTitle("");
    setDescription("");
    setAgenda([]);
    setAgendaDraft("");
    setSelected([]);
    setSearch("");
    setRecurrence("none");
    setUntil("");
  };

  const submit = async () => {
    if (!user) return;
    if (!title.trim()) {
      toast.error("Give the meeting a title.");
      return;
    }
    const start = new Date(startsAt);
    if (Number.isNaN(start.getTime())) {
      toast.error("Pick a valid date and time.");
      return;
    }
    setSaving(true);
    try {
      const invitees = staff
        .filter((person) => selected.includes(person.id))
        .map((person) => ({ userId: person.id, name: person.name, email: person.email ?? "" }));

      const created = await createMeeting({
        title: title.trim(),
        description: description.trim() || undefined,
        agenda,
        startsAt: start,
        durationMinutes: Number(duration),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        recurrence,
        recurrenceUntil: recurrence === "none" ? null : until || null,
        hostId: user.id,
        hostName: user.name,
        hostEmail: user.email,
        invitees,
      });

      toast.success(
        created.length > 1 ? `${created.length} meetings scheduled.` : "Meeting scheduled.",
      );

      const first = created[0];
      if (first) {
        try {
          const result = await sendMeetingInvites({
            data: { meetingId: first.id, joinUrl: `${window.location.origin}/meetings/${first.id}` },
          });
          if (result.reason === "missing-key") {
            toast.message("Email invitations are not switched on yet", {
              description: "Everyone can see the meeting in the workspace. Add an email key to send invites by email.",
            });
          } else if (result.sent > 0) {
            toast.success(`${result.sent} email invitation${result.sent === 1 ? "" : "s"} sent.`);
          }
        } catch {
          /* invitations by email are best-effort */
        }
      }

      reset();
      onOpenChange(false);
      onCreated();
    } catch {
      toast.error("Could not schedule the meeting.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-[Sora]">Schedule a meeting</DialogTitle>
          <DialogDescription>
            Pick a time, add an agenda, and invite anyone on the floor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="meeting-title">Title</Label>
            <Input
              id="meeting-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Monday sales huddle"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="meeting-start">Starts</Label>
              <Input
                id="meeting-start"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Length</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((minutes) => (
                    <SelectItem key={minutes} value={String(minutes)}>
                      {minutes} minutes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Repeats</Label>
              <Select value={recurrence} onValueChange={(value) => setRecurrence(value as Recurrence)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {recurrence !== "none" && (
              <div className="space-y-2">
                <Label htmlFor="meeting-until">Repeat until</Label>
                <Input
                  id="meeting-until"
                  type="date"
                  value={until}
                  onChange={(event) => setUntil(event.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-description">What is this about?</Label>
            <Textarea
              id="meeting-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Numbers review, blockers, and this week's targets."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Agenda</Label>
            <div className="flex gap-2">
              <Input
                value={agendaDraft}
                onChange={(event) => setAgendaDraft(event.target.value)}
                placeholder="Add an agenda point and press Enter"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && agendaDraft.trim()) {
                    event.preventDefault();
                    setAgenda((items) => [...items, { id: newId(), text: agendaDraft.trim() }]);
                    setAgendaDraft("");
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (!agendaDraft.trim()) return;
                  setAgenda((items) => [...items, { id: newId(), text: agendaDraft.trim() }]);
                  setAgendaDraft("");
                }}
              >
                Add
              </Button>
            </div>
            {agenda.length > 0 && (
              <ul className="space-y-1">
                {agenda.map((item, index) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-sm"
                  >
                    <span>
                      {index + 1}. {item.text}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => setAgenda((items) => items.filter((entry) => entry.id !== item.id))}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <Label>Invite people</Label>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search staff by name or department"
            />
            <ScrollArea className="h-48 rounded-xl border border-border/50">
              <div className="divide-y divide-border/40">
                {filteredStaff.map((person) => {
                  const checked = selected.includes(person.id);
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() =>
                        setSelected((current) =>
                          checked ? current.filter((id) => id !== person.id) : [...current, person.id],
                        )
                      }
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-muted/50",
                        checked && "bg-primary/5",
                      )}
                    >
                      <Avatar className="size-8">
                        <AvatarFallback className="text-[11px]">{person.avatar_initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{person.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{person.department}</p>
                      </div>
                      {checked && <CheckCircle2 className="size-4 text-primary" />}
                    </button>
                  );
                })}
                {filteredStaff.length === 0 && (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">No one matches that search.</p>
                )}
              </div>
            </ScrollArea>
            <p className="text-xs text-muted-foreground">
              {selected.length} invited · you are the host
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? "Scheduling…" : "Schedule meeting"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
