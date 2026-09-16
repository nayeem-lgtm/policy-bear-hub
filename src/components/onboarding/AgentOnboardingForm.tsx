import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  FileText,
  Landmark,
  Loader2,
  Lock,
  ShieldCheck,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ACCOUNT_TYPES,
  LICENSE_STATUSES,
  LICENSE_TYPES,
  US_STATES,
  authorizations as readAuthorizations,
  banking as readBanking,
  documentUrl,
  ensureDocuments,
  fetchDocuments,
  licensing as readLicensing,
  submitOnboardingForm,
  updateCandidate,
  uploadDocument,
  type AuthorizationInfo,
  type BankingInfo,
  type Candidate,
  type LicensingInfo,
} from "@/lib/onboarding";

const STEPS = [
  { key: "personal", label: "Personal", icon: UserRound },
  { key: "licensing", label: "Licensing", icon: BadgeCheck },
  { key: "banking", label: "Banking", icon: Landmark },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "authorizations", label: "Authorizations", icon: ShieldCheck },
  { key: "review", label: "Review & submit", icon: FileCheck2 },
] as const;

interface PersonalDraft {
  first_name: string;
  middle_name: string;
  last_name: string;
  preferred_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip: string;
  mailing_same: boolean;
  mailing_address_line1: string;
  mailing_city: string;
  mailing_state: string;
  mailing_zip: string;
}

export function AgentOnboardingForm({ candidate }: { candidate: Candidate }) {
  const queryClient = useQueryClient();
  const locked = !!candidate.form_submitted_at;
  const [step, setStep] = useState(0);

  const [personal, setPersonal] = useState<PersonalDraft>({
    first_name: candidate.first_name ?? "",
    middle_name: candidate.middle_name ?? "",
    last_name: candidate.last_name ?? "",
    preferred_name: candidate.preferred_name ?? "",
    email: candidate.email ?? "",
    phone: candidate.phone ?? "",
    date_of_birth: candidate.date_of_birth ?? "",
    address_line1: candidate.address_line1 ?? "",
    address_line2: candidate.address_line2 ?? "",
    city: candidate.city ?? "",
    state: candidate.state ?? "",
    zip: candidate.zip ?? "",
    mailing_same: candidate.mailing_same ?? true,
    mailing_address_line1: candidate.mailing_address_line1 ?? "",
    mailing_city: candidate.mailing_city ?? "",
    mailing_state: candidate.mailing_state ?? "",
    mailing_zip: candidate.mailing_zip ?? "",
  });
  const [license, setLicense] = useState<LicensingInfo>(readLicensing(candidate));
  const [bank, setBank] = useState<BankingInfo>(readBanking(candidate));
  const [auth, setAuth] = useState<AuthorizationInfo>(readAuthorizations(candidate));

  const documentsQuery = useQuery({
    queryKey: ["onboarding-documents", candidate.id],
    queryFn: () => ensureDocuments(candidate.id),
  });
  const documents = documentsQuery.data ?? [];

  const save = useMutation({
    mutationFn: async () => {
      await updateCandidate(candidate.id, {
        first_name: personal.first_name,
        middle_name: personal.middle_name || null,
        last_name: personal.last_name,
        preferred_name: personal.preferred_name || null,
        phone: personal.phone || null,
        date_of_birth: personal.date_of_birth || null,
        address_line1: personal.address_line1 || null,
        address_line2: personal.address_line2 || null,
        city: personal.city || null,
        state: personal.state || null,
        zip: personal.zip || null,
        mailing_same: personal.mailing_same,
        mailing_address_line1: personal.mailing_address_line1 || null,
        mailing_city: personal.mailing_city || null,
        mailing_state: personal.mailing_state || null,
        mailing_zip: personal.mailing_zip || null,
        licensing: license as never,
        banking: bank as never,
        authorizations: auth as never,
        form_progress: { step } as never,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-onboarding"] });
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      await save.mutateAsync();
      await submitOnboardingForm(candidate, personal.email);
    },
    onSuccess: () => {
      toast.success("Onboarding submitted", {
        description: "Our team has been notified and will review your information.",
      });
      void queryClient.invalidateQueries({ queryKey: ["my-onboarding"] });
    },
    onError: () => toast.error("We could not submit your onboarding. Please try again."),
  });

  const missingRequiredDocs = documents.filter(
    (doc) => doc.required && (doc.status === "Missing" || doc.status === "Replacement Required"),
  );

  const problems = useMemo(() => {
    const list: { step: number; message: string }[] = [];
    if (!personal.first_name.trim()) list.push({ step: 0, message: "Legal first name is required" });
    if (!personal.last_name.trim()) list.push({ step: 0, message: "Legal last name is required" });
    if (!personal.phone.trim()) list.push({ step: 0, message: "Phone number is required" });
    if (!personal.date_of_birth) list.push({ step: 0, message: "Date of birth is required" });
    if (!personal.address_line1.trim()) list.push({ step: 0, message: "Residential address is required" });
    if (!personal.city.trim() || !personal.state || !/^\d{5}$/.test(personal.zip))
      list.push({ step: 0, message: "City, state and a 5-digit ZIP are required" });
    if (!license.licenseState) list.push({ step: 1, message: "License state is required" });
    if (!license.licenseNumber?.trim()) list.push({ step: 1, message: "License number is required" });
    if (!license.licenseType) list.push({ step: 1, message: "License type is required" });
    if (!license.licenseExpires) list.push({ step: 1, message: "License expiration date is required" });
    if (!bank.bankName?.trim()) list.push({ step: 2, message: "Bank name is required" });
    if (!bank.accountHolder?.trim()) list.push({ step: 2, message: "Account holder name is required" });
    if (!/^\d{9}$/.test(bank.routingNumber ?? "")) list.push({ step: 2, message: "Routing number must be 9 digits" });
    if (!/^\d{5,17}$/.test(bank.accountNumber ?? "")) list.push({ step: 2, message: "Account number looks incomplete" });
    if (!bank.accountType) list.push({ step: 2, message: "Account type is required" });
    if (missingRequiredDocs.length)
      list.push({ step: 3, message: `${missingRequiredDocs.length} required document(s) still missing` });
    if (!auth.backgroundCheck) list.push({ step: 4, message: "Background check authorization is required" });
    if (!auth.directDeposit) list.push({ step: 4, message: "Direct deposit authorization is required" });
    if (!auth.accuracy) list.push({ step: 4, message: "Accuracy acknowledgement is required" });
    if (!auth.eSignName?.trim()) list.push({ step: 4, message: "Electronic signature is required" });
    return list;
  }, [personal, license, bank, auth, missingRequiredDocs.length]);

  const completion = Math.round(((STEPS.length - new Set(problems.map((p) => p.step)).size) / STEPS.length) * 100);

  if (locked) {
    return <SubmittedState candidate={candidate} />;
  }

  const goto = async (next: number) => {
    try {
      await save.mutateAsync();
      setStep(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      toast.error("We could not save your progress. Please check your connection.");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="gap-0 overflow-hidden rounded-2xl border-white/70 bg-card/80 p-0 shadow-card backdrop-blur-xl">
        <div className="flex flex-col gap-4 border-b border-border/60 bg-brand-ink px-5 py-5 text-brand-ink-foreground sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[0.65rem] font-bold tracking-[0.14em] uppercase text-brand-cyan">
                PolicyBear agent onboarding
              </p>
              <h1 className="mt-1 font-display text-xl font-bold tracking-tight sm:text-2xl">
                Licensing, banking, documents and authorizations
              </h1>
              <p className="mt-1 text-sm text-brand-ink-foreground/70">
                A short guided flow — your answers save each time you continue.
              </p>
            </div>
            <div className="min-w-[9rem]">
              <p className="text-right text-[0.65rem] font-semibold tracking-wide uppercase text-brand-ink-foreground/60">
                {completion}% ready
              </p>
              <Progress value={completion} className="mt-1.5 h-1.5 bg-white/15" />
            </div>
          </div>

          <ol className="-mx-1 flex gap-1 overflow-x-auto pb-1">
            {STEPS.map((entry, index) => {
              const done = index < step && !problems.some((p) => p.step === index);
              return (
                <li key={entry.key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => void goto(index)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                      index === step
                        ? "bg-white/15 text-brand-ink-foreground"
                        : "text-brand-ink-foreground/55 hover:bg-white/10",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-5 place-items-center rounded-full text-[0.6rem]",
                        done ? "bg-success text-white" : "bg-white/15",
                      )}
                    >
                      {done ? <CheckCircle2 className="size-3" /> : index + 1}
                    </span>
                    <span className="whitespace-nowrap">{entry.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="px-5 py-6 sm:px-6">
          {step === 0 && <PersonalStep value={personal} onChange={setPersonal} />}
          {step === 1 && <LicensingStep value={license} onChange={setLicense} />}
          {step === 2 && <BankingStep value={bank} onChange={setBank} />}
          {step === 3 && (
            <DocumentsStep
              candidateId={candidate.id}
              documents={documents}
              loading={documentsQuery.isLoading}
              onUploaded={() => void documentsQuery.refetch()}
            />
          )}
          {step === 4 && (
            <AuthorizationsStep
              value={auth}
              onChange={setAuth}
              agentName={`${personal.first_name} ${personal.last_name}`.trim()}
            />
          )}
          {step === 5 && (
            <ReviewStep
              personal={personal}
              license={license}
              bank={bank}
              auth={auth}
              documents={documents}
              problems={problems}
              onEdit={(target) => void goto(target)}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/30 px-5 py-4 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            disabled={step === 0}
            onClick={() => void goto(Math.max(0, step - 1))}
          >
            <ChevronLeft className="size-4" /> Back
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void save.mutateAsync()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Save draft
            </Button>
            {step < STEPS.length - 1 ? (
              <Button size="sm" onClick={() => void goto(step + 1)} disabled={save.isPending}>
                Save & continue <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={problems.length > 0 || submit.isPending}
                onClick={() => void submit.mutateAsync()}
              >
                {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
                Submit agent onboarding
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------- steps */

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[0.7rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, note }: { icon: typeof UserRound; title: string; note: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
        <Icon className="size-4" />
      </span>
      <div>
        <h2 className="font-display text-base font-bold tracking-tight">{title}</h2>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
    </div>
  );
}

function PersonalStep({
  value,
  onChange,
}: {
  value: PersonalDraft;
  onChange: (next: PersonalDraft) => void;
}) {
  const set = (patch: Partial<PersonalDraft>) => onChange({ ...value, ...patch });
  return (
    <div>
      <SectionTitle icon={UserRound} title="Personal information" note="Use your legal name as it appears on your license." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Legal first name" required>
          <Input value={value.first_name} onChange={(e) => set({ first_name: e.target.value })} />
        </Field>
        <Field label="Middle name">
          <Input value={value.middle_name} onChange={(e) => set({ middle_name: e.target.value })} />
        </Field>
        <Field label="Legal last name" required>
          <Input value={value.last_name} onChange={(e) => set({ last_name: e.target.value })} />
        </Field>
        <Field label="Preferred name">
          <Input value={value.preferred_name} onChange={(e) => set({ preferred_name: e.target.value })} />
        </Field>
        <Field label="Email">
          <Input value={value.email} readOnly className="bg-muted/50" />
        </Field>
        <Field label="Phone number" required hint="Format: (555) 123-4567">
          <Input
            value={value.phone}
            onChange={(e) => set({ phone: formatPhone(e.target.value) })}
            placeholder="(555) 123-4567"
          />
        </Field>
        <Field label="Date of birth" required>
          <Input type="date" value={value.date_of_birth} onChange={(e) => set({ date_of_birth: e.target.value })} />
        </Field>
        <Field label="Residential address" required>
          <Input value={value.address_line1} onChange={(e) => set({ address_line1: e.target.value })} />
        </Field>
        <Field label="Apartment / unit">
          <Input value={value.address_line2} onChange={(e) => set({ address_line2: e.target.value })} />
        </Field>
        <Field label="City" required>
          <Input value={value.city} onChange={(e) => set({ city: e.target.value })} />
        </Field>
        <Field label="State" required>
          <Select value={value.state ?? ""} onValueChange={(state) => set({ state })}>
            <SelectTrigger>
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="ZIP code" required>
          <Input
            value={value.zip}
            inputMode="numeric"
            maxLength={5}
            onChange={(e) => set({ zip: e.target.value.replace(/\D/g, "").slice(0, 5) })}
          />
        </Field>
      </div>

      <Separator className="my-6" />

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <Checkbox
          checked={value.mailing_same}
          onCheckedChange={(checked) => set({ mailing_same: checked === true })}
        />
        <span>My mailing address is the same as my residential address</span>
      </label>

      {!value.mailing_same && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Mailing address">
            <Input
              value={value.mailing_address_line1}
              onChange={(e) => set({ mailing_address_line1: e.target.value })}
            />
          </Field>
          <Field label="City">
            <Input value={value.mailing_city} onChange={(e) => set({ mailing_city: e.target.value })} />
          </Field>
          <Field label="State">
            <Select value={value.mailing_state ?? ""} onValueChange={(s) => set({ mailing_state: s })}>
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="ZIP code">
            <Input
              value={value.mailing_zip}
              maxLength={5}
              onChange={(e) => set({ mailing_zip: e.target.value.replace(/\D/g, "").slice(0, 5) })}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function LicensingStep({ value, onChange }: { value: LicensingInfo; onChange: (next: LicensingInfo) => void }) {
  const set = (patch: Partial<LicensingInfo>) => onChange({ ...value, ...patch });
  return (
    <div>
      <SectionTitle icon={BadgeCheck} title="Licensing" note="Your resident license and any additional appointed states." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="License state" required>
          <Select value={value.licenseState ?? ""} onValueChange={(licenseState) => set({ licenseState })}>
            <SelectTrigger>
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="License number" required>
          <Input value={value.licenseNumber ?? ""} onChange={(e) => set({ licenseNumber: e.target.value })} />
        </Field>
        <Field label="License type" required>
          <Select value={value.licenseType ?? ""} onValueChange={(licenseType) => set({ licenseType })}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {LICENSE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="License status">
          <Select value={value.licenseStatus ?? ""} onValueChange={(licenseStatus) => set({ licenseStatus })}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {LICENSE_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="License expiration date" required>
          <Input
            type="date"
            value={value.licenseExpires ?? ""}
            onChange={(e) => set({ licenseExpires: e.target.value })}
          />
        </Field>
        <Field label="NPN" hint="National Producer Number, if you have one">
          <Input value={value.npn ?? ""} onChange={(e) => set({ npn: e.target.value.replace(/\D/g, "") })} />
        </Field>
        <Field label="Additional licensed states" hint="Comma separated, e.g. TX, FL, GA">
          <Input value={value.additionalStates ?? ""} onChange={(e) => set({ additionalStates: e.target.value })} />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Anything we should know about your licensing">
          <Textarea rows={3} value={value.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

function BankingStep({ value, onChange }: { value: BankingInfo; onChange: (next: BankingInfo) => void }) {
  const set = (patch: Partial<BankingInfo>) => onChange({ ...value, ...patch });
  return (
    <div>
      <SectionTitle
        icon={Landmark}
        title="Banking & payment"
        note="Used only for commission payments. Stored securely and masked for staff."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Bank name" required>
          <Input value={value.bankName ?? ""} onChange={(e) => set({ bankName: e.target.value })} />
        </Field>
        <Field label="Account holder name" required>
          <Input value={value.accountHolder ?? ""} onChange={(e) => set({ accountHolder: e.target.value })} />
        </Field>
        <Field label="Account type" required>
          <Select value={value.accountType ?? ""} onValueChange={(accountType) => set({ accountType })}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Routing number" required hint="9 digits">
          <Input
            value={value.routingNumber ?? ""}
            inputMode="numeric"
            maxLength={9}
            onChange={(e) => set({ routingNumber: e.target.value.replace(/\D/g, "").slice(0, 9) })}
          />
        </Field>
        <Field label="Account number" required>
          <Input
            value={value.accountNumber ?? ""}
            inputMode="numeric"
            maxLength={17}
            onChange={(e) => set({ accountNumber: e.target.value.replace(/\D/g, "").slice(0, 17) })}
          />
        </Field>
      </div>
      <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
        <Lock className="mr-1.5 inline size-3.5" />
        Your full account details are never shown in lists or reports — staff only ever see the last four digits.
      </div>
    </div>
  );
}

function DocumentsStep({
  candidateId,
  documents,
  loading,
  onUploaded,
}: {
  candidateId: string;
  documents: Awaited<ReturnType<typeof fetchDocuments>>;
  loading: boolean;
  onUploaded: () => void;
}) {
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const pick = async (documentId: string, file?: File) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("That file is larger than 20 MB. Please upload a smaller copy.");
      return;
    }
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Please upload a PDF, PNG or JPG file.");
      return;
    }
    setBusy(documentId);
    try {
      await uploadDocument(candidateId, documentId, file);
      onUploaded();
      toast.success("Document uploaded");
    } catch {
      toast.error("The upload failed. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <SectionTitle icon={FileText} title="Documents" note="PDF, PNG or JPG up to 20 MB. You can replace a file before you submit." />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading your checklist…</p>
      ) : (
        <div className="space-y-2.5">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/60 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {doc.name}{" "}
                  {doc.required ? (
                    <span className="text-destructive">*</span>
                  ) : (
                    <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {doc.file_name ? `${doc.file_name} · uploaded ${new Date(doc.uploaded_at ?? "").toLocaleDateString()}` : "No file yet"}
                  {doc.review_note ? ` · ${doc.review_note}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <DocumentStatusBadge status={doc.status} />
                <input
                  ref={(node) => {
                    inputs.current[doc.id] = node;
                  }}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={(e) => void pick(doc.id, e.target.files?.[0])}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy === doc.id}
                  onClick={() => inputs.current[doc.id]?.click()}
                >
                  {busy === doc.id ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  {doc.file_path ? "Replace" : "Upload"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DocumentStatusBadge({ status }: { status: string }) {
  const tone =
    status === "Approved"
      ? "bg-success/12 text-success"
      : status === "Rejected" || status === "Replacement Required"
        ? "bg-destructive/10 text-destructive"
        : status === "Under Review"
          ? "bg-warning/20 text-brand-tan"
          : status === "Uploaded"
            ? "bg-brand/10 text-brand"
            : "bg-muted text-muted-foreground";
  return <Badge className={cn("rounded-md border-0 text-[0.65rem] font-semibold", tone)}>{status}</Badge>;
}

function AuthorizationsStep({
  value,
  onChange,
  agentName,
}: {
  value: AuthorizationInfo;
  onChange: (next: AuthorizationInfo) => void;
  agentName: string;
}) {
  const set = (patch: Partial<AuthorizationInfo>) => onChange({ ...value, ...patch });
  const items: { key: keyof AuthorizationInfo; label: string; note: string }[] = [
    {
      key: "backgroundCheck",
      label: "Background and licensing verification",
      note: "I authorize PolicyBear to verify my licensing history and run the background checks required for carrier appointment.",
    },
    {
      key: "directDeposit",
      label: "Direct deposit authorization",
      note: "I authorize commission payments to the bank account provided in this form.",
    },
    {
      key: "accuracy",
      label: "Accuracy acknowledgement",
      note: "I confirm the information in this form is accurate and complete to the best of my knowledge.",
    },
  ];

  return (
    <div>
      <SectionTitle
        icon={ShieldCheck}
        title="Authorizations & acknowledgements"
        note="Your acknowledgement is time-stamped and recorded on your onboarding record."
      />
      <div className="space-y-3">
        {items.map((item) => (
          <label
            key={item.key}
            className="flex cursor-pointer gap-3 rounded-xl border border-border/60 bg-card/60 p-3.5"
          >
            <Checkbox
              checked={value[item.key] === true}
              onCheckedChange={(checked) => set({ [item.key]: checked === true } as Partial<AuthorizationInfo>)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-semibold">{item.label}</span>
              <span className="block text-xs text-muted-foreground">{item.note}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Electronic signature — type your full legal name" required>
          <Input
            value={value.eSignName ?? ""}
            placeholder={agentName || "Your full legal name"}
            onChange={(e) => set({ eSignName: e.target.value, eSignAt: new Date().toISOString() })}
          />
        </Field>
        <Field label="Signed at">
          <Input readOnly className="bg-muted/50" value={value.eSignAt ? new Date(value.eSignAt).toLocaleString() : "—"} />
        </Field>
      </div>
    </div>
  );
}

function ReviewStep({
  personal,
  license,
  bank,
  auth,
  documents,
  problems,
  onEdit,
}: {
  personal: PersonalDraft;
  license: LicensingInfo;
  bank: BankingInfo;
  auth: AuthorizationInfo;
  documents: Awaited<ReturnType<typeof fetchDocuments>>;
  problems: { step: number; message: string }[];
  onEdit: (step: number) => void;
}) {
  return (
    <div className="space-y-5">
      <SectionTitle icon={FileCheck2} title="Review & submit" note="Check every section — after you submit, the form locks." />

      {problems.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3.5">
          <p className="text-sm font-semibold text-destructive">Still needed before you can submit</p>
          <ul className="mt-1.5 space-y-1 text-xs text-destructive/90">
            {problems.map((problem) => (
              <li key={problem.message}>• {problem.message}</li>
            ))}
          </ul>
        </div>
      )}

      <ReviewBlock title="Personal information" onEdit={() => onEdit(0)}>
        <Row label="Name" value={[personal.first_name, personal.middle_name, personal.last_name].filter(Boolean).join(" ")} />
        <Row label="Preferred name" value={personal.preferred_name} />
        <Row label="Email" value={personal.email} />
        <Row label="Phone" value={personal.phone} />
        <Row label="Date of birth" value={personal.date_of_birth} />
        <Row
          label="Address"
          value={[personal.address_line1, personal.address_line2, personal.city, personal.state, personal.zip]
            .filter(Boolean)
            .join(", ")}
        />
        <Row
          label="Mailing address"
          value={
            personal.mailing_same
              ? "Same as residential"
              : [personal.mailing_address_line1, personal.mailing_city, personal.mailing_state, personal.mailing_zip]
                  .filter(Boolean)
                  .join(", ")
          }
        />
      </ReviewBlock>

      <ReviewBlock title="Licensing" onEdit={() => onEdit(1)}>
        <Row label="State" value={license.licenseState} />
        <Row label="License number" value={license.licenseNumber} />
        <Row label="Type" value={license.licenseType} />
        <Row label="Status" value={license.licenseStatus} />
        <Row label="Expires" value={license.licenseExpires} />
        <Row label="NPN" value={license.npn} />
        <Row label="Additional states" value={license.additionalStates} />
      </ReviewBlock>

      <ReviewBlock title="Banking & payment" onEdit={() => onEdit(2)}>
        <Row label="Bank" value={bank.bankName} />
        <Row label="Account holder" value={bank.accountHolder} />
        <Row label="Account type" value={bank.accountType} />
        <Row label="Routing number" value={bank.routingNumber ? `•••••${bank.routingNumber.slice(-4)}` : ""} />
        <Row label="Account number" value={bank.accountNumber ? `•••••${bank.accountNumber.slice(-4)}` : ""} />
      </ReviewBlock>

      <ReviewBlock title="Documents" onEdit={() => onEdit(3)}>
        {documents.map((doc) => (
          <Row key={doc.id} label={doc.name} value={doc.file_name ?? doc.status} />
        ))}
      </ReviewBlock>

      <ReviewBlock title="Authorizations" onEdit={() => onEdit(4)}>
        <Row label="Background verification" value={auth.backgroundCheck ? "Authorized" : "Not authorized"} />
        <Row label="Direct deposit" value={auth.directDeposit ? "Authorized" : "Not authorized"} />
        <Row label="Accuracy acknowledgement" value={auth.accuracy ? "Acknowledged" : "Not acknowledged"} />
        <Row label="Signature" value={auth.eSignName} />
        <Row label="Signed at" value={auth.eSignAt ? new Date(auth.eSignAt).toLocaleString() : ""} />
      </ReviewBlock>
    </div>
  );
}

function ReviewBlock({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold tracking-tight">{title}</h3>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onEdit}>
          Edit
        </Button>
      </div>
      <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-border/50 py-1 last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-xs font-semibold">{value || "—"}</dd>
    </div>
  );
}

function SubmittedState({ candidate }: { candidate: Candidate }) {
  const documentsQuery = useQuery({
    queryKey: ["onboarding-documents", candidate.id],
    queryFn: () => fetchDocuments(candidate.id),
  });

  const open = async (path: string) => {
    try {
      window.open(await documentUrl(path), "_blank", "noopener");
    } catch {
      toast.error("That file could not be opened.");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="gap-0 overflow-hidden rounded-2xl border-white/70 bg-card/80 p-0 shadow-card">
        <div className="bg-brand-ink px-6 py-7 text-brand-ink-foreground">
          <span className="inline-flex items-center gap-2 rounded-full bg-success/20 px-3 py-1 text-[0.65rem] font-bold tracking-wide uppercase text-white">
            <CheckCircle2 className="size-3.5" /> Onboarding submitted
          </span>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight">Thanks, {candidate.first_name}</h1>
          <p className="mt-1.5 max-w-xl text-sm text-brand-ink-foreground/70">
            Your onboarding was received on {new Date(candidate.form_submitted_at ?? "").toLocaleString()}. Our team is
            reviewing your licensing, banking and documents. Your form is now locked — contact your onboarding
            manager if something needs to change.
          </p>
        </div>

        <div className="grid gap-3 px-6 py-6 sm:grid-cols-2">
          <StageLine label="Current stage" value={candidate.stage} />
          <StageLine label="Offer letter" value={candidate.offer_status} />
          <StageLine label="Carrier approval" value={candidate.carrier_status} />
          <StageLine label="Employment agreement" value={candidate.agreement_status} />
          <StageLine label="PolicyBear ARM access" value={candidate.access_status} />
        </div>
      </Card>

      <Card className="rounded-2xl border-white/70 bg-card/80 p-5 shadow-card">
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold tracking-tight">
          <Building2 className="size-4 text-brand" /> Your documents
        </h2>
        <div className="space-y-2">
          {(documentsQuery.data ?? []).map((doc) => (
            <div
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{doc.name}</p>
                <p className="truncate text-xs text-muted-foreground">{doc.file_name ?? "No file"}</p>
              </div>
              <div className="flex items-center gap-2">
                <DocumentStatusBadge status={doc.status} />
                {doc.file_path && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void open(doc.file_path!)}>
                    View
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StageLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 px-3.5 py-3">
      <p className="text-[0.6rem] font-bold tracking-[0.08em] uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
