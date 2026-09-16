import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, CheckCircle2, Clock3, Copy, Link2, LockKeyhole, Plus, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createCandidateInterviewAvailability,
  disableCandidateInterviewAvailability,
  getCandidateInterviewAvailability,
} from "@/lib/interview-booking.functions";
import { markInterviewCompleted, scheduleInterview, stampLabel, type Candidate } from "@/lib/onboarding";

const DURATIONS = [15, 30, 45, 60];
const TIMEZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"];

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rangeLabel(range?: DateRange) {
  if (!range?.from) return "Choose available dates";
  const format = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
  return range.to ? `${format.format(range.from)} – ${format.format(range.to)}` : format.format(range.from);
}

export function InterviewScheduler({ candidate, actor, onChanged }: { candidate: Candidate; actor: string; onChanged: () => void }) {
  const queryClient = useQueryClient();
  const getAvailability = useServerFn(getCandidateInterviewAvailability);
  const createAvailability = useServerFn(createCandidateInterviewAvailability);
  const disableAvailability = useServerFn(disableCandidateInterviewAvailability);
  const [mode, setMode] = useState<"self" | "manual">("self");
  const [range, setRange] = useState<DateRange>();
  const [dailyStart, setDailyStart] = useState("09:00");
  const [dailyEnd, setDailyEnd] = useState("17:00");
  const [duration, setDuration] = useState(candidate.interview_duration_minutes ?? 30);
  const [timezone, setTimezone] = useState("America/New_York");
  const [link, setLink] = useState(candidate.interview_link ?? "");
  const [notes, setNotes] = useState(candidate.interview_notes ?? "");
  const [at, setAt] = useState(toLocalInput(candidate.interview_at));

  const availabilityQuery = useQuery({
    queryKey: ["candidate-interview-availability", candidate.id],
    queryFn: () => getAvailability({ data: { candidateId: candidate.id } }),
  });
  const active = useMemo(() => availabilityQuery.data?.find((row) => row.is_active), [availabilityQuery.data]);
  const bookingUrl = active && typeof window !== "undefined" ? `${window.location.origin}/book-interview/${active.booking_token}` : "";

  const refresh = () => {
    onChanged();
    void queryClient.invalidateQueries({ queryKey: ["candidate-interview-availability", candidate.id] });
  };
  const saveAvailability = useMutation({
    mutationFn: () => {
      if (!range?.from) throw new Error("Choose the first available date.");
      const end = range.to ?? range.from;
      return createAvailability({ data: { candidateId: candidate.id, startsOn: dateKey(range.from), endsOn: dateKey(end), dailyStart, dailyEnd, slotMinutes: duration, timezone, meetingLink: link } });
    },
    onSuccess: () => { toast.success("Candidate booking link created"); refresh(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "The booking link could not be created."),
  });
  const manual = useMutation({
    mutationFn: () => scheduleInterview(candidate, { at, durationMinutes: duration, link, notes }, actor),
    onSuccess: () => { toast.success(candidate.interview_at ? "Interview rescheduled" : "Interview scheduled"); onChanged(); },
    onError: () => toast.error("The interview could not be scheduled."),
  });
  const complete = useMutation({
    mutationFn: () => markInterviewCompleted(candidate, actor, notes),
    onSuccess: () => { toast.success("Interview marked complete"); onChanged(); },
  });

  return (
    <Card className="rounded-xl border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><CalendarClock className="size-4" /></span>
          <div><h2 className="font-display text-sm font-bold">Interview scheduling</h2><p className="text-xs text-muted-foreground">Open times for the candidate or schedule directly.</p></div>
        </div>
        {candidate.interview_at && <Badge variant="secondary">{candidate.interview_completed_at ? "Completed" : "Booked · " + stampLabel(candidate.interview_at)}</Badge>}
      </div>

      <div className="mt-4 inline-flex rounded-lg border border-border bg-muted p-1">
        <Button size="sm" variant={mode === "self" ? "default" : "ghost"} onClick={() => setMode("self")}><Link2 className="size-4" /> Candidate self-books</Button>
        <Button size="sm" variant={mode === "manual" ? "default" : "ghost"} onClick={() => setMode("manual")}><CalendarClock className="size-4" /> Schedule manually</Button>
      </div>

      {mode === "self" ? (
        <div className="mt-4">
          {active ? (
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="flex items-center gap-2 text-sm font-semibold"><span className="size-2 rounded-full bg-success" />Booking page is active</p><p className="mt-1 text-xs text-muted-foreground">{active.starts_on} to {active.ends_on} · {active.daily_start.slice(0, 5)}–{active.daily_end.slice(0, 5)} · {active.slot_minutes} minutes</p></div>
                <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(bookingUrl); toast.success("Booking link copied"); }}><Copy className="size-4" /> Copy link</Button>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-card p-2"><LockKeyhole className="size-4 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate text-xs">{bookingUrl}</span></div>
              <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setRange({ from: new Date(active.starts_on + "T12:00:00"), to: new Date(active.ends_on + "T12:00:00") })}><Plus className="size-4" /> Replace availability</Button><Button size="sm" variant="ghost" onClick={() => void disableAvailability({ data: { availabilityId: active.id } }).then(refresh)}><XCircle className="size-4" /> Disable link</Button></div>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
              <div className="rounded-lg border border-border bg-background"><Calendar mode="range" selected={range} onSelect={setRange} disabled={{ before: new Date() }} className="pointer-events-auto" /></div>
              <div className="space-y-3">
                <div><Label className="text-xs">Available date range</Label><p className="mt-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-medium">{rangeLabel(range)}</p></div>
                <div className="grid grid-cols-2 gap-3"><div><Label className="text-xs">From</Label><Input type="time" value={dailyStart} onChange={(e) => setDailyStart(e.target.value)} /></div><div><Label className="text-xs">Until</Label><Input type="time" value={dailyEnd} onChange={(e) => setDailyEnd(e.target.value)} /></div></div>
                <div className="grid grid-cols-2 gap-3"><div><Label className="text-xs">Interview length</Label><Select value={String(duration)} onValueChange={(value) => setDuration(Number(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DURATIONS.map((value) => <SelectItem key={value} value={String(value)}>{value} minutes</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs">Timezone</Label><Select value={timezone} onValueChange={setTimezone}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIMEZONES.map((value) => <SelectItem key={value} value={value}>{value.replace("America/", "")}</SelectItem>)}</SelectContent></Select></div></div>
                <div><Label className="text-xs">Custom meeting link</Label><Input type="url" placeholder="https://meet.google.com/…" value={link} onChange={(e) => setLink(e.target.value)} /></div>
                <Button disabled={!range?.from || !link || saveAvailability.isPending} onClick={() => saveAvailability.mutate()}><Link2 className="size-4" /> Create candidate booking link</Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><Label className="text-xs">Date & time</Label><Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></div>
          <div><Label className="text-xs">Length</Label><Select value={String(duration)} onValueChange={(value) => setDuration(Number(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DURATIONS.map((value) => <SelectItem key={value} value={String(value)}>{value} minutes</SelectItem>)}</SelectContent></Select></div>
          <div className="sm:col-span-2"><Label className="text-xs">Custom meeting link</Label><Input value={link} onChange={(e) => setLink(e.target.value)} /></div>
          <div className="sm:col-span-2"><Label className="text-xs">Internal notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="flex flex-wrap gap-2 sm:col-span-2"><Button disabled={!at || manual.isPending} onClick={() => manual.mutate()}><Clock3 className="size-4" />{candidate.interview_at ? "Reschedule interview" : "Schedule interview"}</Button><Button variant="outline" disabled={!candidate.interview_at || !!candidate.interview_completed_at} onClick={() => complete.mutate()}><CheckCircle2 className="size-4" /> Mark completed</Button></div>
        </div>
      )}
    </Card>
  );
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}