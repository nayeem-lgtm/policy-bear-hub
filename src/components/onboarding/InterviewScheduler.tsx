import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, CheckCircle2, Copy, LockKeyhole, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  disableCandidateInterviewAvailability,
  ensureCandidateBookingLink,
  getCandidateInterviewAvailability,
} from "@/lib/interview-booking.functions";
import { markInterviewCompleted, stampLabel, type Candidate } from "@/lib/onboarding";

/**
 * Small per-candidate interview card. All setup (dates, hours, booking page,
 * emails) is centralised in Interview & email setup — this only shows the
 * candidate's own link and their booked time.
 */
export function InterviewScheduler({ candidate, actor, onChanged }: { candidate: Candidate; actor: string; onChanged: () => void }) {
  const queryClient = useQueryClient();
  const getAvailability = useServerFn(getCandidateInterviewAvailability);
  const ensureLink = useServerFn(ensureCandidateBookingLink);
  const disableAvailability = useServerFn(disableCandidateInterviewAvailability);

  const availabilityQuery = useQuery({
    queryKey: ["candidate-interview-availability", candidate.id],
    queryFn: () => getAvailability({ data: { candidateId: candidate.id } }),
  });
  const active = availabilityQuery.data?.find((row) => row.is_active);

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

  const complete = useMutation({
    mutationFn: () => markInterviewCompleted(candidate, actor, candidate.interview_notes ?? ""),
    onSuccess: () => { toast.success("Interview marked complete"); onChanged(); },
    onError: () => toast.error("That could not be saved."),
  });

  return (
    <Card className="rounded-xl border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><CalendarClock className="size-4" /></span>
          <div>
            <h2 className="font-display text-sm font-bold">Interview</h2>
            <p className="text-xs text-muted-foreground">
              Set up once for everyone in{" "}
              <Link to="/admin/onboarding/setup" className="font-semibold text-primary underline">
                Interview &amp; email setup
              </Link>
              .
            </p>
          </div>
        </div>
        {candidate.interview_at && (
          <Badge variant="secondary">
            {candidate.interview_completed_at ? "Completed" : "Booked · " + stampLabel(candidate.interview_at)}
          </Badge>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
        <LockKeyhole className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-xs">{bookingUrl || "Preparing this candidate's link…"}</span>
        <Button
          size="sm"
          variant="outline"
          disabled={!bookingUrl}
          onClick={() => { void navigator.clipboard.writeText(bookingUrl); toast.success("Booking link copied"); }}
        >
          <Copy className="size-4" /> Copy
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!candidate.interview_at || !!candidate.interview_completed_at || complete.isPending}
          onClick={() => complete.mutate()}
        >
          <CheckCircle2 className="size-4" /> Mark interview completed
        </Button>
        {active && (
          <Button size="sm" variant="ghost" onClick={() => void disableAvailability({ data: { availabilityId: active.id } }).then(refresh)}>
            <XCircle className="size-4" /> Turn off this link
          </Button>
        )}
      </div>
    </Card>
  );
}
