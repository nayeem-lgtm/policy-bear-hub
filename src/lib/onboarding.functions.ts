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
    const { supabase } = context;

    const [{ data: candidate }, { data: template }] = await Promise.all([
      supabase
        .from("onboarding_candidates")
        .select("id,first_name,last_name,email")
        .eq("id", data.candidateId)
        .maybeSingle(),
      supabase
        .from("onboarding_templates")
        .select("template_key,name,subject,body")
        .eq("template_key", data.templateKey)
        .maybeSingle(),
    ]);

    if (!candidate || !template) {
      return { ok: false, status: "failed", reason: "Candidate or template not found" };
    }

    const variables: Record<string, string> = {
      agent_first_name: candidate.first_name || "there",
      agent_last_name: candidate.last_name || "",
      agent_email: candidate.email,
      company_name: "PolicyBear",
      onboarding_form_link: data.links?.["onboarding_form_link"] ?? "",
      offer_letter_link: data.links?.["offer_letter_link"] ?? "",
      employment_agreement_link: data.links?.["employment_agreement_link"] ?? "",
    };

    const render = (input: string) =>
      input.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_match, key: string) => variables[key] ?? "");

    const subject = render(template.subject);
    const body = render(template.body);
    const apiKey = process.env["RESEND_API_KEY"];

    const logRow = {
      candidate_id: candidate.id,
      template_key: template.template_key,
      email_type: template.name,
      recipient: candidate.email,
      subject,
      stage: data.stage ?? null,
      trigger: data.trigger ?? "manual",
      sender: process.env["ONBOARDING_EMAIL_FROM"] ?? "PolicyBear Onboarding",
    };

    if (!apiKey) {
      await supabase.from("onboarding_emails").insert({
        ...logRow,
        status: "unavailable",
        error: "No email provider key configured",
      });
      return { ok: false, status: "unavailable", reason: "No email provider connected yet" };
    }

    const html = `<div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
      <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin:0 0 10px">PolicyBear agent onboarding</p>
      <h1 style="font-size:22px;margin:0 0 18px">${escapeHtml(subject)}</h1>
      <div style="font-size:14px;line-height:1.7;white-space:pre-wrap">${escapeHtml(body)}</div>
      <p style="font-size:12px;color:#94a3b8;margin-top:28px">A product of Ray Advertising</p>
    </div>`;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env["ONBOARDING_EMAIL_FROM"] ?? "PolicyBear Onboarding <onboarding@resend.dev>",
          to: [candidate.email],
          subject,
          html,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        await supabase
          .from("onboarding_emails")
          .insert({ ...logRow, status: "failed", error: detail.slice(0, 400) });
        return { ok: false, status: "failed", reason: "The email provider rejected the message" };
      }

      await supabase
        .from("onboarding_emails")
        .insert({ ...logRow, status: "sent", sent_at: new Date().toISOString() });
      return { ok: true, status: "sent" };
    } catch (error) {
      await supabase
        .from("onboarding_emails")
        .insert({ ...logRow, status: "failed", error: String(error).slice(0, 400) });
      return { ok: false, status: "failed", reason: "The email could not be delivered" };
    }
  });

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
