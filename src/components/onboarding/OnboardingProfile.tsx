import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock,
  FileSignature,
  KeyRound,
  Landmark,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentStatusBadge } from "@/components/onboarding/AgentOnboardingForm";
import { StageChip } from "@/components/onboarding/OnboardingWorkspace";
import { HiringPanel } from "@/components/onboarding/HiringPanel";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { sendOnboardingEmail } from "@/lib/onboarding.functions";
import {
  DOCUMENT_STATUSES,
  addNote,
  authorizations as readAuthorizations,
  banking as readBanking,
  completeOnboarding,
  completionBlockers,
  decideCarrierApproval,
  deleteCandidate,
  documentUrl,
  fetchCandidate,
  fetchDocuments,
  fetchEmails,
  fetchEvents,
  fetchNotes,
  fullName,
  hireCandidate,
  hiringSteps,
  licensing as readLicensing,
  markAccessSent,
  markAgreementSent,
  markAgreementSigned,
  markAgreementViewed,
  markOfferSent,
  markOfferSigned,
  markOfferViewed,
  maskValue,
  onboardingSteps,
  rejectCandidate,
  requestCarrierApproval,
  reviewDocument,
  stampLabel,
  type Candidate,
  type DocumentStatus,
} from "@/lib/onboarding";

const CARRIERS = ["Occidental Life", "American Amicable", "Mutual of Omaha", "Aetna", "Corebridge", "Foresters"];

export function OnboardingProfile({ candidateId }: { candidateId: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const actor = user?.name ?? "Staff";
  const sendEmail = useServerFn(sendOnboardingEmail);

  const candidateQuery = useQuery({
    queryKey: ["onboarding-candidate", candidateId],
    queryFn: () => fetchCandidate(candidateId),
  });
  const documentsQuery = useQuery({
    queryKey: ["onboarding-documents", candidateId],
    queryFn: () => fetchDocuments(candidateId),
  });
  const eventsQuery = useQuery({
    queryKey: ["onboarding-events", candidateId],
    queryFn: () => fetchEvents(candidateId),
  });
  const notesQuery = useQuery({
    queryKey: ["onboarding-notes", candidateId],
    queryFn: () => fetchNotes(candidateId),
  });
  const emailsQuery = useQuery({
    queryKey: ["onboarding-emails", candidateId],
    queryFn: () => fetchEmails(candidateId),
  });

  const candidate = candidateQuery.data;
  const [carrier, setCarrier] = useState("");
  const [carrierNote, setCarrierNote] = useState("");
  const [note, setNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["onboarding-candidate", candidateId] });
    void queryClient.invalidateQueries({ queryKey: ["onboarding-events", candidateId] });
    void queryClient.invalidateQueries({ queryKey: ["onboarding-candidates"] });
    void queryClient.invalidateQueries({ queryKey: ["onboarding-emails", candidateId] });
  };

  const email = async (templateKey: string, stage: string) => {
    const result = await sendEmail({ data: { candidateId, templateKey, stage, trigger: "admin action" } });
    if (result.status === "sent") toast.success("Email sent to the agent");
    else if (result.status === "unavailable")
      toast.warning("Email logged, but not delivered", {
        description: "No email service is connected yet — connect one to deliver onboarding emails.",
      });
    else toast.error(result.reason ?? "The email could not be sent");
    void queryClient.invalidateQueries({ queryKey: ["onboarding-emails", candidateId] });
  };

  const act = useMutation({
    mutationFn: async (action: () => Promise<void>) => action(),
    onSuccess: () => refresh(),
    onError: () => toast.error("That action could not be completed."),
  });

  const remove = useMutation({
    mutationFn: () => deleteCandidate(candidateId),
    onSuccess: () => {
      toast.success("Onboarding record deleted");
      void queryClient.invalidateQueries({ queryKey: ["onboarding-candidates"] });
    },
  });

  const noteMutation = useMutation({
    mutationFn: () => addNote(candidateId, note.trim(), { ...(user?.id ? { id: user.id } : {}), name: actor }),
    onSuccess: () => {
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["onboarding-notes", candidateId] });
    },
  });

  if (candidateQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading onboarding record…</p>;
  }
  if (!candidate) {
    return (
      <Card className="rounded-2xl p-6">
        <p className="text-sm font-semibold">This onboarding record no longer exists.</p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link to="/admin/onboarding">Back to onboarding</Link>
        </Button>
      </Card>
    );
  }

  const steps = onboardingSteps(candidate).filter((step) => step.key !== "form");
  const stage1 = hiringSteps(candidate);
  const hired = !!candidate.hired_at;
  const licensing = readLicensing(candidate);
  const banking = readBanking(candidate);
  const auth = readAuthorizations(candidate);
  const blockers = completionBlockers(candidate);
  const documents = documentsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/onboarding">
              <ArrowLeft className="size-4" /> Onboarding
            </Link>
          </Button>
          <StageChip stage={candidate.stage} />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={() => {
            if (window.confirm("Delete this onboarding record permanently?")) void remove.mutateAsync();
          }}
        >
          <Trash2 className="size-4" /> Delete record
        </Button>
      </div>

      <Card className="gap-0 overflow-hidden rounded-2xl border-white/70 bg-card/80 p-0 shadow-card backdrop-blur-xl">
        <div className="bg-brand-ink px-5 py-5 text-brand-ink-foreground sm:px-6">
          <p className="text-[0.65rem] font-bold tracking-[0.14em] uppercase text-brand-cyan">Agent onboarding</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">{fullName(candidate)}</h1>
          <p className="mt-1 text-sm text-brand-ink-foreground/70">
            {candidate.email}
            {candidate.phone ? ` · ${candidate.phone}` : ""}
            {candidate.assigned_admin ? ` · assigned to ${candidate.assigned_admin}` : ""}
          </p>
        </div>

        <div className="space-y-3 px-5 py-5 sm:px-6">
          <StageStrip
            eyebrow="Stage 1 · Hiring"
            note={hired ? "Approved — Stage 2 unlocked" : "In progress"}
            done={hired}
            steps={stage1.map((step) => ({
              key: step.key,
              index: step.index,
              label: step.label,
              status: step.status,
              state: step.state,
              detail: step.detail,
            }))}
          />
          <StageStrip
            eyebrow="Stage 2 · Onboarding"
            note={hired ? "Unlocked" : "Locked until the hiring decision is approved"}
            done={candidate.access_status === "Completed"}
            steps={steps.map((step) => ({
              key: step.key,
              index: step.index,
              label: step.label,
              status: step.status,
              state: step.state,
              detail: step.lockReason ?? step.detail,
            }))}
          />
        </div>
      </Card>

      <Tabs defaultValue={hired ? "stage2" : "stage1"}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="stage1">Stage 1 · Hiring</TabsTrigger>
          <TabsTrigger value="stage2">
            Stage 2 · Onboarding
            {!hired && <Lock className="ml-1 size-3" />}
          </TabsTrigger>
          <TabsTrigger value="submission">Submitted form</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notes">Internal notes</TabsTrigger>
          <TabsTrigger value="emails">Email log</TabsTrigger>
        </TabsList>

        {/* -------------------------------------------------- stage 1 hiring */}
        <TabsContent value="stage1" className="mt-3 space-y-3">
          <HiringPanel candidate={candidate} actor={actor} onChanged={refresh} />

          <Panel title="Onboarding form invite" icon={ClipboardList}>
            <StatusLine
              rows={[
                ["Form submitted", stampLabel(candidate.form_submitted_at)],
                ["Interview held", stampLabel(candidate.interview_completed_at)],
              ]}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => void email("onboarding_form_invitation", "Hiring")}>
                <Mail className="size-4" /> Send onboarding form invite
              </Button>
              <Button size="sm" variant="outline" onClick={() => void email("interview_invitation", "Hiring")}>
                <Mail className="size-4" /> Send interview invite
              </Button>
            </div>
          </Panel>

          <Panel title="Hiring decision" icon={BadgeCheck}>
            {hired ? (
              <p className="flex items-center gap-2 text-sm font-semibold text-success">
                <CheckCircle2 className="size-4" /> Approved on {stampLabel(candidate.hired_at)} — Stage 2 is unlocked.
              </p>
            ) : candidate.stage === "Not Hired" ? (
              <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <XCircle className="size-4" /> Not hired
                {candidate.not_hired_reason ? ` — ${candidate.not_hired_reason}` : ""}
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {candidate.form_submitted_at
                    ? "The candidate finished Stage 1. Approving moves them into Stage 2 onboarding."
                    : "Interview and onboarding form come first — you can still approve early if you are ready."}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => void act.mutateAsync(() => hireCandidate(candidate, actor))}>
                    <CheckCircle2 className="size-4" /> Approve & move to Stage 2
                  </Button>
                </div>
                <Separator className="my-4" />
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[16rem] flex-1 space-y-1.5">
                    <Label className="text-xs font-semibold">Not hired — reason</Label>
                    <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    disabled={!rejectReason.trim()}
                    onClick={() => void act.mutateAsync(() => rejectCandidate(candidate, rejectReason.trim(), actor))}
                  >
                    Mark not hired
                  </Button>
                </div>
              </>
            )}
          </Panel>
        </TabsContent>

        {/* ---------------------------------------------- stage 2 onboarding */}
        <TabsContent value="stage2" className="mt-3 space-y-3">
          {!hired && (
            <Card className="rounded-2xl border-dashed border-border/70 bg-card/60 p-6 text-center">
              <span className="mx-auto grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
                <Lock className="size-4" />
              </span>
              <p className="mt-2.5 text-sm font-bold">Stage 2 is locked</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Approve the hiring decision in Stage 1 to unlock the offer letter and the steps that follow.
              </p>
            </Card>
          )}

          <Panel title="Step 1 · Offer letter" icon={FileSignature} locked={!hired} lockReason="Approve the hiring decision first">
            <StatusLine
              rows={[
                ["Status", candidate.offer_status],
                ["Template", candidate.offer_template ?? "—"],
                ["Sent", stampLabel(candidate.offer_sent_at)],
                ["Viewed", stampLabel(candidate.offer_viewed_at)],
                ["Signed", stampLabel(candidate.offer_signed_at)],
              ]}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  await act.mutateAsync(() => markOfferSent(candidate, "PolicyBear standard offer letter", actor));
                  await email("offer_letter", "Offer Letter");
                }}
              >
                <Mail className="size-4" /> {candidate.offer_status === "Not Sent" ? "Send offer letter" : "Resend offer letter"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={candidate.offer_status === "Not Sent" || candidate.offer_status === "Signed"}
                onClick={() => void act.mutateAsync(() => markOfferViewed(candidate, actor))}
              >
                Mark viewed
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={candidate.offer_status === "Not Sent" || candidate.offer_status === "Signed"}
                onClick={() => void act.mutateAsync(() => markOfferSigned(candidate, actor))}
              >
                Mark signed
              </Button>
            </div>
          </Panel>

          <Panel
            title="Step 2 · Carrier approval"
            icon={ShieldCheck}
            locked={candidate.offer_status !== "Signed"}
            lockReason="The offer letter must be signed first"
          >
            <StatusLine
              rows={[
                ["Status", candidate.carrier_status],
                ["Carrier", candidate.carrier ?? "—"],
                ["Requested", stampLabel(candidate.carrier_requested_at)],
                ["Decision", stampLabel(candidate.carrier_decided_at)],
                ["Notes", candidate.carrier_notes ?? "—"],
              ]}
            />
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="w-[14rem] space-y-1.5">
                <Label className="text-xs font-semibold">Carrier</Label>
                <Select value={carrier || candidate.carrier || ""} onValueChange={setCarrier}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARRIERS.map((entry) => (
                      <SelectItem key={entry} value={entry}>
                        {entry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                disabled={!(carrier || candidate.carrier)}
                onClick={async () => {
                  await act.mutateAsync(() =>
                    requestCarrierApproval(candidate, carrier || candidate.carrier || "", actor),
                  );
                  await email("carrier_approval", "Carrier Approval");
                }}
              >
                <Mail className="size-4" /> Request carrier approval
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="min-w-[16rem] flex-1 space-y-1.5">
                <Label className="text-xs font-semibold">Decision notes</Label>
                <Input value={carrierNote} onChange={(e) => setCarrierNote(e.target.value)} />
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!candidate.carrier_requested_at}
                onClick={() => void act.mutateAsync(() => decideCarrierApproval(candidate, true, carrierNote, actor))}
              >
                Mark approved
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                disabled={!candidate.carrier_requested_at}
                onClick={() => void act.mutateAsync(() => decideCarrierApproval(candidate, false, carrierNote, actor))}
              >
                Mark rejected
              </Button>
            </div>
          </Panel>

          <Panel
            title="Step 3 · Employment agreement"
            icon={FileSignature}
            locked={candidate.carrier_status !== "Approved"}
            lockReason="Carrier approval must be confirmed first"
          >
            <StatusLine
              rows={[
                ["Status", candidate.agreement_status],
                ["Template", candidate.agreement_template ?? "—"],
                ["Sent", stampLabel(candidate.agreement_sent_at)],
                ["Viewed", stampLabel(candidate.agreement_viewed_at)],
                ["Signed", stampLabel(candidate.agreement_signed_at)],
              ]}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  await act.mutateAsync(() =>
                    markAgreementSent(candidate, "PolicyBear agent employment agreement", actor),
                  );
                  await email("employment_agreement", "Employment Agreement");
                }}
              >
                <Mail className="size-4" />{" "}
                {candidate.agreement_status === "Not Sent" ? "Send agreement" : "Resend agreement"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={candidate.agreement_status === "Not Sent" || candidate.agreement_status === "Signed"}
                onClick={() => void act.mutateAsync(() => markAgreementViewed(candidate, actor))}
              >
                Mark viewed
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={candidate.agreement_status === "Not Sent" || candidate.agreement_status === "Signed"}
                onClick={() => void act.mutateAsync(() => markAgreementSigned(candidate, actor))}
              >
                Mark signed
              </Button>
            </div>
          </Panel>

          <Panel
            title="Step 4 · PolicyBear ARM access"
            icon={KeyRound}
            locked={candidate.agreement_status !== "Signed"}
            lockReason="The employment agreement must be signed first"
          >
            <StatusLine
              rows={[
                ["Status", candidate.access_status],
                ["Access email sent", stampLabel(candidate.access_sent_at)],
                ["Completed", stampLabel(candidate.access_completed_at)],
              ]}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  await act.mutateAsync(() => markAccessSent(candidate, actor));
                  await email("arm_access", "PolicyBear Access");
                }}
              >
                <Mail className="size-4" /> Send ARM access email
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={blockers.length > 0}
                title={blockers.join(" · ")}
                onClick={() => void act.mutateAsync(() => completeOnboarding(candidate, actor))}
              >
                <CheckCircle2 className="size-4" /> Mark onboarding completed
              </Button>
            </div>
            {blockers.length > 0 && (
              <p className="mt-2 text-xs text-destructive">Blocked by: {blockers.join(" · ")}</p>
            )}
          </Panel>
        </TabsContent>

        {/* ----------------------------------------------------- submission */}
        <TabsContent value="submission" className="mt-3 grid gap-3 lg:grid-cols-2">
          <Panel title="Agent information" icon={BadgeCheck}>
            <StatusLine
              rows={[
                ["Legal name", [candidate.first_name, candidate.middle_name, candidate.last_name].filter(Boolean).join(" ")],
                ["Preferred name", candidate.preferred_name ?? "—"],
                ["Email", candidate.email],
                ["Phone", candidate.phone ?? "—"],
                ["Date of birth", candidate.date_of_birth ?? "—"],
                [
                  "Address",
                  [candidate.address_line1, candidate.address_line2, candidate.city, candidate.state, candidate.zip]
                    .filter(Boolean)
                    .join(", ") || "—",
                ],
                [
                  "Mailing address",
                  candidate.mailing_same
                    ? "Same as residential"
                    : [candidate.mailing_address_line1, candidate.mailing_city, candidate.mailing_state, candidate.mailing_zip]
                        .filter(Boolean)
                        .join(", ") || "—",
                ],
                ["Source", candidate.source ?? "—"],
                ["Form submitted", stampLabel(candidate.form_submitted_at)],
              ]}
            />
          </Panel>

          <Panel title="Licensing" icon={BadgeCheck}>
            <StatusLine
              rows={[
                ["License state", licensing.licenseState ?? "—"],
                ["License number", licensing.licenseNumber ?? "—"],
                ["Type", licensing.licenseType ?? "—"],
                ["Status", licensing.licenseStatus ?? "—"],
                ["Expires", licensing.licenseExpires ?? "—"],
                ["NPN", licensing.npn ?? "—"],
                ["Additional states", licensing.additionalStates ?? "—"],
                ["Notes", licensing.notes ?? "—"],
              ]}
            />
          </Panel>

          <Panel title="Banking & payment" icon={Landmark}>
            <StatusLine
              rows={[
                ["Bank", banking.bankName ?? "—"],
                ["Account holder", banking.accountHolder ?? "—"],
                ["Account type", banking.accountType ?? "—"],
                ["Routing number", maskValue(banking.routingNumber)],
                ["Account number", maskValue(banking.accountNumber)],
              ]}
            />
            <p className="mt-2 flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
              <Lock className="size-3" /> Only the last four digits are ever shown.
            </p>
          </Panel>

          <Panel title="Authorizations" icon={ShieldCheck}>
            <StatusLine
              rows={[
                ["Background verification", auth.backgroundCheck ? "Authorized" : "Not authorized"],
                ["Direct deposit", auth.directDeposit ? "Authorized" : "Not authorized"],
                ["Accuracy acknowledgement", auth.accuracy ? "Acknowledged" : "Not acknowledged"],
                ["Electronic signature", auth.eSignName ?? "—"],
                ["Signed at", stampLabel(auth.eSignAt)],
              ]}
            />
          </Panel>
        </TabsContent>

        {/* ------------------------------------------------------ documents */}
        <TabsContent value="documents" className="mt-3">
          <Panel title="Uploaded documents" icon={FileSignature}>
            <div className="space-y-2">
              {documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  reviewer={actor}
                  onReviewed={() => void documentsQuery.refetch()}
                />
              ))}
              {documents.length === 0 && <p className="text-sm text-muted-foreground">No documents yet.</p>}
            </div>
          </Panel>
        </TabsContent>

        {/* ------------------------------------------------------- timeline */}
        <TabsContent value="timeline" className="mt-3">
          <Panel title="Onboarding timeline" icon={Clock}>
            <ol className="space-y-3">
              {(eventsQuery.data ?? []).map((event) => (
                <li key={event.id} className="flex gap-3">
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-brand" />
                  <div>
                    <p className="text-sm font-semibold">{event.event}</p>
                    <p className="text-xs text-muted-foreground">
                      {stampLabel(event.created_at)} · {event.actor ?? "System"}
                      {event.detail ? ` · ${event.detail}` : ""}
                    </p>
                  </div>
                </li>
              ))}
              {(eventsQuery.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              )}
            </ol>
          </Panel>
        </TabsContent>

        {/* ---------------------------------------------------------- notes */}
        <TabsContent value="notes" className="mt-3">
          <Panel title="Internal notes" icon={MessageSquare}>
            <p className="mb-2 text-xs text-muted-foreground">Staff only — agents never see these notes.</p>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" />
            <div className="mt-2 flex justify-end">
              <Button size="sm" disabled={!note.trim() || noteMutation.isPending} onClick={() => void noteMutation.mutateAsync()}>
                {noteMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Add note
              </Button>
            </div>
            <Separator className="my-4" />
            <div className="space-y-2.5">
              {(notesQuery.data ?? []).map((entry) => (
                <div key={entry.id} className="rounded-xl border border-border/60 bg-card/60 p-3">
                  <p className="text-sm">{entry.body}</p>
                  <p className="mt-1 text-[0.7rem] text-muted-foreground">
                    {entry.author_name ?? "Staff"} · {stampLabel(entry.created_at)}
                  </p>
                </div>
              ))}
              {(notesQuery.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
            </div>
          </Panel>
        </TabsContent>

        {/* --------------------------------------------------------- emails */}
        <TabsContent value="emails" className="mt-3">
          <Panel title="Email log" icon={Mail}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="text-left text-[0.65rem] font-bold tracking-[0.08em] uppercase text-muted-foreground">
                    <th className="py-2">Type</th>
                    <th className="py-2">Recipient</th>
                    <th className="py-2">Stage</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {(emailsQuery.data ?? []).map((entry) => (
                    <tr key={entry.id} className="border-t border-border/50">
                      <td className="py-2 text-xs font-semibold">{entry.email_type}</td>
                      <td className="py-2 text-xs">{entry.recipient}</td>
                      <td className="py-2 text-xs">{entry.stage ?? "—"}</td>
                      <td className="py-2 text-xs">
                        <Badge
                          className={cn(
                            "rounded-md border-0 text-[0.65rem] font-semibold",
                            entry.status === "sent"
                              ? "bg-success/12 text-success"
                              : entry.status === "failed"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-warning/20 text-brand-tan",
                          )}
                        >
                          {entry.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs">{stampLabel(entry.sent_at ?? entry.created_at)}</td>
                    </tr>
                  ))}
                  {(emailsQuery.data ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                        No onboarding emails yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* --------------------------------------------------------------- fragments */

function StageStrip({
  eyebrow,
  note,
  done,
  steps,
}: {
  eyebrow: string;
  note: string;
  done: boolean;
  steps: { key: string; index: string; label: string; status: string; state: string; detail?: string }[];
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/25 p-3">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.62rem] font-bold tracking-[0.14em] uppercase text-brand">{eyebrow}</p>
        <p
          className={cn(
            "text-[0.68rem] font-semibold",
            done ? "text-success" : "text-muted-foreground",
          )}
        >
          {note}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {steps.map((step) => (
          <div
            key={step.key}
            className={cn(
              "rounded-xl border p-2.5",
              step.state === "done"
                ? "border-success/30 bg-success/5"
                : step.state === "locked"
                  ? "border-border/60 bg-muted/40"
                  : step.state === "blocked"
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-brand/30 bg-brand/5",
            )}
          >
            <p className="text-[0.58rem] font-bold tracking-[0.1em] uppercase text-muted-foreground">{step.index}</p>
            <p className="mt-0.5 text-[0.8rem] font-semibold leading-tight">{step.label}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[0.7rem] font-semibold">
              {step.state === "done" ? (
                <CheckCircle2 className="size-3 text-success" />
              ) : step.state === "locked" ? (
                <Lock className="size-3 text-muted-foreground" />
              ) : step.state === "blocked" ? (
                <XCircle className="size-3 text-destructive" />
              ) : (
                <Circle className="size-3 text-brand" />
              )}
              {step.state === "locked" ? "Locked" : step.status}
            </p>
            {step.detail && <p className="mt-0.5 text-[0.65rem] text-muted-foreground">{step.detail}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  locked,
  lockReason,
  children,
}: {
  title: string;
  icon: typeof Mail;
  locked?: boolean;
  lockReason?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl border-white/70 bg-card/70 p-4 shadow-card backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-brand/10 text-brand">
          <Icon className="size-4" />
        </span>
        <h2 className="font-display text-sm font-bold tracking-tight">{title}</h2>
        {locked && (
          <Badge className="ml-auto rounded-md border-0 bg-muted text-[0.65rem] font-semibold text-muted-foreground">
            <Lock className="mr-1 size-3" /> Locked
          </Badge>
        )}
      </div>
      {locked ? <p className="text-sm text-muted-foreground">{lockReason}</p> : children}
    </Card>
  );
}

function StatusLine({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-3 border-b border-dashed border-border/50 py-1">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="truncate text-xs font-semibold">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function DocumentRow({
  document,
  reviewer,
  onReviewed,
}: {
  document: Awaited<ReturnType<typeof fetchDocuments>>[number];
  reviewer: string;
  onReviewed: () => void;
}) {
  const [status, setStatus] = useState<DocumentStatus>(document.status as DocumentStatus);
  const [reason, setReason] = useState(document.review_note ?? "");
  const [busy, setBusy] = useState(false);

  const open = async () => {
    if (!document.file_path) return;
    try {
      window.open(await documentUrl(document.file_path), "_blank", "noopener");
    } catch {
      toast.error("That file could not be opened.");
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await reviewDocument(document.id, status, reviewer, reason);
      onReviewed();
      toast.success("Document review saved");
    } catch {
      toast.error("The review could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {document.name} {document.required && <span className="text-destructive">*</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {document.file_name ?? "No file uploaded"}
            {document.uploaded_at ? ` · ${stampLabel(document.uploaded_at)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DocumentStatusBadge status={document.status} />
          <Button variant="outline" size="sm" disabled={!document.file_path} onClick={() => void open()}>
            View
          </Button>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-end gap-2">
        <div className="w-[12rem] space-y-1.5">
          <Label className="text-xs font-semibold">Review status</Label>
          <Select value={status} onValueChange={(next) => setStatus(next as DocumentStatus)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_STATUSES.map((entry) => (
                <SelectItem key={entry} value={entry}>
                  {entry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[14rem] flex-1 space-y-1.5">
          <Label className="text-xs font-semibold">Reason / comment</Label>
          <Input className="h-9" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <Button size="sm" disabled={busy} onClick={() => void save()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null} Save review
        </Button>
      </div>
      {document.reviewed_by && (
        <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
          Last reviewed by {document.reviewed_by} · {stampLabel(document.reviewed_at)}
        </p>
      )}
    </div>
  );
}
