import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const uuid = z.string().uuid();

const availabilityInput = z.object({
  candidateId: uuid,
  startsOn: z.string().date(),
  endsOn: z.string().date(),
  dailyStart: z.string().regex(/^\d{2}:\d{2}$/),
  dailyEnd: z.string().regex(/^\d{2}:\d{2}$/),
  slotMinutes: z.number().int().min(15).max(120),
  timezone: z.string().min(1).max(100),
  meetingLink: z.string().url().or(z.literal("")),
});

async function requireOnboardingManager(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data, error } = await supabase.rpc("can_manage_onboarding", { _user_id: userId });
  if (error || !data) throw new Error("You do not have permission to manage interview availability.");
}

export const getCandidateInterviewAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { candidateId: string }) => ({ candidateId: uuid.parse(input.candidateId) }))
  .handler(async ({ data, context }) => {
    await requireOnboardingManager(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("onboarding_interview_availability")
      .select("*")
      .eq("candidate_id", data.candidateId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const createCandidateInterviewAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof availabilityInput>) => availabilityInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireOnboardingManager(context.supabase, context.userId);
    if (data.endsOn < data.startsOn) throw new Error("The end date must be on or after the start date.");
    if (data.dailyEnd <= data.dailyStart) throw new Error("The end time must be after the start time.");

    await context.supabase
      .from("onboarding_interview_availability")
      .update({ is_active: false })
      .eq("candidate_id", data.candidateId)
      .eq("is_active", true);

    const { data: created, error } = await context.supabase
      .from("onboarding_interview_availability")
      .insert({
        candidate_id: data.candidateId,
        starts_on: data.startsOn,
        ends_on: data.endsOn,
        daily_start: data.dailyStart,
        daily_end: data.dailyEnd,
        slot_minutes: data.slotMinutes,
        timezone: data.timezone,
        meeting_link: data.meetingLink || null,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw error;

    await context.supabase.from("onboarding_events").insert({
      candidate_id: data.candidateId,
      event: "Interview booking link created",
      detail: `${data.startsOn} through ${data.endsOn} · ${data.dailyStart}–${data.dailyEnd} · ${data.timezone}`,
      actor: context.claims.email ?? "Administrator",
      source: "user",
    });
    return created;
  });

export const disableCandidateInterviewAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { availabilityId: string }) => ({ availabilityId: uuid.parse(input.availabilityId) }))
  .handler(async ({ data, context }) => {
    await requireOnboardingManager(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("onboarding_interview_availability")
      .update({ is_active: false })
      .eq("id", data.availabilityId);
    if (error) throw error;
    return { ok: true };
  });

export interface PublicBookingPage {
  availabilityId: string;
  candidateFirstName: string;
  startsOn: string;
  endsOn: string;
  dailyStart: string;
  dailyEnd: string;
  slotMinutes: number;
  timezone: string;
  isActive: boolean;
  bookedStartsAt: string | null;
  meetingLink: string | null;
  availableSlots: string[];
}

export const getPublicInterviewBookingPage = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => ({ token: uuid.parse(input.token) }))
  .handler(async ({ data }): Promise<PublicBookingPage | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: page, error } = await supabaseAdmin.rpc("get_interview_booking_page", { _token: data.token });
    if (error) throw error;
    return page as unknown as PublicBookingPage | null;
  });

export const bookPublicInterviewSlot = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; startsAt: string }) => ({
    token: uuid.parse(input.token),
    startsAt: z.string().datetime().parse(input.startsAt),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("book_interview_slot", {
      _token: data.token,
      _starts_at: data.startsAt,
    });
    if (error) throw new Error(error.message);
    return result as unknown as { startsAt: string; endsAt: string; timezone: string; meetingLink: string | null };
  });
/* --------------------------------------------- shared hiring automation setup */

export interface HiringAutomation {
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

/** The one interview window + automation switches used for every candidate. */
export const getHiringAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HiringAutomation> => {
    await requireOnboardingManager(context.supabase, context.userId);
    const { getAutomationSettings } = await import("./onboarding-automation.server");
    return (await getAutomationSettings(context.supabase)) as HiringAutomation;
  });

const automationInput = z.object({
  interviewDaysAhead: z.number().int().min(1).max(120),
  dailyStart: z.string().regex(/^\d{2}:\d{2}$/),
  dailyEnd: z.string().regex(/^\d{2}:\d{2}$/),
  slotMinutes: z.number().int().min(15).max(120),
  timezone: z.string().min(1).max(100),
  meetingLink: z.string().url().or(z.literal("")),
  autoInterviewInvite: z.boolean(),
  autoFormInvite: z.boolean(),
});

export const saveHiringAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof automationInput>) => automationInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireOnboardingManager(context.supabase, context.userId);
    if (data.dailyEnd <= data.dailyStart) throw new Error("The end time must be after the start time.");
    const { getAutomationSettings } = await import("./onboarding-automation.server");
    const current = await getAutomationSettings(context.supabase);
    const { error } = await context.supabase
      .from("onboarding_automation_settings")
      .update({
        interview_days_ahead: data.interviewDaysAhead,
        daily_start: data.dailyStart,
        daily_end: data.dailyEnd,
        slot_minutes: data.slotMinutes,
        timezone: data.timezone,
        meeting_link: data.meetingLink || null,
        auto_interview_invite: data.autoInterviewInvite,
        auto_form_invite: data.autoFormInvite,
        updated_by: context.userId,
      })
      .eq("id", current.id);
    if (error) throw error;
    return { ok: true };
  });

/** Booking link for one candidate, created automatically from the shared window. */
export const ensureCandidateBookingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { candidateId: string }) => ({ candidateId: uuid.parse(input.candidateId) }))
  .handler(async ({ data, context }) => {
    await requireOnboardingManager(context.supabase, context.userId);
    const { candidateBookingLink } = await import("./onboarding-automation.server");
    return { url: await candidateBookingLink(context.supabase, data.candidateId, undefined, context.userId) };
  });
