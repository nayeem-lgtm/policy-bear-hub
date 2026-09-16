/**
 * Shared (workspace-wide) hiring automation: one interview booking window and
 * one set of automation switches that apply to every candidate, plus helpers
 * that lazily create each candidate's personal booking link from those
 * defaults — so nobody has to configure interviews candidate by candidate.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface AutomationSettings {
  id: string;
  interview_days_ahead: number;
  daily_start: string;
  daily_end: string;
  slot_minutes: number;
  timezone: string;
  meeting_link: string | null;
  auto_interview_invite: boolean;
  auto_form_invite: boolean;
}

export function appBaseUrl() {
  return (process.env["PUBLIC_APP_URL"] ?? "https://policy-bear-hub.lovable.app").replace(/\/$/, "");
}

/** Reads the single shared settings row, creating it if it is missing. */
export async function getAutomationSettings(supabase: any): Promise<AutomationSettings> {
  const { data } = await supabase
    .from("onboarding_automation_settings")
    .select("*")
    .eq("singleton", true)
    .maybeSingle();
  if (data) return data as AutomationSettings;

  const { data: created, error } = await supabase
    .from("onboarding_automation_settings")
    .insert({ singleton: true })
    .select("*")
    .single();
  if (error) throw error;
  return created as AutomationSettings;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Returns the candidate's active booking token, creating an availability window
 * from the shared settings when they do not have one yet.
 */
export async function ensureCandidateBookingToken(
  supabase: any,
  candidateId: string,
  settings?: AutomationSettings,
  createdBy?: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("onboarding_interview_availability")
    .select("booking_token,ends_on")
    .eq("candidate_id", candidateId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .maybeSingle();

  const today = dateKey(new Date());
  if (existing && existing.ends_on >= today) return existing.booking_token as string;

  const config = settings ?? (await getAutomationSettings(supabase));
  const end = new Date();
  end.setDate(end.getDate() + Math.max(1, config.interview_days_ahead));

  if (existing) {
    await supabase
      .from("onboarding_interview_availability")
      .update({ is_active: false })
      .eq("candidate_id", candidateId)
      .eq("is_active", true);
  }

  const { data: created, error } = await supabase
    .from("onboarding_interview_availability")
    .insert({
      candidate_id: candidateId,
      starts_on: today,
      ends_on: dateKey(end),
      daily_start: config.daily_start,
      daily_end: config.daily_end,
      slot_minutes: config.slot_minutes,
      timezone: config.timezone,
      meeting_link: config.meeting_link,
      ...(createdBy ? { created_by: createdBy } : {}),
    })
    .select("booking_token")
    .single();
  if (error) throw error;
  return created.booking_token as string;
}

/** Public booking URL for a candidate, generated from the shared settings. */
export async function candidateBookingLink(
  supabase: any,
  candidateId: string,
  settings?: AutomationSettings,
  createdBy?: string,
) {
  const token = await ensureCandidateBookingToken(supabase, candidateId, settings, createdBy);
  return `${appBaseUrl()}/book-interview/${token}`;
}
