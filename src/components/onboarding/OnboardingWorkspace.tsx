import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileSignature,
  KeyRound,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  Users,
  XCircle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/crm/StatCard";
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">Agent onboarding</h1>
          <p className="text-xs text-muted-foreground">
            Two stages — hiring first, then the locked onboarding steps once a candidate is approved.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setAutomation(true)}>
            <Zap className="size-4" /> Email automation
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add candidate
          </Button>
        </div>
      </div>

      {/* ----------------------------------------------------- stage overview */}
      <div className="grid gap-3 lg:grid-cols-2">
        <StageSummary
          eyebrow="Stage 1"
          title="Hiring"
          description="Add candidates, schedule the interview, let the automated emails run, then approve or decline."
          count={stats.hiring}
          active={phase === "hiring"}
          onClick={() => setPhase("hiring")}
          rows={[
            ["Interviews upcoming", stats.interviews],
            ["Awaiting hiring decision", stats.awaitingDecision],
          ]}
          icon={<ClipboardList className="size-4" />}
        />
        <StageSummary
          eyebrow="Stage 2"
          title="Onboarding"
          description="Offer letter → carrier approval → employment agreement → PolicyBear access. Each step unlocks the next."
          count={stats.onboarding}
          active={phase === "onboarding"}
          onClick={() => setPhase("onboarding")}
          rows={[
            ["Awaiting signature", stats.awaitingSignature],
            ["Carrier approval pending", stats.carrier],
          ]}
          icon={<ShieldCheck className="size-4" />}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="In hiring" value={stats.hiring} tone="info" icon={<Users />} />
        <StatCard label="In onboarding" value={stats.onboarding} tone="brand" icon={<FileSignature />} />
        <StatCard label="Action required" value={stats.action} tone="danger" icon={<AlertTriangle />} />
        <StatCard label="Completed" value={stats.completed} tone="success" icon={<CheckCircle2 />} />
      </div>

      {/* -------------------------------------------------------- stage lists */}
      <Tabs value={phase} onValueChange={(value) => setPhase(value as OnboardingPhase)}>
        <TabsList className="flex-wrap">
          {PHASE_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              <Badge variant="secondary" className="ml-1.5 rounded-md text-[0.6rem]">
                {byPhase[tab.value].length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <Card className="mt-3 rounded-2xl border-white/70 bg-card/70 p-3.5 shadow-card backdrop-blur-xl">
          <p className="mb-2.5 text-xs text-muted-foreground">{activeTab.hint}</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[13rem] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, phone or assigned admin"
                className="h-9 pl-9"
              />
            </div>
            <Select value={flag} onValueChange={setFlag}>
              <SelectTrigger className="h-9 w-[14rem]">
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
        </Card>

        {PHASE_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((candidate) => (
                <CandidateCard key={candidate.id} candidate={candidate} phase={tab.value} />
              ))}
            </div>
            {visible.length === 0 && (
              <Card className="rounded-2xl border-dashed border-border/70 bg-card/60 p-8 text-center">
                <p className="text-sm font-semibold">
                  {candidatesQuery.isLoading ? "Loading records…" : "Nobody in this stage right now."}
                </p>
                {tab.value === "hiring" && !candidatesQuery.isLoading && (
                  <Button size="sm" className="mt-3" onClick={() => setCreating(true)}>
                    <Plus className="size-4" /> Add your first candidate
                  </Button>
                )}
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

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

function StageSummary({
  eyebrow,
  title,
  description,
  count,
  rows,
  active,
  onClick,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  count: number;
  rows: [string, number][];
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left shadow-card backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-raised",
        active ? "border-brand/40 bg-brand/5" : "border-white/70 bg-card/70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[0.62rem] font-bold tracking-[0.14em] uppercase text-brand">
            {icon} {eyebrow}
          </p>
          <p className="mt-1 font-display text-lg font-bold tracking-tight">{title}</p>
        </div>
        <p className="font-display text-2xl font-bold tracking-tight">{count}</p>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{description}</p>
      <div className="mt-3 space-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between border-b border-dashed border-border/50 py-1">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-xs font-semibold">{value}</span>
          </div>
        ))}
      </div>
      <p className="mt-2.5 flex items-center gap-1 text-xs font-semibold text-brand">
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
      className="block rounded-2xl border border-white/70 bg-card/70 p-4 shadow-card backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-raised"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{fullName(candidate)}</p>
          <p className="truncate text-xs text-muted-foreground">{candidate.email}</p>
        </div>
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <StageChip stage={candidate.stage} />
        {candidate.interview_at && phase === "hiring" && (
          <Badge variant="secondary" className="rounded-md text-[0.62rem]">
            <CalendarClock className="mr-1 size-3" />
            {stampLabel(candidate.interview_at)}
          </Badge>
        )}
        {candidate.sequence_paused && phase === "hiring" && (
          <Badge variant="secondary" className="rounded-md text-[0.62rem]">
            Emails paused
          </Badge>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        {steps.map((step) => (
          <div key={step.key} className="flex items-center gap-2">
            {step.state === "done" ? (
              <CheckCircle2 className="size-3.5 shrink-0 text-success" />
            ) : step.state === "locked" ? (
              <Lock className="size-3.5 shrink-0 text-muted-foreground" />
            ) : step.state === "blocked" ? (
              <XCircle className="size-3.5 shrink-0 text-destructive" />
            ) : (
              <BadgeCheck className="size-3.5 shrink-0 text-brand" />
            )}
            <span
              className={cn(
                "truncate text-xs",
                step.state === "done"
                  ? "text-muted-foreground line-through"
                  : step.state === "locked"
                    ? "text-muted-foreground"
                    : "font-semibold",
              )}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-2.5">
        <p className="truncate text-[0.68rem] text-muted-foreground">
          Updated {dateLabel(candidate.last_activity_at)}
        </p>
        {next && (
          <span className="truncate rounded-md bg-destructive/10 px-1.5 py-0.5 text-[0.62rem] font-semibold text-destructive">
            {next}
          </span>
        )}
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
