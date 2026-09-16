import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/* ------------------------------------------------------------------ types */

export type Candidate = Tables<"onboarding_candidates">;
export type OnboardingDocument = Tables<"onboarding_documents">;
export type OnboardingEvent = Tables<"onboarding_events">;
export type OnboardingNote = Tables<"onboarding_notes">;
export type OnboardingEmail = Tables<"onboarding_emails">;
export type EmailTemplate = Tables<"onboarding_templates">;

export const ONBOARDING_STAGES = [
  "Candidate",
  "Interview Scheduled",
  "Interview Completed",
  "Onboarding Form Submitted",
  "Pending Hiring Decision",
  "Hired / Finalized",
  "Offer Letter Sent",
  "Offer Letter Signed",
  "Carrier Approval Pending",
  "Carrier Approved",
  "Employment Agreement Sent",
  "Employment Agreement Signed",
  "PolicyBear Access Pending",
  "Onboarding Completed",
  "Not Hired",
] as const;

export type OnboardingStage = (typeof ONBOARDING_STAGES)[number];

export const HIRING_STAGES: OnboardingStage[] = [
  "Candidate",
  "Interview Scheduled",
  "Interview Completed",
  "Onboarding Form Submitted",
  "Pending Hiring Decision",
];

export const DOCUMENT_STATUSES = [
  "Missing",
  "Uploaded",
  "Under Review",
  "Approved",
  "Rejected",
  "Replacement Required",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export interface LicensingInfo {
  licenseState?: string;
  licenseNumber?: string;
  licenseType?: string;
  licenseStatus?: string;
  licenseExpires?: string;
  additionalStates?: string;
  npn?: string;
  notes?: string;
}

export interface BankingInfo {
  bankName?: string;
  accountHolder?: string;
  routingNumber?: string;
  accountNumber?: string;
  accountType?: string;
  notes?: string;
}

export interface AuthorizationInfo {
  backgroundCheck?: boolean;
  directDeposit?: boolean;
  accuracy?: boolean;
  eSignName?: string;
  eSignAt?: string;
  eSignAgent?: string;
}

export const LICENSE_TYPES = ["Life", "Health", "Life & Health", "Property & Casualty", "Other"];
export const LICENSE_STATUSES = ["Active", "Pending", "Expired", "Inactive"];
export const ACCOUNT_TYPES = ["Checking", "Savings"];
export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

export const REQUIRED_DOCUMENTS: { name: string; required: boolean }[] = [
  { name: "Government-issued photo ID", required: true },
  { name: "Insurance license certificate", required: true },
  { name: "Voided check or bank letter", required: true },
  { name: "Completed W-9", required: true },
  { name: "E&O insurance certificate", required: false },
  { name: "AML / anti-fraud training certificate", required: false },
];

export const ONBOARDING_BUCKET = "onboarding-docs";

/* ------------------------------------------------------- json field access */

export function licensing(candidate: Candidate): LicensingInfo {
  return (candidate.licensing ?? {}) as LicensingInfo;
}
export function banking(candidate: Candidate): BankingInfo {
  return (candidate.banking ?? {}) as BankingInfo;
}
export function authorizations(candidate: Candidate): AuthorizationInfo {
  return (candidate.authorizations ?? {}) as AuthorizationInfo;
}

export function fullName(candidate: Candidate) {
  return [candidate.first_name, candidate.last_name].filter(Boolean).join(" ").trim() || candidate.email;
}

export function maskValue(value?: string | null, visible = 4) {
  if (!value) return "—";
  const clean = String(value).replace(/\s/g, "");
  if (clean.length <= visible) return "•".repeat(clean.length);
  return "•".repeat(Math.max(clean.length - visible, 0)) + clean.slice(-visible);
}

export function dateLabel(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function stampLabel(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function daysSince(value?: string | null) {
  if (!value) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
}

/* ------------------------------------------------- sequential step machine */

export type StepState = "locked" | "ready" | "in-progress" | "done" | "blocked";

export interface OnboardingStep {
  key: "form" | "offer" | "carrier" | "agreement" | "access";
  index: string;
  label: string;
  status: string;
  state: StepState;
  lockReason?: string;
  detail?: string;
}

export function onboardingSteps(candidate: Candidate): OnboardingStep[] {
  const formDone = !!candidate.form_submitted_at;
  const hired = !!candidate.hired_at;
  const offerSigned = candidate.offer_status === "Signed";
  const carrierApproved = candidate.carrier_status === "Approved";
  const carrierRejected = candidate.carrier_status === "Rejected";
  const agreementSigned = candidate.agreement_status === "Signed";
  const accessDone = candidate.access_status === "Completed";

  const steps: OnboardingStep[] = [
    {
      key: "form",
      index: "00",
      label: "Agent onboarding form",
      status: formDone ? "Submitted" : "Awaiting agent",
      state: formDone ? "done" : "in-progress",
      detail: formDone ? stampLabel(candidate.form_submitted_at) : "Agent has not submitted the form yet",
    },
    {
      key: "offer",
      index: "01",
      label: "Offer letter",
      status: candidate.offer_status,
      state: !hired
        ? "locked"
        : offerSigned
          ? "done"
          : candidate.offer_status === "Not Sent"
            ? "ready"
            : "in-progress",
      ...(hired ? {} : { lockReason: "Candidate has not been hired / finalized yet" }),
      detail: offerSigned ? stampLabel(candidate.offer_signed_at) : stampLabel(candidate.offer_sent_at),
    },
    {
      key: "carrier",
      index: "02",
      label: "Carrier approval",
      status: candidate.carrier_status,
      state: !offerSigned
        ? "locked"
        : carrierApproved
          ? "done"
          : carrierRejected
            ? "blocked"
            : candidate.carrier_requested_at
              ? "in-progress"
              : "ready",
      ...(offerSigned ? {} : { lockReason: "The offer letter must be signed first" }),
      detail: candidate.carrier
        ? `${candidate.carrier}${candidate.carrier_decided_at ? ` · ${stampLabel(candidate.carrier_decided_at)}` : ""}`
        : "No carrier selected",
    },
    {
      key: "agreement",
      index: "03",
      label: "Employment agreement",
      status: candidate.agreement_status,
      state: !carrierApproved
        ? "locked"
        : agreementSigned
          ? "done"
          : candidate.agreement_status === "Not Sent"
            ? "ready"
            : "in-progress",
      ...(carrierApproved ? {} : { lockReason: "Carrier approval must be confirmed first" }),
      detail: agreementSigned
        ? stampLabel(candidate.agreement_signed_at)
        : stampLabel(candidate.agreement_sent_at),
    },
    {
      key: "access",
      index: "04",
      label: "PolicyBear ARM access",
      status: candidate.access_status,
      state: !agreementSigned
        ? "locked"
        : accessDone
          ? "done"
          : candidate.access_sent_at
            ? "in-progress"
            : "ready",
      ...(agreementSigned ? {} : { lockReason: "The employment agreement must be signed first" }),
      detail: accessDone ? stampLabel(candidate.access_completed_at) : stampLabel(candidate.access_sent_at),
    },
  ];

  return steps;
}

/** The single next action an admin needs to take, or null when nothing is due. */
export function actionRequired(candidate: Candidate): string | null {
  if (candidate.stage === "Not Hired" || candidate.stage === "Onboarding Completed") return null;
  if (!candidate.hired_at) {
    if (!candidate.form_submitted_at) return "Onboarding form not submitted";
    return "Hiring decision required";
  }
  if (candidate.offer_status === "Not Sent") return "Offer letter needs to be sent";
  if (candidate.offer_status !== "Signed") return "Offer letter awaiting signature";
  if (candidate.carrier_status === "Rejected") return "Carrier rejected — review required";
  if (!candidate.carrier_requested_at) return "Carrier approval needs to be requested";
  if (candidate.carrier_status !== "Approved") return "Carrier approval awaiting response";
  if (candidate.agreement_status === "Not Sent") return "Employment agreement needs to be sent";
  if (candidate.agreement_status !== "Signed") return "Employment agreement awaiting signature";
  if (candidate.access_status !== "Completed") return "PolicyBear access needs to be issued";
  return null;
}

export const PIPELINE_COLUMNS: { key: string; label: string; match: (c: Candidate) => boolean }[] = [
  { key: "hiring", label: "Hiring", match: (c) => !c.hired_at && c.stage !== "Not Hired" },
  { key: "offer", label: "Offer letter", match: (c) => !!c.hired_at && c.offer_status !== "Signed" },
  {
    key: "carrier",
    label: "Carrier approval",
    match: (c) => c.offer_status === "Signed" && c.carrier_status !== "Approved",
  },
  {
    key: "agreement",
    label: "Employment agreement",
    match: (c) => c.carrier_status === "Approved" && c.agreement_status !== "Signed",
  },
  {
    key: "access",
    label: "PolicyBear access",
    match: (c) => c.agreement_status === "Signed" && c.access_status !== "Completed",
  },
  { key: "done", label: "Completed", match: (c) => c.access_status === "Completed" },
];

export function pipelineColumnFor(candidate: Candidate) {
  return PIPELINE_COLUMNS.find((column) => column.match(candidate))?.key ?? "hiring";
}

/* ---------------------------------------------------------------- fetchers */

export async function fetchCandidates(): Promise<Candidate[]> {
  const { data, error } = await supabase
    .from("onboarding_candidates")
    .select("*")
    .order("last_activity_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchCandidate(id: string): Promise<Candidate | null> {
  const { data, error } = await supabase.from("onboarding_candidates").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function fetchCandidateByEmail(email: string): Promise<Candidate | null> {
  const { data, error } = await supabase
    .from("onboarding_candidates")
    .select("*")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function fetchDocuments(candidateId: string): Promise<OnboardingDocument[]> {
  const { data, error } = await supabase
    .from("onboarding_documents")
    .select("*")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchEvents(candidateId: string): Promise<OnboardingEvent[]> {
  const { data, error } = await supabase
    .from("onboarding_events")
    .select("*")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchNotes(candidateId: string): Promise<OnboardingNote[]> {
  const { data, error } = await supabase
    .from("onboarding_notes")
    .select("*")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchEmails(candidateId: string): Promise<OnboardingEmail[]> {
  const { data, error } = await supabase
    .from("onboarding_emails")
    .select("*")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchTemplates(): Promise<EmailTemplate[]> {
  const { data, error } = await supabase.from("onboarding_templates").select("*").order("category");
  if (error) throw error;
  return data ?? [];
}

/* --------------------------------------------------------------- mutations */

export async function logEvent(candidateId: string, event: string, detail?: string, actor?: string) {
  await supabase.from("onboarding_events").insert({
    candidate_id: candidateId,
    event,
    detail: detail ?? null,
    actor: actor ?? null,
    source: actor ? "user" : "system",
  });
}

export async function updateCandidate(id: string, patch: Partial<Candidate>) {
  const { error } = await supabase
    .from("onboarding_candidates")
    .update({ ...patch, last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function createCandidate(input: {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  source?: string;
  assigned_admin?: string;
  stage?: OnboardingStage;
  interview_at?: string | null;
}): Promise<Candidate> {
  const { data, error } = await supabase
    .from("onboarding_candidates")
    .insert({
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email.toLowerCase(),
      phone: input.phone ?? null,
      source: input.source ?? null,
      assigned_admin: input.assigned_admin ?? null,
      stage: input.stage ?? "Candidate",
      interview_at: input.interview_at ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  await ensureDocuments(data.id);
  await logEvent(data.id, "Candidate created", `${input.first_name} ${input.last_name}`, input.assigned_admin);
  return data;
}

export async function deleteCandidate(id: string) {
  const { error } = await supabase.from("onboarding_candidates").delete().eq("id", id);
  if (error) throw error;
}

/** Creates the standard document checklist rows if they are missing. */
export async function ensureDocuments(candidateId: string) {
  const existing = await fetchDocuments(candidateId);
  const have = new Set(existing.map((doc) => doc.name));
  const missing = REQUIRED_DOCUMENTS.filter((doc) => !have.has(doc.name));
  if (!missing.length) return existing;
  const { error } = await supabase.from("onboarding_documents").insert(
    missing.map((doc) => ({ candidate_id: candidateId, name: doc.name, required: doc.required })),
  );
  if (error) throw error;
  return fetchDocuments(candidateId);
}

export async function uploadDocument(candidateId: string, documentId: string, file: File) {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${candidateId}/${documentId}-${Date.now()}-${safe}`;
  const { error: uploadError } = await supabase.storage
    .from(ONBOARDING_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || "application/octet-stream" });
  if (uploadError) throw uploadError;

  const { error } = await supabase
    .from("onboarding_documents")
    .update({
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      status: "Uploaded",
      uploaded_at: new Date().toISOString(),
      review_note: null,
      reviewed_at: null,
      reviewed_by: null,
    })
    .eq("id", documentId);
  if (error) throw error;
}

export async function reviewDocument(
  documentId: string,
  status: DocumentStatus,
  reviewer: string,
  note?: string,
) {
  const { error } = await supabase
    .from("onboarding_documents")
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewer,
      review_note: note ?? null,
    })
    .eq("id", documentId);
  if (error) throw error;
}

export async function documentUrl(path: string) {
  const { data, error } = await supabase.storage.from(ONBOARDING_BUCKET).createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}

export async function addNote(candidateId: string, body: string, author: { id?: string; name?: string }) {
  const { error } = await supabase.from("onboarding_notes").insert({
    candidate_id: candidateId,
    body,
    author_id: author.id ?? null,
    author_name: author.name ?? null,
  });
  if (error) throw error;
}

/* ------------------------------------------------------- workflow actions */

export async function saveFormProgress(
  candidateId: string,
  patch: Partial<Candidate>,
  step: number,
) {
  await updateCandidate(candidateId, { ...patch, form_progress: { step } as never });
}

export async function submitOnboardingForm(candidate: Candidate, actor: string) {
  const now = new Date().toISOString();
  await updateCandidate(candidate.id, {
    form_submitted_at: now,
    stage: candidate.hired_at ? candidate.stage : "Onboarding Form Submitted",
  });
  await logEvent(candidate.id, "Onboarding form submitted", "Agent completed every section", actor);
}

export async function hireCandidate(candidate: Candidate, actor: string) {
  await updateCandidate(candidate.id, {
    hired_at: new Date().toISOString(),
    stage: "Hired / Finalized",
    not_hired_reason: null,
  });
  await logEvent(candidate.id, "Candidate hired / finalized", "Onboarding workflow unlocked", actor);
}

export async function rejectCandidate(candidate: Candidate, reason: string, actor: string) {
  await updateCandidate(candidate.id, { stage: "Not Hired", not_hired_reason: reason });
  await logEvent(candidate.id, "Candidate not hired", reason, actor);
}

export async function markOfferSent(candidate: Candidate, template: string, actor: string) {
  await updateCandidate(candidate.id, {
    offer_status: "Sent",
    offer_sent_at: new Date().toISOString(),
    offer_template: template,
    stage: "Offer Letter Sent",
    carrier_status: candidate.carrier_status === "Locked" ? "Locked" : candidate.carrier_status,
  });
  await logEvent(candidate.id, "Offer letter sent", template, actor);
}

export async function markOfferViewed(candidate: Candidate, actor: string) {
  await updateCandidate(candidate.id, { offer_status: "Viewed", offer_viewed_at: new Date().toISOString() });
  await logEvent(candidate.id, "Offer letter viewed", undefined, actor);
}

export async function markOfferSigned(candidate: Candidate, actor: string) {
  await updateCandidate(candidate.id, {
    offer_status: "Signed",
    offer_signed_at: new Date().toISOString(),
    stage: "Offer Letter Signed",
    carrier_status: "Ready",
  });
  await logEvent(candidate.id, "Offer letter signed", "Carrier approval unlocked", actor);
}

export async function requestCarrierApproval(candidate: Candidate, carrier: string, actor: string) {
  await updateCandidate(candidate.id, {
    carrier,
    carrier_status: "Requested",
    carrier_requested_at: new Date().toISOString(),
    stage: "Carrier Approval Pending",
  });
  await logEvent(candidate.id, "Carrier approval requested", carrier, actor);
}

export async function decideCarrierApproval(
  candidate: Candidate,
  approved: boolean,
  notes: string,
  actor: string,
) {
  await updateCandidate(candidate.id, {
    carrier_status: approved ? "Approved" : "Rejected",
    carrier_decided_at: new Date().toISOString(),
    carrier_notes: notes || null,
    stage: approved ? "Carrier Approved" : "Carrier Approval Pending",
  });
  await logEvent(
    candidate.id,
    approved ? "Carrier approved" : "Carrier rejected",
    notes || candidate.carrier || undefined,
    actor,
  );
}

export async function markAgreementSent(candidate: Candidate, template: string, actor: string) {
  await updateCandidate(candidate.id, {
    agreement_status: "Sent",
    agreement_sent_at: new Date().toISOString(),
    agreement_template: template,
    stage: "Employment Agreement Sent",
  });
  await logEvent(candidate.id, "Employment agreement sent", template, actor);
}

export async function markAgreementViewed(candidate: Candidate, actor: string) {
  await updateCandidate(candidate.id, {
    agreement_status: "Viewed",
    agreement_viewed_at: new Date().toISOString(),
  });
  await logEvent(candidate.id, "Employment agreement viewed", undefined, actor);
}

export async function markAgreementSigned(candidate: Candidate, actor: string) {
  await updateCandidate(candidate.id, {
    agreement_status: "Signed",
    agreement_signed_at: new Date().toISOString(),
    stage: "PolicyBear Access Pending",
    access_status: "Pending",
  });
  await logEvent(candidate.id, "Employment agreement signed", "PolicyBear access unlocked", actor);
}

export async function markAccessSent(candidate: Candidate, actor: string) {
  await updateCandidate(candidate.id, {
    access_status: "Access Sent",
    access_sent_at: new Date().toISOString(),
    stage: "PolicyBear Access Pending",
  });
  await logEvent(candidate.id, "PolicyBear access email sent", undefined, actor);
}

export async function completeOnboarding(candidate: Candidate, actor: string) {
  const now = new Date().toISOString();
  await updateCandidate(candidate.id, {
    access_status: "Completed",
    access_completed_at: now,
    completed_at: now,
    stage: "Onboarding Completed",
  });
  await logEvent(candidate.id, "Onboarding completed", "All mandatory stages complete", actor);
}

/** Guard used before marking onboarding complete. */
export function completionBlockers(candidate: Candidate): string[] {
  const blockers: string[] = [];
  if (!candidate.form_submitted_at) blockers.push("Onboarding form not submitted");
  if (candidate.offer_status !== "Signed") blockers.push("Offer letter not signed");
  if (candidate.carrier_status !== "Approved") blockers.push("Carrier approval not confirmed");
  if (candidate.agreement_status !== "Signed") blockers.push("Employment agreement not signed");
  return blockers;
}

/* ------------------------------------------- hiring email sequence config */

export type SequenceStep = Tables<"onboarding_sequence_steps">;

export const SEQUENCE_ANCHORS = [
  { value: "candidate_added", label: "As soon as the candidate is added" },
  { value: "interview_scheduled", label: "When the interview is scheduled" },
  { value: "interview_start", label: "Relative to the interview start" },
  { value: "interview_completed", label: "After the interview is completed" },
] as const;

export function anchorLabel(anchor: string) {
  return SEQUENCE_ANCHORS.find((item) => item.value === anchor)?.label ?? anchor;
}

export function offsetLabel(step: SequenceStep) {
  const minutes = step.offset_minutes ?? 0;
  if (step.anchor === "interview_scheduled") return "Immediately";
  const abs = Math.abs(minutes);
  const text =
    abs === 0
      ? "at the same time"
      : abs % 1440 === 0
        ? `${abs / 1440} day${abs / 1440 === 1 ? "" : "s"}`
        : abs % 60 === 0
          ? `${abs / 60} hour${abs / 60 === 1 ? "" : "s"}`
          : `${abs} minutes`;
  if (abs === 0) return "At the anchor time";
  return minutes < 0 ? `${text} before` : `${text} after`;
}

export async function fetchSequenceSteps(): Promise<SequenceStep[]> {
  const { data, error } = await supabase
    .from("onboarding_sequence_steps")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function updateSequenceStep(id: string, patch: Partial<SequenceStep>) {
  const { error } = await supabase.from("onboarding_sequence_steps").update(patch).eq("id", id);
  if (error) throw error;
}

export async function updateTemplate(
  templateKey: string,
  patch: { subject?: string; body?: string; name?: string },
) {
  const { error } = await supabase
    .from("onboarding_templates")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("template_key", templateKey);
  if (error) throw error;
}

/* --------------------------------------------------- interview scheduling */

export async function scheduleInterview(
  candidate: Candidate,
  input: { at: string; durationMinutes: number; link?: string; notes?: string },
  actor: string,
) {
  const reschedule = !!candidate.interview_at;
  await updateCandidate(candidate.id, {
    interview_at: new Date(input.at).toISOString(),
    interview_duration_minutes: input.durationMinutes,
    interview_link: input.link?.trim() || null,
    interview_notes: input.notes?.trim() || null,
    interview_completed_at: null,
    stage: candidate.hired_at ? candidate.stage : "Interview Scheduled",
  });
  await logEvent(
    candidate.id,
    reschedule ? "Interview rescheduled" : "Interview scheduled",
    new Date(input.at).toLocaleString(),
    actor,
  );
}

export async function markInterviewCompleted(candidate: Candidate, actor: string, notes?: string) {
  await updateCandidate(candidate.id, {
    interview_completed_at: new Date().toISOString(),
    stage: candidate.hired_at ? candidate.stage : "Interview Completed",
    ...(notes?.trim() ? { interview_notes: notes.trim() } : {}),
  });
  await logEvent(candidate.id, "Interview completed", notes?.trim() || undefined, actor);
}

export async function setSequencePaused(candidate: Candidate, paused: boolean, actor: string) {
  await updateCandidate(candidate.id, { sequence_paused: paused });
  await logEvent(
    candidate.id,
    paused ? "Automated emails paused" : "Automated emails resumed",
    undefined,
    actor,
  );
}

/* ------------------------------------------------- two-stage phase grouping */

export type OnboardingPhase = "hiring" | "onboarding" | "completed" | "not-hired";

/** Which of the two stages (or closed state) a candidate currently sits in. */
export function phaseOf(candidate: Candidate): OnboardingPhase {
  if (candidate.stage === "Not Hired") return "not-hired";
  if (candidate.access_status === "Completed" || candidate.stage === "Onboarding Completed") return "completed";
  return candidate.hired_at ? "onboarding" : "hiring";
}

export const PHASE_LABELS: Record<OnboardingPhase, string> = {
  hiring: "Stage 1 · Hiring",
  onboarding: "Stage 2 · Onboarding",
  completed: "Completed",
  "not-hired": "Not hired",
};

export interface HiringStep {
  key: "added" | "interview" | "interviewed" | "form" | "decision";
  index: string;
  label: string;
  status: string;
  state: StepState;
  detail?: string;
}

/** Stage 1 checklist: candidate added → interview → interview held → form → decision. */
export function hiringSteps(candidate: Candidate): HiringStep[] {
  const scheduled = !!candidate.interview_at;
  const held = !!candidate.interview_completed_at;
  const formDone = !!candidate.form_submitted_at;
  const hired = !!candidate.hired_at;
  const rejected = candidate.stage === "Not Hired";

  return [
    {
      key: "added",
      index: "01",
      label: "Candidate added",
      status: "Done",
      state: "done",
      detail: `${candidate.source ?? "Direct"} · ${dateLabel(candidate.created_at)}`,
    },
    {
      key: "interview",
      index: "02",
      label: "Interview scheduled",
      status: scheduled ? "Scheduled" : "Not scheduled",
      state: scheduled ? "done" : "ready",
      detail: scheduled ? stampLabel(candidate.interview_at) : "Pick a date to start the reminder emails",
    },
    {
      key: "interviewed",
      index: "03",
      label: "Interview held",
      status: held ? "Completed" : scheduled ? "Upcoming" : "Waiting",
      state: held ? "done" : scheduled ? "in-progress" : "locked",
      detail: held ? stampLabel(candidate.interview_completed_at) : "Mark it completed once the call happens",
    },
    {
      key: "form",
      index: "04",
      label: "Onboarding form",
      status: formDone ? "Submitted" : "Awaiting agent",
      state: formDone ? "done" : "in-progress",
      detail: formDone ? stampLabel(candidate.form_submitted_at) : "Send the form invite to the candidate",
    },
    {
      key: "decision",
      index: "05",
      label: "Hiring decision",
      status: hired ? "Approved" : rejected ? "Not hired" : "Pending",
      state: hired ? "done" : rejected ? "blocked" : formDone ? "ready" : "in-progress",
      detail: hired
        ? `Approved ${stampLabel(candidate.hired_at)} — Stage 2 unlocked`
        : rejected
          ? candidate.not_hired_reason ?? "Closed"
          : "Approve to move the agent into Stage 2",
    },
  ];
}
