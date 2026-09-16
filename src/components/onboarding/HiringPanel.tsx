import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, Mail, PauseCircle, PlayCircle, Send, Zap } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { InterviewScheduler } from "@/components/onboarding/InterviewScheduler";
import { cn } from "@/lib/utils";
import { runHiringSequenceNow, sendOnboardingEmail } from "@/lib/onboarding.functions";
import {
  fetchEmails,
  fetchSequenceSteps,
  offsetLabel,
  setSequencePaused,
  stampLabel,
  type Candidate,
  type SequenceStep,
} from "@/lib/onboarding";

/** Interview scheduling + the automated hiring email sequence for one candidate. */
export function HiringPanel({
  candidate,
  actor,
  onChanged,
}: {
  candidate: Candidate;
  actor: string;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const send = useServerFn(sendOnboardingEmail);
  const runNow = useServerFn(runHiringSequenceNow);

  const stepsQuery = useQuery({ queryKey: ["onboarding-sequence-steps"], queryFn: fetchSequenceSteps });
  const emailsQuery = useQuery({
    queryKey: ["onboarding-emails", candidate.id],
    queryFn: () => fetchEmails(candidate.id),
  });

  const refresh = () => {
    onChanged();
    void queryClient.invalidateQueries({ queryKey: ["onboarding-emails", candidate.id] });
  };

  const act = useMutation({
    mutationFn: async (action: () => Promise<void>) => action(),
    onSuccess: () => refresh(),
    onError: () => toast.error("That action could not be completed."),
  });

  const sendStep = useMutation({
    mutationFn: async (step: SequenceStep) =>
      send({
        data: {
          candidateId: candidate.id,
          templateKey: step.template_key,
          stage: "Hiring",
          trigger: `manual · ${step.name}`,
        },
      }),
    onSuccess: (result) => {
      if (result.status === "sent") toast.success("Email sent to the candidate");
      else if (result.status === "unavailable")
        toast.warning("Email logged, but not delivered", {
          description: "No email service is connected yet — set up your sending domain to deliver it.",
        });
      else toast.error(result.reason ?? "The email could not be sent");
      refresh();
    },
    onError: () => toast.error("The email could not be sent."),
  });

  const runSequence = useMutation({
    mutationFn: () => runNow({ data: undefined as never }),
    onSuccess: (result) => {
      toast.success(`Sequence run complete — ${result.sent} sent, ${result.skipped} not due yet`);
      refresh();
    },
    onError: () => toast.error("The sequence could not run."),
  });

  const sentByTemplate = new Map<string, string>();
  for (const row of emailsQuery.data ?? []) {
    if (row.status === "sent" && !sentByTemplate.has(row.template_key))
      sentByTemplate.set(row.template_key, row.sent_at ?? row.created_at);
  }

  const steps = stepsQuery.data ?? [];

  return (
    <div className="space-y-3">
      <InterviewScheduler candidate={candidate} actor={actor} onChanged={refresh} />

      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() => void act.mutateAsync(() => setSequencePaused(candidate, !candidate.sequence_paused, actor))}
        >
          {candidate.sequence_paused ? <><PlayCircle className="size-4" /> Resume automated emails</> : <><PauseCircle className="size-4" /> Pause automated emails</>}
        </Button>
      </div>

      <Card className="rounded-2xl border-white/70 bg-card/70 p-4 shadow-card backdrop-blur-xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-brand/10 text-brand">
              <Zap className="size-4" />
            </span>
            <h2 className="font-display text-sm font-bold tracking-tight">Automated email sequence</h2>
            {candidate.sequence_paused && <Badge variant="secondary">Paused</Badge>}
          </div>
          <Button size="sm" variant="outline" disabled={runSequence.isPending} onClick={() => runSequence.mutate()}>
            <Send className="size-4" /> Send everything due now
          </Button>
        </div>

        <div className="space-y-2">
          {steps.map((step) => {
            const sentAt = sentByTemplate.get(step.template_key);
            const dueAt = dueTimeLabel(step, candidate);
            return (
              <div
                key={step.id}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-xl border p-3",
                  sentAt ? "border-success/30 bg-success/5" : "border-border/60 bg-muted/30",
                )}
              >
                <span className="grid size-7 place-items-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                  {step.sort_order}
                </span>
                <div className="min-w-[12rem] flex-1">
                  <p className="text-sm font-semibold">{step.name}</p>
                  <p className="text-[0.68rem] text-muted-foreground">
                    {offsetLabel(step)} · {step.enabled ? "enabled" : "disabled"}
                  </p>
                </div>
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  {sentAt ? (
                    <>
                      <CheckCircle2 className="size-3.5 text-success" /> Sent {stampLabel(sentAt)}
                    </>
                  ) : (
                    <>
                      <Clock className="size-3.5 text-muted-foreground" /> {dueAt}
                    </>
                  )}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={sendStep.isPending}
                  onClick={() => sendStep.mutate(step)}
                >
                  <Mail className="size-4" /> {sentAt ? "Resend" : "Send now"}
                </Button>
              </div>
            );
          })}
          {!steps.length && (
            <p className="text-sm text-muted-foreground">No sequence steps configured yet.</p>
          )}
        </div>

        <Separator className="my-3" />
        <p className="text-xs text-muted-foreground">
          Reminders and follow-ups go out automatically once the interview is scheduled or completed. Edit the
          wording and timing from “Email automation” on the onboarding pipeline.
        </p>
      </Card>
    </div>
  );
}

function dueTimeLabel(step: SequenceStep, candidate: Candidate) {
  const offset = (step.offset_minutes ?? 0) * 60_000;
  if (step.anchor === "interview_scheduled")
    return candidate.interview_at ? "Due now" : "Waiting for interview date";
  if (step.anchor === "interview_start") {
    if (!candidate.interview_at) return "Waiting for interview date";
    return `Due ${stampLabel(new Date(new Date(candidate.interview_at).getTime() + offset).toISOString())}`;
  }
  if (!candidate.interview_completed_at) return "Waiting for completed interview";
  return `Due ${stampLabel(new Date(new Date(candidate.interview_completed_at).getTime() + offset).toISOString())}`;
}
