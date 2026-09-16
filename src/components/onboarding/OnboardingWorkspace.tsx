import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  KeyRound,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmailAutomationDialog } from "@/components/onboarding/EmailAutomationDialog";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  actionRequired,
  createCandidate,
  dateLabel,
  fetchCandidates,
  fullName,
  hiringSteps,
  onboardingSteps,
  phaseOf,
  stampLabel,
  type Candidate,
  type OnboardingPhase,
} from "@/lib/onboarding";

const PHASE_TABS: { value: OnboardingPhase; label: string; hint: string }[] = [
  { value: "hiring", label: "Stage 1 · Hiring", hint: "Candidates, interviews, automated emails and the hiring decision" },
  { value: "onboarding", label: "Stage 2 · Onboarding", hint: "Offer letter → carrier approval → employment agreement → PolicyBear access" },
  { value: "completed", label: "Completed", hint: "Agents who finished every onboarding step" },
  { value: "not-hired", label: "Not hired", hint: "Closed candidates and the reason they were not hired" },
];

export function OnboardingWorkspace() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [phase, setPhase] = useState<OnboardingPhase>("hiring");
  const [flag, setFlag] = useState("all");
  const [creating, setCreating] = useState(false);
  const [automation, setAutomation] = useState(false);
  const stageListRef = useRef<HTMLDivElement>(null);

  const viewStage = (nextPhase: OnboardingPhase) => {
    setPhase(nextPhase);
    window.requestAnimationFrame(() => {
      stageListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const candidatesQuery = useQuery({ queryKey: ["onboarding-candidates"], queryFn: fetchCandidates });
  const candidates = candidatesQuery.data ?? [];

  const byPhase = useMemo(() => {
    const groups: Record<OnboardingPhase, Candidate[]> = {
      hiring: [],
      onboarding: [],
      completed: [],
      "not-hired": [],
    };
    for (const candidate of candidates) groups[phaseOf(candidate)].push(candidate);
    return groups;
  }, [candidates]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return byPhase[phase].filter((candidate) => {
      if (term) {
        const haystack = [fullName(candidate), candidate.email, candidate.phone, candidate.assigned_admin]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (flag === "action" && !actionRequired(candidate)) return false;
      if (flag === "interview" && !candidate.interview_at) return false;
      if (flag === "no-interview" && candidate.interview_at) return false;
      if (flag === "form" && !candidate.form_submitted_at) return false;
      if (flag === "no-form" && candidate.form_submitted_at) return false;
      return true;
    });
  }, [byPhase, phase, search, flag]);

  const stats = useMemo(
    () => ({
      hiring: byPhase.hiring.length,
      interviews: byPhase.hiring.filter((c) => c.interview_at && !c.interview_completed_at).length,
      awaitingDecision: byPhase.hiring.filter((c) => c.form_submitted_at && !c.hired_at).length,
      onboarding: byPhase.onboarding.length,
      awaitingSignature: byPhase.onboarding.filter(
        (c) =>
          c.offer_status === "Sent" ||
          c.offer_status === "Viewed" ||
          c.agreement_status === "Sent" ||
          c.agreement_status === "Viewed",
      ).length,
      carrier: byPhase.onboarding.filter((c) => c.carrier_status === "Requested" || c.carrier_status === "Pending")
        .length,
      completed: byPhase.completed.length,
      action: candidates.filter((c) => actionRequired(c)).length,
    }),
    [byPhase, candidates],
  );

  const create = useMutation({
    mutationFn: (input: { first: string; last: string; email: string; phone: string; source: string }) =>
      createCandidate({
        first_name: input.first,
        last_name: input.last,
        email: input.email,
        phone: input.phone,
        source: input.source,
        assigned_admin: user?.name ?? "",
      }),
    onSuccess: () => {
      toast.success("Candidate added to Stage 1 · Hiring");
      setCreating(false);
      setPhase("hiring");
      void queryClient.invalidateQueries({ queryKey: ["onboarding-candidates"] });
    },
    onError: () => toast.error("The candidate could not be added."),
  });

  const activeTab = PHASE_TABS.find((tab) => tab.value === phase)!;

  return (
    <div className="rounded-[1.4rem] border border-console-line bg-console p-5 text-console-foreground shadow-raised">
      {/* ------------------------------------------------------------ header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Agent pipeline control</h1>
          <p className="text-sm text-console-muted">
            Two stages — hiring first, then the locked onboarding steps once a candidate is approved.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="flex items-center gap-2 rounded-md border border-console-line bg-console-panel px-3 py-1.5 tracking-[0.14em] uppercase">
            <span className="size-2 rounded-full bg-success shadow-[0_0_8px_var(--success)]" />
            Live
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="border border-console-line bg-console-panel text-console-foreground hover:bg-console-inset hover:text-console-foreground"
            onClick={() => setAutomation(true)}
          >
            <Zap className="size-4" /> Email automation
          </Button>
          <Button
            size="sm"
            className="bg-console-accent tracking-wider text-console-accent-foreground uppercase hover:bg-console-accent/90"
            onClick={() => setCreating(true)}
          >
            <Plus className="size-4" /> Add candidate
          </Button>
        </div>
      </div>

      {/* -------------------------------------------------- stages + metrics */}
      <div className="mt-5 grid grid-cols-12 gap-3">
        <div className="col-span-12 grid gap-3 sm:grid-cols-2 lg:col-span-5">
          <StageSummary
            eyebrow="Stage 01"
            title="Hiring"
            count={stats.hiring}
            active={phase === "hiring"}
            onClick={() => viewStage("hiring")}
            rows={[
              ["Interviews upcoming", stats.interviews],
              ["Awaiting decision", stats.awaitingDecision],
            ]}
            icon={<ClipboardList className="size-3.5" />}
          />
          <StageSummary
            eyebrow="Stage 02"
            title="Onboarding"
            count={stats.onboarding}
            active={phase === "onboarding"}
            onClick={() => viewStage("onboarding")}
            rows={[
              ["Awaiting signature", stats.awaitingSignature],
              ["Carrier pending", stats.carrier],
            ]}
            icon={<ShieldCheck className="size-3.5" />}
            muted
          />
        </div>

        <div className="col-span-12 grid grid-cols-2 gap-3 lg:col-span-7 lg:grid-cols-4">
          <ConsoleTile label="In hiring" value={stats.hiring} />
          <ConsoleTile label="In onboarding" value={stats.onboarding} />
          <ConsoleTile label="Action required" value={stats.action} alert />
          <ConsoleTile label="Completed" value={stats.completed} />
        </div>
      </div>

      {/* ----------------------------------------------------- pipeline board */}
      <div
        ref={stageListRef}
        className="mt-4 scroll-mt-4 overflow-hidden rounded-xl border border-console-line bg-console-panel"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-console-line px-4">
          <div className="flex flex-wrap gap-5">
            {PHASE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setPhase(tab.value)}
                className={cn(
                  "-mb-px border-b-2 px-1 py-4 text-[0.68rem] font-bold tracking-[0.16em] whitespace-nowrap uppercase transition-colors",
                  phase === tab.value
                    ? "border-console-accent text-console-foreground"
                    : "border-transparent text-console-muted hover:text-console-foreground",
                )}
              >
                {tab.label} ({byPhase[tab.value].length})
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-console-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search candidates…"
                className="h-8 w-56 border-console-line bg-console pl-8 text-xs text-console-foreground placeholder:text-console-muted focus-visible:border-console-accent/60 focus-visible:ring-0"
              />
            </div>
            <Select value={flag} onValueChange={setFlag}>
              <SelectTrigger className="h-8 w-[12.5rem] border-console-line bg-console text-xs text-console-foreground">
                <SlidersHorizontal className="size-3.5 text-console-muted" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone in this stage</SelectItem>
                <SelectItem value="action">Action required</SelectItem>
                <SelectItem value="interview">Interview scheduled</SelectItem>
                <SelectItem value="no-interview">No interview yet</SelectItem>
                <SelectItem value="form">Form submitted</SelectItem>
                <SelectItem value="no-form">Form not submitted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="border-b border-console-line px-4 py-2 text-[0.7rem] text-console-muted">{activeTab.hint}</p>

        <div className="grid gap-3 p-4 md:grid-cols-2">
          {visible.map((candidate) => (
            <CandidateCard key={candidate.id} candidate={candidate} phase={phase} />
          ))}
        </div>

        {visible.length === 0 && (
          <div className="px-4 pb-8 text-center">
            <p className="text-sm font-semibold">
              {candidatesQuery.isLoading ? "Loading records…" : "Nobody in this stage right now."}
            </p>
            {!candidatesQuery.isLoading && phase === "onboarding" && (
              <>
                <p className="mx-auto mt-1.5 max-w-md text-xs text-console-muted">
                  People land here only after you approve their hiring decision in Stage 1. Open a candidate in Stage 1
                  and choose “Approve &amp; move to Stage 2”.
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mx-auto mt-3 border border-console-line bg-console text-console-foreground hover:bg-console-inset hover:text-console-foreground"
                  onClick={() => setPhase("hiring")}
                >
                  Go to Stage 1 · Hiring
                </Button>
              </>
            )}
            {!candidatesQuery.isLoading && phase === "completed" && (
              <p className="mx-auto mt-1.5 max-w-md text-xs text-console-muted">
                Candidates appear here once all four Stage 2 steps are finished and PolicyBear access is granted.
              </p>
            )}
            {!candidatesQuery.isLoading && phase === "hiring" && (
              <Button
                size="sm"
                className="mx-auto mt-3 bg-console-accent text-console-accent-foreground hover:bg-console-accent/90"
                onClick={() => setCreating(true)}
              >
                <Plus className="size-4" /> Add your first candidate
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[0.65rem] tracking-[0.12em] text-console-muted uppercase">
        <span>
          {candidates.length} records tracked · {visible.length} shown
        </span>
        <span className="flex items-center gap-2">
          <span className="size-1 rounded-full bg-console-accent" /> PolicyBear hiring pipeline
        </span>
      </div>

      <CreateCandidateDialog
        open={creating}
        onOpenChange={setCreating}
        busy={create.isPending}
        onSubmit={(input) => void create.mutateAsync(input)}
      />

      <EmailAutomationDialog open={automation} onOpenChange={setAutomation} />
    </div>
  );
}

/* -------------------------------------------------------------- fragments */

function ConsoleTile({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-2 rounded-lg border p-3",
        alert
          ? "border-console-accent/40 bg-console-panel ring-1 ring-console-accent/20"
          : "border-console-line bg-console-panel/60",
      )}
    >
      <span
        className={cn(
          "text-[0.62rem] font-bold tracking-[0.1em] uppercase",
          alert ? "text-console-accent" : "text-console-muted",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-display text-2xl font-bold tabular-nums",
          alert ? "text-console-accent" : "text-console-foreground",
        )}
      >
        {String(value).padStart(2, "0")}
      </span>
    </div>
  );
}

function StageSummary({
  eyebrow,
  title,
  count,
  rows,
  active,
  onClick,
  icon,
  muted,
}: {
  eyebrow: string;
  title: string;
  count: number;
  rows: [string, number][];
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-r-lg border-l-4 bg-console-panel p-4 text-left transition-all hover:-translate-y-0.5",
        muted ? "border-l-console-foreground/30" : "border-l-console-accent",
        active && "ring-1 ring-console-accent/40",
      )}
    >
      <span className="pointer-events-none absolute -top-4 -right-4 size-16 rounded-full bg-console-foreground/5 transition-transform duration-700 group-hover:scale-150" />
      <p
        className={cn(
          "flex items-center gap-1.5 text-[0.62rem] font-bold tracking-[0.16em] uppercase",
          muted ? "text-console-muted" : "text-console-accent",
        )}
      >
        {icon} {eyebrow}
      </p>
      <p className="mt-1 font-display text-lg font-semibold">{title}</p>
      <p className="mt-1.5 font-display text-3xl font-bold tabular-nums">
        {count} <span className="text-[0.62rem] font-normal tracking-[0.14em] text-console-muted uppercase">People</span>
      </p>
      <div className="mt-3 space-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between border-b border-console-line py-1">
            <span className="text-[0.7rem] text-console-muted">{label}</span>
            <span className="text-[0.7rem] font-semibold tabular-nums">{value}</span>
          </div>
        ))}
      </div>
      <p className="mt-2.5 flex items-center gap-1 text-[0.68rem] font-bold tracking-[0.12em] text-console-accent uppercase">
        View this stage <ArrowRight className="size-3.5" />
      </p>
    </button>
  );
}

function CandidateCard({ candidate, phase }: { candidate: Candidate; phase: OnboardingPhase }) {
  const steps =
    phase === "hiring"
      ? hiringSteps(candidate).map((step) => ({ key: step.key, label: step.label, state: step.state }))
      : onboardingSteps(candidate)
          .filter((step) => step.key !== "form")
          .map((step) => ({ key: step.key, label: step.label, state: step.state }));
  const next = actionRequired(candidate);

  return (
    <Link
      to="/admin/onboarding/$candidateId"
      params={{ candidateId: candidate.id }}
      className={cn(
        "block rounded-lg border bg-console p-4 transition-all duration-300 hover:border-console-accent/40",
        next ? "border-l-4 border-console-line border-l-console-accent ring-1 ring-console-accent/10" : "border-console-line",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold">{fullName(candidate)}</p>
          <p className="truncate text-[0.68rem] text-console-muted">
            {candidate.email} · updated {dateLabel(candidate.last_activity_at)}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded border px-2 py-0.5 text-[0.6rem] font-bold tracking-tight uppercase",
            next
              ? "border-console-accent/30 bg-console-accent/10 text-console-accent"
              : "border-console-line bg-console-panel text-console-muted",
          )}
        >
          {next ?? candidate.stage}
        </span>
      </div>

      {phase === "hiring" && (candidate.interview_at || candidate.sequence_paused) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[0.62rem] text-console-muted">
          {candidate.interview_at && (
            <span className="flex items-center gap-1 rounded border border-console-line px-1.5 py-0.5">
              <CalendarClock className="size-3" /> {stampLabel(candidate.interview_at)}
            </span>
          )}
          {candidate.sequence_paused && (
            <span className="rounded border border-console-line px-1.5 py-0.5">Emails paused</span>
          )}
        </div>
      )}

      {/* step rail */}
      <div className="mt-5 flex items-start justify-between">
        {steps.map((step, index) => (
          <div key={step.key} className="flex min-w-0 flex-1 items-start">
            {index > 0 && (
              <span
                className={cn(
                  "mt-3 h-px flex-1",
                  step.state === "done" || step.state === "current" ? "bg-console-accent/50" : "bg-console-line",
                )}
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border",
                  step.state === "done"
                    ? "border-console-accent bg-console-accent text-console-accent-foreground"
                    : step.state === "blocked"
                      ? "border-destructive bg-console text-destructive"
                      : step.state === "locked"
                        ? "border-console-line bg-console-panel text-console-muted"
                        : "border-2 border-console-accent bg-console ring-4 ring-console-accent/20",
                )}
              >
                {step.state === "done" ? (
                  <Check className="size-3" strokeWidth={3} />
                ) : step.state === "blocked" ? (
                  <X className="size-3" strokeWidth={3} />
                ) : step.state === "locked" ? (
                  <Lock className="size-3" />
                ) : (
                  <span className="size-1.5 rounded-full bg-console-accent" />
                )}
              </span>
              <span
                className={cn(
                  "w-full text-center text-[0.58rem] leading-tight font-semibold",
                  step.state === "locked" ? "text-console-muted/60" : "text-console-muted",
                  step.state === "current" && "text-console-accent",
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <span
                className={cn(
                  "mt-3 h-px flex-1",
                  step.state === "done" ? "bg-console-accent/50" : "bg-console-line",
                )}
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-end border-t border-console-line pt-2.5 text-[0.62rem] font-bold tracking-[0.12em] text-console-muted uppercase">
        Open record <ChevronRight className="size-3.5" />
      </div>
    </Link>
  );
}

export function StageChip({ stage }: { stage: string }) {
  const tone =
    stage === "Onboarding Completed"
      ? "bg-success/12 text-success"
      : stage === "Not Hired"
        ? "bg-destructive/10 text-destructive"
        : stage.includes("Signed") || stage === "Carrier Approved" || stage === "Hired / Finalized"
          ? "bg-brand/10 text-brand"
          : "bg-muted text-muted-foreground";
  return (
    <Badge className={cn("rounded-md border-0 text-[0.65rem] font-semibold whitespace-nowrap", tone)}>{stage}</Badge>
  );
}

function CreateCandidateDialog({
  open,
  onOpenChange,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onSubmit: (input: { first: string; last: string; email: string; phone: string; source: string }) => void;
}) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("Direct application");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add candidate</DialogTitle>
          <DialogDescription>
            Starts Stage 1 · Hiring. Stage 2 unlocks only after you approve the hiring decision.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">First name</Label>
            <Input value={first} onChange={(e) => setFirst(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Last name</Label>
            <Input value={last} onChange={(e) => setLast(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-semibold">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Direct application", "Referral", "Job board", "Recruiter", "Walk-in"].map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={busy || !first.trim() || !last.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)}
            onClick={() => onSubmit({ first: first.trim(), last: last.trim(), email: email.trim(), phone, source })}
          >
            <KeyRound className="size-4" /> Add candidate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
