import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface OnboardingEmailResult {
  ok: boolean;
  status: "sent" | "failed" | "unavailable";
  reason?: string;
}

interface SendInput {
  candidateId: string;
  templateKey: string;
  /** Onboarding stage this email belongs to, for the email log. */
  stage?: string;
  trigger?: string;
  links?: Record<string, string>;
}

/**
 * Renders a configurable onboarding email template, sends it through the
 * transactional email provider when a key is configured, and always records the
 * attempt in the onboarding email log.
 */
export const sendOnboardingEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SendInput) => input)
  .handler(async ({ data, context }): Promise<OnboardingEmailResult> => {
    const { sendOnboardingTemplate } = await import("./onboarding-email.server");
    return sendOnboardingTemplate(context.supabase, {
      candidateId: data.candidateId,
      templateKey: data.templateKey,
      stage: data.stage ?? null,
      trigger: data.trigger ?? "manual",
      ...(data.links ? { links: data.links } : {}),
    });
  });

/** Runs every due step of the automated hiring email sequence right now. */
export const runHiringSequenceNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { runHiringSequences } = await import("./onboarding-sequence.server");
    return runHiringSequences(context.supabase);
  });
