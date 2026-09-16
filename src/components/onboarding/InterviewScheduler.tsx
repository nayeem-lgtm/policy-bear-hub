import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, CheckCircle2, Clock3, Copy, Link2, LockKeyhole, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  disableCandidateInterviewAvailability,
  ensureCandidateBookingLink,
  getCandidateInterviewAvailability,
  getHiringAutomation,
} from "@/lib/interview-booking.functions";
import { markInterviewCompleted, scheduleInterview, stampLabel, type Candidate } from "@/lib/onboarding";

const DURATIONS = [15, 30, 45, 60];

/**
 * Per-candidate interview view. The booking link is generated automatically
 * from the shared interview window, so no setup happens here — the manual tab
 * only exists for one-off exceptions.
 */
export function InterviewScheduler({ candidate, actor, onChanged }: { candidate: Candidate; actor: string; onChanged: () => void }) {
  const queryClient = useQueryClient();
  const getAvailability = useServerFn(getCandidateInterviewAvailability);
  const ensureLink = useServerFn(ensureCandidateBookingLink);
  const disableAvailability = useServerFn(disableCandidateInterviewAvailability);
  const loadAutomation = useServerFn(getHiringAutomation);
  const [mode, setMode] = useState<"self" | "manual">("self");
  const [duration, setDuration] = useState(candidate.interview_duration_minutes ?? 30);
  const [link, setLink] = useState(candidate.interview_link ?? "");
  const [notes, setNotes] = useState(candidate.interview_notes ?? "");
  const [at, setAt] = useState(toLocalInput(candidate.interview_at));

  const automationQuery = useQuery({ queryKey: ["hiring-automation"], queryFn: () => loadAutomation({ data: undefined as never }) });
  const availabilityQuery = useQuery({
    queryKey: ["candidate-interview-availability", candidate.id],
    queryFn: () => getAvailability({ data: { candidateId: candidate.id } }),
  });
  const active = useMemo(() => availabilityQuery.data?.find((row) => row.is_active), [availabilityQuery.data]);

  // Auto-create the link from the shared window the first time it is needed.
  const linkQuery = useQuery({
    queryKey: ["candidate-booking-link", candidate.id],
    queryFn: () => ensureLink({ data: { candidateId: candidate.id } }),
  });
  const bookingUrl = linkQuery.data?.url ?? "";

  const refresh = () => {
    onChanged();
    void queryClient.invalidateQueries({ queryKey: ["candidate-interview-availability", candidate.id] });
    void queryClient.invalidateQueries({ queryKey: ["candidate-booking-link", candidate.id] });
  };

  const manual = useMutation({
    mutationFn: () => scheduleInterview(candidate, { at, durationMinutes: duration, link, notes }, actor),
    onSuccess: () => { toast.success(candidate.interview_at ? "Interview rescheduled" : "Interview scheduled"); onChanged(); },
    onError: () => toast.error("The interview could not be scheduled."),
  });
  const complete = useMutation({
    mutationFn: () => markInterviewCompleted(candidate, actor, notes),
    onSuccess: () => { toast.success("Interview marked complete"); onChanged(); },
  });

  const automation = automationQuery.data;

  return (
    <Card className="rounded-xl border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><CalendarClock className="size-4" /></span>
          <div>
            <h2 className="font-display text-sm font-bold">Interview scheduling</h2>
            <p className="text-xs text-muted-foreground">Booking link is created automatically for every candidate.</p>
          </div>
        </div>
        {candidate.interview_at && <Badge variant="secondary">{candidate.interview_completed_at ? "Completed" : "Booked · " + stampLabel(candidate.interview_at)}</Badge>}
      </div>

      <div className="mt-4 inline-flex rounded-lg border border-border bg-muted p-1">
        <Button size="sm" variant={mode === "self" ? "default" : "ghost"} onClick={() => setMode("self")}><Link2 className="size-4" /> Candidate books</Button>
        <Button size="sm" variant={mode === "manual" ? "default" : "ghost"} onClick={() => setMode("manual")}><CalendarClock className="size-4" /> Set a time myself</Button>
      </div>

      {mode === "self" ? (
        <div className="mt-4 rounded-lg border border-primary/25 bg-primary/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span className="size-2 rounded-full bg-success" /> Booking page is ready
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {active
                  ? `${active.starts_on} to ${active.ends_on} · ${active.daily_start.slice(0, 5)}–${active.daily_end.slice(0, 5)} · ${active.slot_minutes} minutes`
                  : automation
                    ? `Next ${automation.interview_days_ahead} days · ${automation.daily_start.slice(0, 5)}–${automation.daily_end.slice(0, 5)} · ${automation.slot_minutes} minutes`
                    : "Loading the shared interview window…"}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={!bookingUrl}
              onClick={() => { void navigator.clipboard.writeText(bookingUrl); toast.success("Booking link copied"); }}
            >
              <Copy className="size-4" /> Copy link
            </Button>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-card p-2">
            <LockKeyhole className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-xs">{bookingUrl || "Preparing link…"}</span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            This link goes out automatically with the interview invitation email. Dates, hours, booking page and
            emails are set once for everyone in{" "}
            <Link to="/admin/hiring-setup" className="font-semibold text-primary underline">
              Interview &amp; email setup
            </Link>
            .
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={refresh}><RefreshCw className="size-4" /> Refresh from shared settings</Button>
            {active && (
              <Button size="sm" variant="ghost" onClick={() => void disableAvailability({ data: { availabilityId: active.id } }).then(refresh)}>
                <XCircle className="size-4" /> Turn off for this candidate
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><Label className="text-xs">Date &amp; time</Label><Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></div>
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
