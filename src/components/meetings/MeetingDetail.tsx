import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Link2,
  Mail,
  Repeat,
  Save,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { MeetingRoom } from "@/components/meetings/MeetingRoom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import {
  durationLabel,
  fetchAttendance,
  fetchMeetings,
  fetchParticipants,
  meetingPhase,
  newId,
  rangeLabel,
  respondToInvite,
  updateMeeting,
  type ActionItem,
  type AgendaItem,
} from "@/lib/meetings";
import { sendMeetingInvites } from "@/lib/meetings.functions";
import { cn } from "@/lib/utils";

const RESPONSE_LABEL: Record<string, string> = {
  pending: "No reply yet",
  accepted: "Going",
  declined: "Not going",
  tentative: "Maybe",
};

export function MeetingDetail({ meetingId }: { meetingId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const meetings = useQuery({ queryKey: ["meetings"], queryFn: fetchMeetings });
  const participants = useQuery({ queryKey: ["meeting-participants"], queryFn: fetchParticipants });
  const attendance = useQuery({ queryKey: ["meeting-attendance"], queryFn: fetchAttendance });

  const meeting = meetings.data?.find((row) => row.id === meetingId);
  const guests = useMemo(
    () => (participants.data ?? []).filter((guest) => guest.meeting_id === meetingId),
    [participants.data, meetingId],
  );
  const attended = useMemo(
    () => (attendance.data ?? []).filter((row) => row.meeting_id === meetingId),
    [attendance.data, meetingId],
  );

  const [notes, setNotes] = useState("");
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [actionDraft, setActionDraft] = useState("");
  const [inRoom, setInRoom] = useState(false);

  useEffect(() => {
    if (!meeting) return;
    setNotes(meeting.notes ?? "");
    setAgenda(meeting.agenda);
    setActions(meeting.action_items);
  }, [meeting?.id, meeting?.notes]); // eslint-disable-line react-hooks/exhaustive-deps

  if (meetings.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading meeting…</p>;
  }

  if (!meeting) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
        <p className="text-sm font-medium">This meeting is no longer available.</p>
        <Button className="mt-4" variant="outline" onClick={() => void navigate({ to: "/meetings" })}>
          Back to meetings
        </Button>
      </div>
    );
  }

  const phase = meetingPhase(meeting);
  const isHost = meeting.host_id === user?.id;
  const canManage = isHost || user?.role === "CEO" || user?.role === "Administrator";
  const myInvite = guests.find((guest) => guest.user_id === user?.id);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["meetings"] });
    void queryClient.invalidateQueries({ queryKey: ["meeting-participants"] });
    void queryClient.invalidateQueries({ queryKey: ["meeting-attendance"] });
  };

  const saveWorkspace = async () => {
    try {
      await updateMeeting(meeting.id, { notes, agenda, action_items: actions });
      toast.success("Agenda and notes saved.");
      refresh();
    } catch {
      toast.error("Could not save the agenda and notes.");
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/meetings/${meeting.id}`);
      toast.success("Meeting link copied.");
    } catch {
      toast.error("Could not copy the link.");
    }
  };

  const resendInvites = async () => {
    try {
      const result = await sendMeetingInvites({
        data: { meetingId: meeting.id, joinUrl: `${window.location.origin}/meetings/${meeting.id}` },
      });
      if (result.reason === "missing-key") {
        toast.message("Email invitations are not switched on yet", {
          description: "Everyone still sees this meeting in the workspace.",
        });
      } else if (result.sent > 0) {
        toast.success(`${result.sent} invitation${result.sent === 1 ? "" : "s"} emailed.`);
      } else {
        toast.error("No invitations could be emailed.");
      }
      refresh();
    } catch {
      toast.error("Could not send the invitations.");
    }
  };

  if (inRoom) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => setInRoom(false)}>
          <ArrowLeft className="size-4" /> Meeting details
        </Button>
        <MeetingRoom meeting={meeting} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="mb-1 gap-2 px-0 hover:bg-transparent">
            <Link to="/meetings">
              <ArrowLeft className="size-4" /> All meetings
            </Link>
          </Button>
          <h1 className="font-[Sora] text-xl font-semibold tracking-tight">{meeting.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              {new Date(meeting.starts_at).toLocaleDateString([], {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> {rangeLabel(meeting)} ({meeting.duration_minutes} min)
            </span>
            {meeting.recurrence !== "none" && (
              <span className="inline-flex items-center gap-1">
                <Repeat className="size-3.5" /> Repeating series
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "capitalize",
              phase === "live" && "border-red-500/30 bg-red-500/10 text-red-600",
              phase === "soon" && "border-amber-500/30 bg-amber-500/10 text-amber-600",
            )}
          >
            {phase === "soon" ? "Starting soon" : phase}
          </Badge>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void copyLink()}>
            <Link2 className="size-4" /> Copy link
          </Button>
          {canManage && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => void resendInvites()}>
              <Mail className="size-4" /> Email invites
            </Button>
          )}
          <Button size="sm" onClick={() => setInRoom(true)} disabled={phase === "cancelled"}>
            {phase === "live" ? "Join now" : "Open room"}
          </Button>
        </div>
      </div>

      {myInvite && myInvite.response === "pending" && phase !== "past" && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm font-medium">Will you be joining this meeting?</p>
            <div className="flex items-center gap-2">
              {(["accepted", "tentative", "declined"] as const).map((response) => (
                <Button
                  key={response}
                  size="sm"
                  variant={response === "accepted" ? "default" : "outline"}
                  onClick={async () => {
                    await respondToInvite(myInvite.id, response);
                    toast.success("Your reply was saved.");
                    refresh();
                  }}
                >
                  {RESPONSE_LABEL[response]}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          {meeting.description && (
            <Card className="border-border/50 bg-card/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">About this meeting</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground">{meeting.description}</CardContent>
            </Card>
          )}

          <Card className="border-border/50 bg-card/70">
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold">Agenda &amp; notes</CardTitle>
              <Button size="sm" variant="secondary" className="gap-2" onClick={() => void saveWorkspace()}>
                <Save className="size-3.5" /> Save
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {agenda.length === 0 ? (
                <p className="text-sm text-muted-foreground">No agenda points were added.</p>
              ) : (
                <ul className="space-y-2">
                  {agenda.map((item) => (
                    <li key={item.id} className="flex items-start gap-2 text-sm">
                      <Checkbox
                        checked={!!item.done}
                        onCheckedChange={(checked) =>
                          setAgenda((items) =>
                            items.map((entry) =>
                              entry.id === item.id ? { ...entry, done: checked === true } : entry,
                            ),
                          )
                        }
                        className="mt-0.5"
                      />
                      <span className={cn(item.done && "text-muted-foreground line-through")}>{item.text}</span>
                    </li>
                  ))}
                </ul>
              )}

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="meeting-notes">Meeting notes</Label>
                <Textarea
                  id="meeting-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={8}
                  placeholder="Decisions, numbers, and anything the team should remember."
                />
              </div>

              <div className="space-y-2">
                <Label>Action items</Label>
                <div className="flex gap-2">
                  <Input
                    value={actionDraft}
                    onChange={(event) => setActionDraft(event.target.value)}
                    placeholder="Who is doing what next?"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && actionDraft.trim()) {
                        event.preventDefault();
                        setActions((items) => [...items, { id: newId(), text: actionDraft.trim() }]);
                        setActionDraft("");
                      }
                    }}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (!actionDraft.trim()) return;
                      setActions((items) => [...items, { id: newId(), text: actionDraft.trim() }]);
                      setActionDraft("");
                    }}
                  >
                    Add
                  </Button>
                </div>
                <ul className="space-y-1">
                  {actions.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-sm"
                    >
                      <Checkbox
                        checked={!!item.done}
                        onCheckedChange={(checked) =>
                          setActions((items) =>
                            items.map((entry) =>
                              entry.id === item.id ? { ...entry, done: checked === true } : entry,
                            ),
                          )
                        }
                      />
                      <span className={cn("flex-1", item.done && "text-muted-foreground line-through")}>
                        {item.text}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActions((items) => items.filter((entry) => entry.id !== item.id))}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-border/50 bg-card/70">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Users className="size-4" /> Invited ({guests.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {guests.map((guest) => (
                <div key={guest.id} className="flex items-center gap-3">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-[11px]">
                      {(guest.name ?? "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {guest.name}
                      {guest.participant_role === "host" && (
                        <span className="ml-2 text-[11px] text-muted-foreground">Host</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{guest.email}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[11px]">
                    {RESPONSE_LABEL[guest.response] ?? guest.response}
                  </Badge>
                </div>
              ))}
              {guests.length === 0 && (
                <p className="text-sm text-muted-foreground">No one has been invited yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Attendance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {attended.length === 0 ? (
                <p className="text-sm text-muted-foreground">No one has joined the room yet.</p>
              ) : (
                attended.map((row) => {
                  const guest = guests.find((entry) => entry.user_id === row.user_id);
                  return (
                    <div key={row.id} className="flex items-center justify-between text-sm">
                      <span className="truncate">{guest?.name ?? "Team member"}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(row.joined_at).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {row.seconds > 0 ? ` · ${durationLabel(row.seconds)}` : " · in room"}
                      </span>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
