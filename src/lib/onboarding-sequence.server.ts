/**
 * Automated hiring email sequence engine.
 *
 * Each configured step is timed from a candidate anchor (interview scheduled,
 * interview start, interview completed). A step is sent once the due time has
 * passed and no successful send for that template exists yet for the candidate.
 */

import { sendOnboardingTemplate } from "./onboarding-email.server";

export interface SequenceRunResult {
  checked: number;
  sent: number;
  skipped: number;
  failed: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function runHiringSequences(supabase: any): Promise<SequenceRunResult> {
  const [{ data: steps }, { data: candidates }] = await Promise.all([
    supabase
      .from("onboarding_sequence_steps")
      .select("*")
      .eq("enabled", true)
      .order("sort_order"),
    supabase
      .from("onboarding_candidates")
      .select("id,stage,interview_at,interview_completed_at,sequence_paused")
      .eq("sequence_paused", false)
      .in("stage", ["Candidate", "Interview Scheduled", "Interview Completed", "Pending Hiring Decision"]),
  ]);

  const result: SequenceRunResult = { checked: 0, sent: 0, skipped: 0, failed: 0 };
  if (!steps?.length || !candidates?.length) return result;

  const now = Date.now();

  for (const candidate of candidates) {
    const { data: log } = await supabase
      .from("onboarding_emails")
      .select("template_key,status")
      .eq("candidate_id", candidate.id);
    const alreadySent = new Set(
      (log ?? []).filter((row: any) => row.status === "sent").map((row: any) => row.template_key),
    );

    for (const step of steps) {
      result.checked += 1;
      const due = dueTime(step, candidate);
      if (due === null || due > now || alreadySent.has(step.template_key)) {
        result.skipped += 1;
        continue;
      }

      const outcome = await sendOnboardingTemplate(supabase, {
        candidateId: candidate.id,
        templateKey: step.template_key,
        stage: candidate.stage,
        trigger: `automated · ${step.name}`,
      });
      if (outcome.status === "sent") {
        result.sent += 1;
        alreadySent.add(step.template_key);
        await supabase.from("onboarding_events").insert({
          candidate_id: candidate.id,
          event: "Automated email sent",
          detail: step.name,
          source: "system",
        });
      } else {
        result.failed += 1;
      }
    }
  }

  return result;
}

function dueTime(step: any, candidate: any): number | null {
  const offset = (step.offset_minutes ?? 0) * 60_000;
  if (step.anchor === "interview_scheduled") {
    if (!candidate.interview_at) return null;
    return Date.now() + offset;
  }
  if (step.anchor === "interview_start") {
    if (!candidate.interview_at) return null;
    return new Date(candidate.interview_at).getTime() + offset;
  }
  if (step.anchor === "interview_completed") {
    if (!candidate.interview_completed_at) return null;
    return new Date(candidate.interview_completed_at).getTime() + offset;
  }
  return null;
}
