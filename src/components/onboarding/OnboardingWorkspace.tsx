import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileSignature,
  KeyRound,
  Plus,
  Search,
  ShieldCheck,
  Users,
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
  ONBOARDING_STAGES,
  PIPELINE_COLUMNS,
  actionRequired,
  createCandidate,
  daysSince,
  dateLabel,
  fetchCandidates,
  fullName,
  pipelineColumnFor,
  type Candidate,
} from "@/lib/onboarding";

export function OnboardingWorkspace() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [column, setColumn] = useState("all");
  const [flag, setFlag] = useState("all");
  const [creating, setCreating] = useState(false);
  const [automation, setAutomation] = useState(false);

  const candidatesQuery = useQuery({ queryKey: ["onboarding-candidates"], queryFn: fetchCandidates });
  const candidates = candidatesQuery.data ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return candidates.filter((candidate) => {
      if (term) {
        const haystack = [fullName(candidate), candidate.email, candidate.phone, candidate.assigned_admin]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (stage !== "all" && candidate.stage !== stage) return false;
      if (column !== "all" && pipelineColumnFor(candidate) !== column) return false;
      if (flag === "action" && !actionRequired(candidate)) return false;
      if (flag === "form" && !candidate.form_submitted_at) return false;
      if (flag === "offer" && candidate.offer_status !== "Signed") return false;
      if (flag === "carrier" && candidate.carrier_status !== "Approved") return false;
      if (flag === "agreement" && candidate.agreement_status !== "Signed") return false;
      if (flag === "done" && candidate.access_status !== "Completed") return false;
      return true;
    });
  }, [candidates, search, stage, column, flag]);

  const stats = useMemo(() => {
    const active = candidates.filter((c) => c.stage !== "Not Hired" && c.stage !== "Onboarding Completed");
    return {
      active: active.length,
      hiring: candidates.filter((c) => !c.hired_at && c.stage !== "Not Hired").length,
      awaitingSignature: candidates.filter(
        (c) => c.offer_status === "Sent" || c.offer_status === "Viewed" || c.agreement_status === "Sent" || c.agreement_status === "Viewed",
      ).length,
      carrier: candidates.filter((c) => c.carrier_status === "Requested" || c.carrier_status === "Pending").length,
      completed: candidates.filter((c) => c.access_status === "Completed").length,
      action: candidates.filter((c) => actionRequired(c)).length,
    };
  }, [candidates]);

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
      toast.success("Candidate added to the hiring pipeline");
      setCreating(false);
      void queryClient.invalidateQueries({ queryKey: ["onboarding-candidates"] });
    },
    onError: () => toast.error("The candidate could not be added."),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">Agent onboarding</h1>
          <p className="text-xs text-muted-foreground">
            Hiring → onboarding form → offer letter → carrier approval → employment agreement → PolicyBear access
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="In onboarding" value={stats.active} tone="brand" icon={<Users />} />
        <StatCard label="Hiring phase" value={stats.hiring} tone="info" icon={<ClipboardList />} />
        <StatCard label="Awaiting signature" value={stats.awaitingSignature} tone="warning" icon={<FileSignature />} />
        <StatCard label="Carrier pending" value={stats.carrier} tone="default" icon={<ShieldCheck />} />
        <StatCard label="Action required" value={stats.action} tone="danger" icon={<AlertTriangle />} />
        <StatCard label="Completed" value={stats.completed} tone="success" icon={<CheckCircle2 />} />
      </div>

      <Card className="rounded-2xl border-white/70 bg-card/70 p-3.5 shadow-card backdrop-blur-xl">
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
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="h-9 w-[13rem]">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {ONBOARDING_STAGES.map((entry) => (
                <SelectItem key={entry} value={entry}>
                  {entry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={column} onValueChange={setColumn}>
            <SelectTrigger className="h-9 w-[11rem]">
              <SelectValue placeholder="Pipeline" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Whole pipeline</SelectItem>
              {PIPELINE_COLUMNS.map((entry) => (
                <SelectItem key={entry.key} value={entry.key}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={flag} onValueChange={setFlag}>
            <SelectTrigger className="h-9 w-[12rem]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">No extra filter</SelectItem>
              <SelectItem value="action">Action required</SelectItem>
              <SelectItem value="form">Form submitted</SelectItem>
              <SelectItem value="offer">Offer signed</SelectItem>
              <SelectItem value="carrier">Carrier approved</SelectItem>
              <SelectItem value="agreement">Agreement signed</SelectItem>
              <SelectItem value="done">Onboarding completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="list">All records</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {PIPELINE_COLUMNS.map((entry) => {
              const cards = filtered.filter((candidate) => pipelineColumnFor(candidate) === entry.key);
              return (
                <Card
                  key={entry.key}
                  className="gap-0 rounded-2xl border-white/70 bg-card/70 p-3 shadow-card backdrop-blur-xl"
                >
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="text-[0.65rem] font-bold tracking-[0.1em] uppercase text-muted-foreground">
                      {entry.label}
                    </p>
                    <Badge variant="secondary" className="rounded-md text-[0.65rem]">
                      {cards.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {cards.length === 0 && (
                      <p className="rounded-xl border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
                        Nobody here right now.
                      </p>
                    )}
                    {cards.map((candidate) => (
                      <Link
                        key={candidate.id}
                        to="/admin/onboarding/$candidateId"
                        params={{ candidateId: candidate.id }}
                        className="block rounded-xl border border-border/60 bg-card/80 p-3 transition-all hover:-translate-y-0.5 hover:shadow-raised"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold">{fullName(candidate)}</p>
                          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{candidate.stage}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.65rem]">
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">
                            {daysSince(candidate.last_activity_at)}d in stage
                          </span>
                          {actionRequired(candidate) && (
                            <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 font-semibold text-destructive">
                              {actionRequired(candidate)}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="list" className="mt-3">
          <Card className="overflow-hidden rounded-2xl border-white/70 bg-card/70 p-0 shadow-card backdrop-blur-xl">
            <div className="max-h-[34rem] overflow-auto">
              <table className="w-full min-w-[64rem] text-sm">
                <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur">
                  <tr className="text-left text-[0.65rem] font-bold tracking-[0.08em] uppercase text-muted-foreground">
                    <th className="px-3 py-2.5">Agent</th>
                    <th className="px-3 py-2.5">Stage</th>
                    <th className="px-3 py-2.5">Form</th>
                    <th className="px-3 py-2.5">Offer</th>
                    <th className="px-3 py-2.5">Carrier</th>
                    <th className="px-3 py-2.5">Agreement</th>
                    <th className="px-3 py-2.5">Access</th>
                    <th className="px-3 py-2.5">Assigned</th>
                    <th className="px-3 py-2.5">Last activity</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((candidate) => (
                    <tr key={candidate.id} className="border-t border-border/50 hover:bg-muted/40">
                      <td className="px-3 py-2.5">
                        <p className="font-semibold">{fullName(candidate)}</p>
                        <p className="text-xs text-muted-foreground">
                          {candidate.email}
                          {candidate.phone ? ` · ${candidate.phone}` : ""}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <StageChip stage={candidate.stage} />
                        {actionRequired(candidate) && (
                          <p className="mt-1 text-[0.65rem] font-semibold text-destructive">
                            {actionRequired(candidate)}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs">{dateLabel(candidate.form_submitted_at)}</td>
                      <td className="px-3 py-2.5 text-xs">{candidate.offer_status}</td>
                      <td className="px-3 py-2.5 text-xs">{candidate.carrier_status}</td>
                      <td className="px-3 py-2.5 text-xs">{candidate.agreement_status}</td>
                      <td className="px-3 py-2.5 text-xs">{candidate.access_status}</td>
                      <td className="px-3 py-2.5 text-xs">{candidate.assigned_admin ?? "—"}</td>
                      <td className="px-3 py-2.5 text-xs">{dateLabel(candidate.last_activity_at)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                          <Link to="/admin/onboarding/$candidateId" params={{ candidateId: candidate.id }}>
                            Open
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-3 py-10 text-center text-sm text-muted-foreground">
                        {candidatesQuery.isLoading ? "Loading onboarding records…" : "No onboarding records match these filters."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateCandidateDialog
        open={creating}
        onOpenChange={setCreating}
        busy={create.isPending}
        onSubmit={(input) => void create.mutateAsync(input)}
      />
    </div>
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
            Starts the hiring phase. The onboarding workflow unlocks once you hire the candidate.
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
