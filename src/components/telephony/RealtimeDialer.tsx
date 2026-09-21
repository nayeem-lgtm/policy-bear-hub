/**
 * Policy Bear Dialer — a self-contained, real-time softphone for the agent desk.
 *
 * Independent of any external dialer: inbound queue, keypad, live call controls
 * (hold / mute / DTMF / transfer), wrap-up dispositions, callbacks, power
 * dialing and today's activity all run on the CRM's own call records.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import {
  ArrowLeftRight,
  Ban,
  BookOpenText,
  Bell,
  BellOff,
  CalendarClock,
  ClipboardList,
  ClipboardPaste,
  Copy,
  Delete,
  Gauge,
  Grip,
  History,
  Keyboard,
  Mic,
  MicOff,
  Pause,
  Phone,
  PhoneCall,
  PhoneForwarded,
  PhoneIncoming,
  PhoneOff,
  Play,
  PlusCircle,
  Rocket,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Signal,
  Star,
  StickyNote,
  Timer,
  Trash2,
  Users,
  Volume2,
  Zap,
} from "lucide-react";


import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  CALLBACK_STATUSES,
  CALLBACK_STATUS_TONE,
  clock,
  DISPOSITIONS,
  DISPOSITION_TONE,
  type CallbackStatus,
  type Disposition,
  type StartCallInput,
} from "@/lib/dialer-shared";
import { formatPhone } from "@/lib/phone";
import {
  claimNextLead,
  controlCall,
  getDialerDesk,
  simulateInboundCall,
  startCall,
  updateCallback,
  wrapCall,
} from "@/lib/dialer.functions";
import { checkDncNumber, getDncCenter } from "@/lib/dnc.functions";
import { DNC_ACTION_LABEL, DNC_ACTION_TONE } from "@/lib/dnc-shared";
import { CallbackDialog } from "@/components/callbacks/CallbackDialog";
import { AddToDncDialog } from "@/components/compliance/AddToDncDialog";
import { LeadIntakePanel } from "@/components/telephony/LeadIntakePanel";
import { CallScriptDialog, ScriptReaderPanel } from "@/components/telephony/CallScriptDialog";
import { cn } from "@/lib/utils";
import { playChirp, playDtmf, playRing } from "@/lib/dialer-tones";

const KEYPAD: { key: string; sub: string }[] = [
  { key: "1", sub: "" },
  { key: "2", sub: "ABC" },
  { key: "3", sub: "DEF" },
  { key: "4", sub: "GHI" },
  { key: "5", sub: "JKL" },
  { key: "6", sub: "MNO" },
  { key: "7", sub: "PQRS" },
  { key: "8", sub: "TUV" },
  { key: "9", sub: "WXYZ" },
  { key: "*", sub: "" },
  { key: "0", sub: "+" },
  { key: "#", sub: "" },
];

const QUICK_DISPOSITIONS: Disposition[] = ["Sold", "Interested", "Not Interested", "No Answer", "DNC"];

const SPEED_DIAL_KEY = "pb.dialer.speedDial";
const WRAP_ALLOWANCE = 45;

type DeskTab = "lead" | "queue" | "callbacks" | "power" | "history" | "compliance";

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "0-9 * #", label: "Type digits" },
  { keys: "Enter", label: "Dial / answer" },
  { keys: "Backspace", label: "Delete digit" },
  { keys: "M", label: "Mute" },
  { keys: "H", label: "Hold" },
  { keys: "Esc", label: "End call" },
];

/** Is the user typing into a field? Hotkeys must stay out of the way then. */
function isTypingTarget(el: EventTarget | null) {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || node.isContentEditable;
}


function secondsSince(iso: string | null | undefined) {
  if (!iso) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
}

function waitTone(seconds: number) {
  if (seconds > 120) return "text-destructive";
  if (seconds > 45) return "text-warning";
  return "text-success";
}

export function RealtimeDialer() {
  const queryClient = useQueryClient();

  const loadDesk = useServerFn(getDialerDesk);
  const dial = useServerFn(startCall);
  const control = useServerFn(controlCall);
  const wrap = useServerFn(wrapCall);
  const patchCallback = useServerFn(updateCallback);
  const simulate = useServerFn(simulateInboundCall);
  const nextLead = useServerFn(claimNextLead);

  const desk = useQuery({
    queryKey: ["dialer-desk"],
    queryFn: () => loadDesk(),
    refetchInterval: 4000,
  });
  const data = desk.data;
  const active = data?.active ?? null;

  // one-second heartbeat so live timers stay honest between refetches
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const [ready, setReady] = useState(true);
  const [autoAnswer, setAutoAnswer] = useState(false);
  const [digits, setDigits] = useState("");
  const [fromId, setFromId] = useState("auto");
  const [tones, setTones] = useState("");
  const [disposition, setDisposition] = useState<Disposition | "">("");
  const [notes, setNotes] = useState("");
  const [callbackAt, setCallbackAt] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [showInCallPad, setShowInCallPad] = useState(false);
  const [cbFilter, setCbFilter] = useState<"open" | CallbackStatus>("open");
  const [sim, setSim] = useState({ phone: "", numberId: "auto" });
  const [campaignId, setCampaignId] = useState("");
  const [search, setSearch] = useState("");
  const [lead, setLead] = useState<{ id: string; phone_e164: string; contact_name: string | null } | null>(
    null,
  );
  const [dncOpen, setDncOpen] = useState(false);
  const [dncTarget, setDncTarget] = useState<{ phone: string; name: string | null }>({
    phone: "",
    name: null,
  });
  const [cbOpen, setCbOpen] = useState(false);
  const [cbTarget, setCbTarget] = useState<{ phone: string; name: string | null }>({
    phone: "",
    name: null,
  });


  /* premium desk options: audio, speed dial, live notes, auto-flow */
  const [sound, setSound] = useState(true);
  const [autoNext, setAutoNext] = useState(false);
  const [liveNotes, setLiveNotes] = useState("");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [speedDial, setSpeedDial] = useState<{ phone: string; name: string }[]>([]);
  const [leftPanel, setLeftPanel] = useState<"dialer" | "script">("dialer");
  const [deskTab, setDeskTab] = useState<DeskTab>("lead");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SPEED_DIAL_KEY);
      if (raw) setSpeedDial(JSON.parse(raw) as { phone: string; name: string }[]);
    } catch {
      /* ignore malformed local data */
    }
  }, []);

  const saveSpeedDial = useCallback((next: { phone: string; name: string }[]) => {
    setSpeedDial(next);
    try {
      localStorage.setItem(SPEED_DIAL_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — keep in memory only */
    }
  }, []);


  /* ------------------------------------------------- live Do-Not-Call pre-check */
  const checkDnc = useServerFn(checkDncNumber);
  const loadBlocked = useServerFn(getDncCenter);
  const [debouncedDigits, setDebouncedDigits] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedDigits(digits), 350);
    return () => clearTimeout(id);
  }, [digits]);

  const dncCheck = useQuery({
    queryKey: ["dnc-check", debouncedDigits],
    queryFn: () => checkDnc({ data: { phone: debouncedDigits } }),
    enabled: debouncedDigits.replace(/\D/g, "").length >= 7,
    staleTime: 15000,
  });
  const dncBlocked = Boolean(dncCheck.data?.blocked);
  const dncEntry = dncCheck.data?.entry ?? null;

  const blocked = useQuery({
    queryKey: ["dnc-blocked"],
    queryFn: () => loadBlocked({ data: { action: "dial_blocked", days: 7, limit: 50, status: "active" } }),
    refetchInterval: 30000,
  });

  const openDnc = (phone: string | null | undefined, name?: string | null) => {
    setDncTarget({ phone: phone ?? "", name: name ?? null });
    setDncOpen(true);
  };

  const openCallback = (phone: string | null | undefined, name?: string | null) => {
    setCbTarget({ phone: phone ?? "", name: name ?? null });
    setCbOpen(true);
  };


  const refresh = () => queryClient.invalidateQueries({ queryKey: ["dialer-desk"] });


  const dialMutation = useMutation({
    mutationFn: (input: StartCallInput) => dial({ data: input }),
    onSuccess: () => {
      toast.success("Dialing…");
      setDigits("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const controlMutation = useMutation({
    mutationFn: (input: {
      callId: string;
      action: "answer" | "hold" | "resume" | "mute" | "unmute" | "hangup" | "transfer";
      transferTo?: string;
    }) => control({ data: input }),
    onSuccess: (_r, v) => {
      if (v.action === "hangup" || v.action === "transfer") {
        toast.success("Call ended — add an outcome");
        setTones("");
        setShowInCallPad(false);
      }
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const wrapMutation = useMutation({
    mutationFn: (chosen: Disposition) =>
      wrap({
        data: {
          callId: active?.id ?? "",
          disposition: chosen,
          ...(notes ? { notes } : {}),
          ...(callbackAt ? { callbackAt, callbackReason: chosen } : {}),
        },
      }),
    onSuccess: () => {
      toast.success("Outcome saved");
      setDisposition("");
      setNotes("");
      setCallbackAt("");
      setLiveNotes("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const callbackStatusMutation = useMutation({
    mutationFn: (input: { id: string; status: CallbackStatus }) =>
      patchCallback({ data: { id: input.id, status: input.status } }),
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error(e.message),
  });

  const simulateMutation = useMutation({
    mutationFn: () =>
      simulate({
        data: { phone: sim.phone, ...(sim.numberId !== "auto" ? { phoneNumberId: sim.numberId } : {}) },
      }),
    onSuccess: () => {
      toast.success("Inbound call placed in the queue");
      setSim((s) => ({ ...s, phone: "" }));
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const leadMutation = useMutation({
    mutationFn: () => nextLead({ data: { campaignId } }),
    onSuccess: (res) => {
      if (res.suppressed) {
        toast.warning(
          `${res.suppressed} DNC lead${res.suppressed === 1 ? "" : "s"} skipped and closed automatically`,
        );
        queryClient.invalidateQueries({ queryKey: ["dnc-blocked"] });
      }
      if (!res.task) {
        setLead(null);
        toast.info("No dialable leads left in this campaign right now");
        return;
      }
      setLead(res.task as never);
      toast.success(`Next lead: ${formatPhone(res.task.phone_e164)}`);
    },

    onError: (e: Error) => toast.error(e.message),
  });

  const answerCall = useCallback(
    (callId: string) => controlMutation.mutate({ callId, action: "answer" }),
    [controlMutation],
  );

  // auto-answer the longest waiter when the agent has it switched on
  const firstQueued = data?.queue?.[0]?.id ?? null;
  useEffect(() => {
    if (!autoAnswer || !ready || active || !firstQueued) return;
    answerCall(firstQueued);
    // answerCall identity changes with the mutation; guard by call id only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAnswer, ready, active, firstQueued]);

  const liveSeconds = useMemo(() => {
    if (!active) return 0;
    return secondsSince(active.answered_at ?? active.queued_at);
    // recompute on every heartbeat
  }, [active, desk.dataUpdatedAt]);

  const inWrap = active?.state === "wrap";
  const connected = active?.state === "connected" || active?.state === "hold";
  const stats = data?.stats;
  const connectRate = stats?.calls ? Math.round(((stats.connected ?? 0) / stats.calls) * 100) : 0;

  const wrapLeft = useMemo(() => {
    if (!inWrap) return WRAP_ALLOWANCE;
    return Math.max(0, WRAP_ALLOWANCE - secondsSince(active?.ended_at ?? active?.queued_at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inWrap, active, desk.dataUpdatedAt]);

  const callbacks = (data?.callbacks ?? []).filter((c) =>
    cbFilter === "open" ? c.status !== "Completed" && c.status !== "Cancelled" : c.status === cbFilter,
  );
  const history = (data?.today ?? []).filter((c) => {
    if (!search) return true;
    const q = search.replace(/\D/g, "");
    return q
      ? (c.phone_e164 ?? "").includes(q)
      : (c.contact_name ?? "").toLowerCase().includes(search.toLowerCase());
  });

  const sendTone = (t: string) => {
    if (sound) playDtmf(t);
    setTones((v) => (v + t).slice(-24));
  };

  const pressKey = useCallback(
    (k: string) => {
      if (sound) playDtmf(k);
      setDigits((d) => (d + k).slice(0, 20));
    },
    [sound],
  );

  const dialNow = useCallback(() => {
    if (digits.replace(/\D/g, "").length < 7 || dncBlocked || dialMutation.isPending) return;
    dialMutation.mutate({
      phone: digits,
      mode: "manual",
      ...(fromId !== "auto" ? { fromNumberId: fromId } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits, dncBlocked, fromId, dialMutation.isPending]);

  /* ------------------------------------------------------------------ hotkeys */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      const k = e.key;
      if (active) {
        if (k === "Escape") {
          e.preventDefault();
          controlMutation.mutate({ callId: active.id, action: "hangup" });
          return;
        }
        if (k === "Enter" && active.state === "ringing" && active.direction === "inbound") {
          e.preventDefault();
          answerCall(active.id);
          return;
        }
        if (!connected) return;
        if (k.toLowerCase() === "m") {
          e.preventDefault();
          controlMutation.mutate({ callId: active.id, action: active.muted ? "unmute" : "mute" });
        } else if (k.toLowerCase() === "h") {
          e.preventDefault();
          controlMutation.mutate({ callId: active.id, action: active.on_hold ? "resume" : "hold" });
        } else if (/^[0-9*#]$/.test(k)) {
          e.preventDefault();
          sendTone(k);
        }
        return;
      }
      if (/^[0-9*#]$/.test(k)) {
        e.preventDefault();
        pressKey(k);
      } else if (k === "Backspace") {
        e.preventDefault();
        setDigits((d) => d.slice(0, -1));
      } else if (k === "Enter") {
        e.preventDefault();
        const firstWaiting = data?.queue?.[0]?.id;
        if (firstWaiting && ready) answerCall(firstWaiting);
        else dialNow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, connected, ready, dialNow, pressKey, data?.queue?.[0]?.id]);

  /* --------------------------------------------------------- audio cues + flow */
  const waitingCount = data?.queue?.length ?? 0;
  useEffect(() => {
    if (!sound || !ready || active || waitingCount === 0) return undefined;
    playRing();
    const id = setInterval(() => playRing(), 4000);
    return () => clearInterval(id);
  }, [sound, ready, active, waitingCount]);

  const activeState = active?.state ?? null;
  useEffect(() => {
    if (!sound) return;
    if (activeState === "connected") playChirp(true);
    if (activeState === "wrap") playChirp(false);
  }, [activeState, sound]);

  // carry live notes into the wrap-up form the moment the call ends
  useEffect(() => {
    if (inWrap && liveNotes) setNotes((n) => (n ? n : liveNotes));
  }, [inWrap, liveNotes]);

  // keep the power dialer flowing when the agent asks for hands-free pacing
  useEffect(() => {
    if (!autoNext || active || !campaignId || lead || leadMutation.isPending) return;
    leadMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoNext, active, campaignId, lead]);

  const inSpeedDial = (phone: string) => speedDial.some((s) => s.phone === phone);
  const toggleSpeedDial = (phone: string, name?: string | null) => {
    if (!phone) return;
    if (inSpeedDial(phone)) {
      saveSpeedDial(speedDial.filter((s) => s.phone !== phone));
      toast.message("Removed from speed dial");
    } else {
      saveSpeedDial([{ phone, name: name ?? "" }, ...speedDial].slice(0, 12));
      toast.success("Saved to speed dial");
    }
  };

  const copyNumber = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Number copied");
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  const pasteNumber = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const cleaned = text.replace(/[^\d+*#]/g, "").slice(0, 20);
      if (!cleaned) {
        toast.error("No number on the clipboard");
        return;
      }
      setDigits(cleaned);
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  const activePhone = active?.phone_e164 ?? digits;
  const activeContactName = active?.contact_name ?? lead?.contact_name ?? null;


  return (
    <div className="space-y-3">
      {/* ------------------------------------------------------------ compact command bar */}
      <Card className="sticky top-0 z-20 rounded-xl border-border/70 bg-card/95 p-2.5 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {[
              {
                label: "Queue",
                value: stats?.waiting ?? 0,
                icon: PhoneIncoming,
                tone: "bg-success/15 text-success",
                live: (stats?.waiting ?? 0) > 0,
              },
              { label: "Calls", value: stats?.calls ?? 0, icon: PhoneCall, tone: "bg-brand/12 text-brand" },
              { label: "Connected", value: stats?.connected ?? 0, icon: Users, tone: "bg-info/15 text-info" },
              { label: "Talk", value: clock(stats?.talkSeconds ?? 0), icon: Timer, tone: "bg-warning/20 text-brand-tan" },
              { label: "Sales", value: stats?.sales ?? 0, icon: Rocket, tone: "bg-success/15 text-success" },
            ].map((s) => (
              <div key={s.label} className="flex h-8 items-center gap-1.5 rounded-full bg-surface/70 px-2.5 text-xs text-muted-foreground">
                <span className={cn("relative grid size-5 place-items-center rounded-full", s.tone)}>
                  <s.icon className="size-3.5" />
                  {s.live ? <span className="absolute -right-0.5 -top-0.5 size-1.5 animate-pulse rounded-full bg-success" /> : null}
                </span>
                <span>{s.label}</span>
                <strong className="font-semibold tabular-nums text-foreground">{s.value}</strong>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={deskTab === "lead" ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1.5 rounded-full"
              onClick={() => setDeskTab("lead")}
            >
              <ClipboardList className="size-3.5" /> Lead card
            </Button>
            <Button
              variant={leftPanel === "script" ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1.5 rounded-full"
              onClick={() => setLeftPanel((panel) => (panel === "script" ? "dialer" : "script"))}
            >
              {leftPanel === "script" ? <Phone className="size-3.5" /> : <BookOpenText className="size-3.5" />}
              {leftPanel === "script" ? "Show dialer" : "Agent script"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full"
              onClick={() => setDeskTab("queue")}
            >
              <PhoneIncoming className="size-3.5" /> Queue
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-full"
              title={sound ? "Mute desk audio" : "Enable desk audio"}
              aria-label={sound ? "Mute desk audio" : "Enable desk audio"}
              onClick={() => setSound((s) => !s)}
            >
              {sound ? <Bell className="size-3.5" /> : <BellOff className="size-3.5 text-muted-foreground" />}
            </Button>
            <label className="flex h-8 items-center gap-2 rounded-full bg-surface/70 px-2.5 text-xs font-medium">
              <Switch checked={ready} onCheckedChange={setReady} />
              Ready
            </label>
            <label className="flex h-8 items-center gap-2 rounded-full bg-surface/70 px-2.5 text-xs font-medium">
              <Switch checked={autoAnswer} onCheckedChange={setAutoAnswer} />
              Auto-answer
            </label>
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-full"
              title="Keyboard shortcuts"
              aria-label="Keyboard shortcuts"
              onClick={() => setShowShortcuts((v) => !v)}
            >
              <Keyboard className="size-3.5" />
            </Button>
            <div className="hidden min-w-[130px] md:block">
              <div className="mb-1 flex justify-between text-[0.65rem] text-muted-foreground">
                <span>Connect</span>
                <span className="tabular-nums">{connectRate}%</span>
              </div>
              <Progress value={connectRate} className="h-1.5" />
            </div>
          </div>
        </div>

        {showShortcuts ? (
          <div className="mt-2 flex flex-wrap gap-2 border-t border-border/60 pt-2">
            {SHORTCUTS.map((s) => (
              <span key={s.keys} className="flex items-center gap-1.5 rounded-full bg-surface/70 px-2.5 py-1 text-xs text-muted-foreground">
                <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-[0.65rem] text-foreground shadow-sm">{s.keys}</kbd>
                {s.label}
              </span>
            ))}
          </div>
        ) : null}
      </Card>

      <div
        className={cn(
          "grid min-h-[640px] gap-3",
          leftPanel === "script"
            ? "xl:grid-cols-[minmax(360px,0.95fr)_minmax(500px,1fr)]"
            : "xl:grid-cols-[minmax(320px,390px)_minmax(0,1fr)]",
        )}
      >
        {/* -------------------------------------------------------------- softphone */}
        {leftPanel === "script" ? (
          <ScriptReaderPanel
            compact
            className="min-h-[640px]"
            bodyHeightClassName="h-[calc(100vh-18rem)] min-h-[520px]"
            onClose={() => setLeftPanel("dialer")}
            closeLabel="Show dialer"
          />
        ) : (
        <Card className="rounded-xl p-3 shadow-card">
          <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-surface/60 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className={cn("grid size-8 place-items-center rounded-lg", ready ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                <Phone className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Dialer</p>
                <p className="truncate text-xs text-muted-foreground">
                  {data?.numbers?.length ?? 0} caller IDs · {speedDial.length} saved
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full" onClick={() => setLeftPanel("script")}>
              <BookOpenText className="size-3.5" /> Script
            </Button>
          </div>
          {active ? (
            <div className="space-y-4">
              <div
                className={cn(
                  "relative overflow-hidden rounded-2xl p-5 text-center",
                  inWrap
                    ? "bg-warning/15"
                    : active.on_hold
                      ? "bg-info/12"
                      : "bg-gradient-to-br from-brand/20 to-brand/5",
                )}
              >
                {connected && !active.on_hold ? (
                  <span className="absolute left-1/2 top-0 h-24 w-24 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-brand/20" />
                ) : null}
                <div className="relative">
                  <Badge variant="secondary" className="mb-2 capitalize">
                    {active.direction} · {active.state}
                    {active.muted ? " · muted" : ""}
                  </Badge>
                  <p className="font-display text-2xl font-semibold">{formatPhone(active.phone_e164)}</p>
                  <p className="text-sm text-muted-foreground">{active.contact_name ?? "Unknown caller"}</p>
                  <p className="mt-2 text-4xl font-semibold tabular-nums">{clock(liveSeconds)}</p>
                  {tones ? (
                    <p className="mt-1 text-xs tracking-widest text-muted-foreground">DTMF {tones}</p>
                  ) : null}

                  <div className="mt-3 flex items-center justify-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1 text-xs"
                      onClick={() => void copyNumber(active.phone_e164 ?? "")}
                    >
                      <Copy className="size-3.5" /> Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1 text-xs"
                      onClick={() => toggleSpeedDial(active.phone_e164 ?? "", active.contact_name)}
                    >
                      <Star
                        className={cn(
                          "size-3.5",
                          inSpeedDial(active.phone_e164 ?? "") && "fill-current text-warning",
                        )}
                      />
                      Speed dial
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1 text-xs"
                      onClick={() => openCallback(active.phone_e164, active.contact_name)}
                    >
                      <CalendarClock className="size-3.5" /> Set callback
                    </Button>
                    <CallScriptDialog
                      phone={active.phone_e164 ?? ""}
                      contactName={active.contact_name ?? null}
                      trigger={
                        <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs">
                          <BookOpenText className="size-3.5" /> Script
                        </Button>
                      }
                    />

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1 text-xs text-destructive"
                      onClick={() => openDnc(active.phone_e164, active.contact_name)}
                    >
                      <Ban className="size-3.5" /> DNC
                    </Button>

                  </div>
                </div>
              </div>



              {inWrap ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-border/60 bg-surface/50 p-3">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                        <Timer className="size-3.5" /> Wrap-up time
                      </span>
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          wrapLeft === 0 ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {wrapLeft === 0 ? "Overrun" : `${wrapLeft}s left`}
                      </span>
                    </div>
                    <Progress value={(wrapLeft / WRAP_ALLOWANCE) * 100} className="h-1.5" />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_DISPOSITIONS.map((d) => (
                      <Button
                        key={d}
                        size="sm"
                        variant={disposition === d ? "default" : "outline"}
                        className="rounded-full"
                        onClick={() => setDisposition(d)}
                      >
                        {d}
                      </Button>
                    ))}
                  </div>
                  <Select value={disposition} onValueChange={(v) => setDisposition(v as Disposition)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All outcomes…" />
                    </SelectTrigger>
                    <SelectContent>
                      {DISPOSITIONS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div>
                    <Label className="text-xs">Call notes</Label>
                    <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Schedule a callback (optional)</Label>
                    <Input
                      type="datetime-local"
                      value={callbackAt}
                      onChange={(e) => setCallbackAt(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      disabled={!disposition || wrapMutation.isPending}
                      onClick={() => wrapMutation.mutate(disposition as Disposition)}
                    >
                      Save outcome
                    </Button>
                    <Button
                      variant="outline"
                      className="text-destructive"
                      disabled={wrapMutation.isPending}
                      onClick={() => wrapMutation.mutate("DNC")}
                    >
                      <Ban className="mr-1 size-4" /> DNC
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {active.state === "ringing" && active.direction === "inbound" ? (
                    <Button className="h-12 w-full" onClick={() => answerCall(active.id)}>
                      <Phone className="mr-2 size-4" /> Answer
                    </Button>
                  ) : null}

                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      className="h-11"
                      disabled={!connected}
                      onClick={() =>
                        controlMutation.mutate({
                          callId: active.id,
                          action: active.on_hold ? "resume" : "hold",
                        })
                      }
                    >
                      {active.on_hold ? <Play className="mr-1 size-4" /> : <Pause className="mr-1 size-4" />}
                      {active.on_hold ? "Resume" : "Hold"}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11"
                      disabled={!connected}
                      onClick={() =>
                        controlMutation.mutate({
                          callId: active.id,
                          action: active.muted ? "unmute" : "mute",
                        })
                      }
                    >
                      {active.muted ? <MicOff className="mr-1 size-4" /> : <Mic className="mr-1 size-4" />}
                      {active.muted ? "Unmute" : "Mute"}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11"
                      disabled={!connected}
                      onClick={() => setShowInCallPad((v) => !v)}
                    >
                      <Grip className="mr-1 size-4" /> Keypad
                    </Button>
                  </div>

                  {showInCallPad ? (
                    <div className="grid grid-cols-3 gap-2 rounded-2xl bg-surface/60 p-2">
                      {KEYPAD.map((k) => (
                        <Button key={k.key} variant="ghost" className="h-10" onClick={() => sendTone(k.key)}>
                          {k.key}
                        </Button>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex gap-2">
                    <Input
                      placeholder="Transfer to extension or number"
                      value={transferTo}
                      onChange={(e) => setTransferTo(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      disabled={!connected || !transferTo}
                      onClick={() =>
                        controlMutation.mutate({ callId: active.id, action: "transfer", transferTo })
                      }
                    >
                      <PhoneForwarded className="size-4" />
                    </Button>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-surface/40 p-3">
                    <Label className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <StickyNote className="size-3.5" /> Live notes — carried into the outcome
                    </Label>
                    <Textarea
                      rows={3}
                      value={liveNotes}
                      onChange={(e) => setLiveNotes(e.target.value)}
                      placeholder="Type while you talk: needs, objections, next step…"
                    />
                  </div>


                  <Button
                    variant="destructive"
                    className="h-12 w-full"
                    onClick={() => controlMutation.mutate({ callId: active.id, action: "hangup" })}
                  >
                    <PhoneOff className="mr-2 size-4" /> End call
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-surface/60 p-3">
                <Input
                  value={digits}
                  onChange={(e) => setDigits(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") dialNow();
                  }}
                  placeholder="Enter a number"
                  className="h-12 border-0 bg-transparent text-center text-2xl font-semibold tracking-wider shadow-none focus-visible:ring-0"
                />
                {digits ? (
                  <p className="text-center text-xs text-muted-foreground">{formatPhone(digits)}</p>
                ) : (
                  <p className="text-center text-xs text-muted-foreground">
                    Type on your keyboard — the desk listens for digits
                  </p>
                )}
                {debouncedDigits.replace(/\D/g, "").length >= 7 ? (
                  <p
                    className={cn(
                      "mt-1 flex items-center justify-center gap-1.5 text-xs font-medium",
                      dncCheck.isFetching
                        ? "text-muted-foreground"
                        : dncBlocked
                          ? "text-destructive"
                          : "text-success",
                    )}
                  >
                    {dncCheck.isFetching ? (
                      <>Checking Do-Not-Call…</>
                    ) : dncBlocked ? (
                      <>
                        <ShieldOff className="size-3.5" /> On DNC — {dncEntry?.reason}
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="size-3.5" /> Cleared against DNC
                      </>
                    )}
                  </p>
                ) : null}

                <div className="mt-2 flex items-center justify-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs"
                    onClick={() => void pasteNumber()}
                  >
                    <ClipboardPaste className="size-3.5" /> Paste
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs"
                    disabled={!digits}
                    onClick={() => void copyNumber(digits)}
                  >
                    <Copy className="size-3.5" /> Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs"
                    disabled={digits.replace(/\D/g, "").length < 7}
                    onClick={() => toggleSpeedDial(digits)}
                  >
                    <Star
                      className={cn("size-3.5", inSpeedDial(digits) && "fill-current text-warning")}
                    />
                    {inSpeedDial(digits) ? "Saved" : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs"
                    disabled={!digits}
                    onClick={() => setDigits("")}
                  >
                    <Trash2 className="size-3.5" /> Clear
                  </Button>
                </div>
              </div>

              {dncBlocked ? (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <ShieldAlert className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    Dialing is blocked for compliance. Any attempt is logged in the audit trail.
                  </span>
                  <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                    <Link to="/dnc">Open DNC center</Link>
                  </Button>
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-2">
                {KEYPAD.map((k) => (
                  <Button
                    key={k.key}
                    variant="outline"
                    className="h-14 flex-col gap-0 rounded-2xl text-lg transition-transform active:scale-95"
                    onClick={() => pressKey(k.key)}
                  >
                    {k.key}
                    {k.sub ? (
                      <span className="text-[0.6rem] tracking-widest text-muted-foreground">{k.sub}</span>
                    ) : null}
                  </Button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Select value={fromId} onValueChange={setFromId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Caller ID" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automatic caller ID</SelectItem>
                    {(data?.numbers ?? []).map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.label} · {formatPhone(n.e164)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => setDigits((d) => d.slice(0, -1))}>
                  <Delete className="size-4" />
                </Button>
              </div>

              <Button
                className="h-12 w-full rounded-2xl"
                disabled={digits.length < 7 || dialMutation.isPending || dncBlocked}
                onClick={dialNow}
              >
                {dncBlocked ? (
                  <>
                    <ShieldOff className="mr-2 size-4" /> Blocked — on DNC
                  </>
                ) : (
                  <>
                    <PhoneCall className="mr-2 size-4" /> Call
                  </>
                )}
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => openCallback(digits)}>
                  <CalendarClock className="mr-2 size-4" /> Set callback
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive"
                  onClick={() => openDnc(digits)}
                >
                  <Ban className="mr-2 size-4" /> Add to DNC
                </Button>
                <CallScriptDialog
                  phone={digits}
                  contactName={lead?.contact_name ?? null}

                  trigger={
                    <Button variant="outline" className="col-span-2">
                      <BookOpenText className="mr-2 size-4" /> Open agent script
                    </Button>
                  }
                />
              </div>


              {speedDial.length ? (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Zap className="size-3.5" /> Speed dial
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {speedDial.map((s) => (
                      <span
                        key={s.phone}
                        className="group flex items-center gap-1 rounded-full bg-brand/12 py-0.5 pl-2.5 pr-1 text-xs text-brand"
                      >
                        <button className="font-medium" onClick={() => setDigits(s.phone)}>
                          {s.name || formatPhone(s.phone)}
                        </button>
                        <button
                          className="rounded-full p-1 text-muted-foreground hover:text-destructive"
                          aria-label="Remove from speed dial"
                          onClick={() => toggleSpeedDial(s.phone)}
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}



              {(data?.today ?? []).length ? (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Star className="size-3.5" /> Recent
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[...new Set((data?.today ?? []).map((c) => c.phone_e164).filter((p): p is string => Boolean(p)))]
                      .slice(0, 6)
                      .map((p) => (
                      <Button
                        key={p}
                        size="sm"
                        variant="secondary"
                        className="rounded-full text-xs"
                        onClick={() => setDigits(p)}
                      >
                        {formatPhone(p)}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </Card>
        )}

        {/* --------------------------------------------------------------- work area */}
        <Card className="min-h-[640px] overflow-hidden rounded-xl p-0 shadow-card">
          <Tabs value={deskTab} onValueChange={(value) => setDeskTab(value as DeskTab)}>
            <div className="sticky top-[4.25rem] z-10 border-b border-border/60 bg-card/95 px-3 py-2 backdrop-blur">
              <div className="flex items-center gap-2 overflow-x-auto">
                <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-full" aria-label="Scroll tools left">
                  <ArrowLeftRight className="size-3.5 rotate-180" />
                </Button>
                <TabsList className="h-10 justify-start gap-1 rounded-full bg-surface/70 p-1">
                <TabsTrigger value="lead" className="rounded-full px-3 data-[state=active]:bg-card data-[state=active]:text-brand">
                  <ClipboardList className="mr-1.5 size-4" /> Lead card
                </TabsTrigger>
                <TabsTrigger value="queue" className="rounded-full px-3 data-[state=active]:bg-card data-[state=active]:text-brand">
                  <PhoneIncoming className="mr-1.5 size-4" /> Queue
                  {(data?.queue.length ?? 0) > 0 ? (
                    <Badge variant="secondary" className="ml-2">
                      {data?.queue.length}
                    </Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="callbacks" className="rounded-full px-3 data-[state=active]:bg-card data-[state=active]:text-brand">
                  <CalendarClock className="mr-1.5 size-4" /> Callbacks
                </TabsTrigger>
                <TabsTrigger value="power" className="rounded-full px-3 data-[state=active]:bg-card data-[state=active]:text-brand">
                  <Gauge className="mr-1.5 size-4" /> Power dialer
                </TabsTrigger>
                <TabsTrigger value="history" className="rounded-full px-3 data-[state=active]:bg-card data-[state=active]:text-brand">
                  <History className="mr-1.5 size-4" /> Today
                </TabsTrigger>
                <TabsTrigger value="compliance" className="rounded-full px-3 data-[state=active]:bg-card data-[state=active]:text-brand">
                  <ShieldOff className="mr-1.5 size-4" /> DNC
                  {(blocked.data?.events.length ?? 0) > 0 ? (
                    <Badge variant="secondary" className="ml-2">
                      {blocked.data?.events.length}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              </TabsList>
                <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-full" aria-label="Scroll tools right">
                  <ArrowLeftRight className="size-3.5" />
                </Button>
              </div>
            </div>

            {/* ------------------------------------------------------------ lead card */}
            <TabsContent value="lead" className="m-0 p-4">
              <ScrollArea className="h-[calc(100vh-18rem)] min-h-[520px] pr-3">
                <LeadIntakePanel
                  phone={activePhone}
                  contactName={activeContactName}
                  onAddToDnc={(p: string, n: string | null) => openDnc(p, n)}
                />
              </ScrollArea>
            </TabsContent>


            {/* -------------------------------------------------------- inbound queue */}
            <TabsContent value="queue" className="m-0 p-4">
              <ScrollArea className="h-[340px] pr-3">
                {(data?.queue ?? []).length === 0 ? (
                  <div className="grid place-items-center gap-2 py-14 text-center">
                    <span className="grid size-12 place-items-center rounded-2xl bg-surface text-muted-foreground">
                      <Volume2 className="size-5" />
                    </span>
                    <p className="text-sm text-muted-foreground">
                      No callers waiting. Inbound calls appear here the moment they land.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(data?.queue ?? []).map((c, i) => {
                      const waited = secondsSince(c.queued_at);
                      return (
                        <div
                          key={c.id}
                          className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/40 p-3"
                        >
                          <span className="grid size-9 place-items-center rounded-full bg-success/15 text-success">
                            <PhoneIncoming className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {formatPhone(c.phone_e164)}
                              <span className="ml-2 text-xs text-muted-foreground">#{i + 1} in line</span>
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {c.contact_name ?? "Unknown"}
                              {c.to_number ? ` · on ${formatPhone(c.to_number)}` : ""}
                            </p>
                          </div>
                          <span className={cn("text-sm font-semibold tabular-nums", waitTone(waited))}>
                            {clock(waited)}
                          </span>
                          <Button size="sm" disabled={Boolean(active) || !ready} onClick={() => answerCall(c.id)}>
                            Answer
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              <Separator className="my-4" />
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Input
                  placeholder="Test caller number"
                  value={sim.phone}
                  onChange={(e) => setSim((s) => ({ ...s, phone: e.target.value }))}
                />
                <Select value={sim.numberId} onValueChange={(v) => setSim((s) => ({ ...s, numberId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Called number" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Any number</SelectItem>
                    {(data?.numbers ?? []).map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  disabled={sim.phone.length < 7 || simulateMutation.isPending}
                  onClick={() => simulateMutation.mutate()}
                >
                  <PhoneIncoming className="mr-2 size-4" /> Place test call
                </Button>
              </div>
            </TabsContent>

            {/* ------------------------------------------------------------ callbacks */}
            <TabsContent value="callbacks" className="m-0 p-4">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-surface/40 p-3">
                <span className="grid size-9 place-items-center rounded-full bg-brand/12 text-brand">
                  <CalendarClock className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Set a callback for any number</p>
                  <p className="text-xs text-muted-foreground">
                    Quick slots, reason presets and notes — it lands straight in the callback book.
                  </p>
                </div>
                <Button size="sm" onClick={() => openCallback(digits || active?.phone_e164 || "", active?.contact_name)}>
                  <PlusCircle className="mr-1.5 size-4" /> Set callback
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/callbacks">Callback book</Link>
                </Button>
              </div>


              <div className="mt-3 flex flex-wrap gap-1.5">
                {(["open", ...CALLBACK_STATUSES] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={cbFilter === s ? "default" : "outline"}
                    className="rounded-full text-xs"
                    onClick={() => setCbFilter(s as "open" | CallbackStatus)}
                  >
                    {s === "open" ? "Open" : s}
                  </Button>
                ))}
              </div>

              <ScrollArea className="mt-3 h-[280px] pr-3">
                {callbacks.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    Nothing here — booked callbacks show up with their status and due time.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {callbacks.map((c) => (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-surface/40 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {formatPhone(c.phone_e164)}{" "}
                            <span className="text-muted-foreground">{c.contact_name ?? ""}</span>
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {c.reason}
                            {c.scheduled_at
                              ? ` · ${new Date(c.scheduled_at).toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}`
                              : " · unscheduled"}
                            {c.attempts ? ` · ${c.attempts} attempts` : ""}
                          </p>
                        </div>
                        <Badge
                          className={cn(
                            "border-0",
                            CALLBACK_STATUS_TONE[(c.status as CallbackStatus) ?? "Pending"],
                          )}
                        >
                          {c.status}
                        </Badge>
                        <Select
                          value={c.status}
                          onValueChange={(v) =>
                            callbackStatusMutation.mutate({ id: c.id, status: v as CallbackStatus })
                          }
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CALLBACK_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          disabled={Boolean(active)}
                          onClick={() =>
                            dialMutation.mutate({
                              phone: c.phone_e164,
                              mode: "manual",
                              callbackId: c.id,
                              ...(c.contact_name ? { contactName: c.contact_name } : {}),
                            })
                          }
                        >
                          <Phone className="mr-1 size-4" /> Call
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* ---------------------------------------------------------- power dialer */}
            <TabsContent value="power" className="m-0 space-y-4 p-4">
              <div className="flex flex-wrap gap-2">
                <Select value={campaignId} onValueChange={setCampaignId}>
                  <SelectTrigger className="w-[260px]">
                    <SelectValue placeholder="Pick a campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {(data?.campaigns ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} · {c.mode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button disabled={!campaignId || leadMutation.isPending} onClick={() => leadMutation.mutate()}>
                  <ArrowLeftRight className="mr-2 size-4" /> Next lead
                </Button>
                {lead ? (
                  <Button
                    disabled={Boolean(active)}
                    onClick={() =>
                      dialMutation.mutate({
                        phone: lead.phone_e164,
                        mode: "power",
                        dialTaskId: lead.id,
                        campaignId,
                        ...(lead.contact_name ? { contactName: lead.contact_name } : {}),
                      })
                    }
                  >
                    <PhoneCall className="mr-2 size-4" /> Dial {formatPhone(lead.phone_e164)}
                  </Button>
                ) : null}
                <label className="ml-auto flex items-center gap-2 rounded-full border border-border/60 bg-surface/50 px-3 py-1.5 text-xs">
                  <Switch checked={autoNext} onCheckedChange={setAutoNext} />
                  Auto-load next lead
                </label>
              </div>


              <ScrollArea className="h-[300px] pr-3">
                {(data?.tasks ?? []).length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    No leads loaded. Operations can upload lists in Phone System → Campaigns.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(data?.tasks ?? []).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/40 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{formatPhone(t.phone_e164)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {t.contact_name ?? "Lead"} · {t.attempts} attempts
                            {t.last_outcome ? ` · ${t.last_outcome}` : ""}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={Boolean(active)}
                          onClick={() =>
                            dialMutation.mutate({
                              phone: t.phone_e164,
                              mode: "power",
                              dialTaskId: t.id,
                              ...(t.campaign_id ? { campaignId: t.campaign_id } : {}),
                              ...(t.contact_name ? { contactName: t.contact_name } : {}),
                            })
                          }
                        >
                          Dial
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* -------------------------------------------------------------- history */}
            <TabsContent value="history" className="m-0 p-4">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search today's calls"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <ScrollArea className="h-[340px] pr-3">
                {history.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No calls yet today.</p>
                ) : (
                  <div className="space-y-2">
                    {history.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/40 p-3"
                      >
                        <span className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground">
                          {c.direction === "inbound" ? (
                            <PhoneIncoming className="size-4" />
                          ) : (
                            <PhoneCall className="size-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {formatPhone(c.phone_e164)}{" "}
                            <span className="text-muted-foreground">{c.contact_name ?? ""}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(c.queued_at).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}{" "}
                            · {clock(c.talk_seconds ?? 0)} talk
                          </p>
                        </div>
                        {c.disposition ? (
                          <Badge className={cn("border-0", DISPOSITION_TONE[c.disposition] ?? "")}>
                            {c.disposition}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="capitalize">
                            {c.state}
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={Boolean(active)}
                          onClick={() => dialMutation.mutate({ phone: c.phone_e164 ?? "", mode: "manual" })}
                        >
                          <PhoneCall className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          title="Add to Do-Not-Call"
                          onClick={() => openDnc(c.phone_e164, c.contact_name)}
                        >
                          <Ban className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* ----------------------------------------------------------- compliance */}
            <TabsContent value="compliance" className="m-0 space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-surface/40 p-3">
                <span className="grid size-9 place-items-center rounded-full bg-destructive/12 text-destructive">
                  <ShieldOff className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {blocked.data?.totals.active ?? 0} numbers suppressed
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {blocked.data?.totals.blocked ?? 0} dial attempts blocked in the last 7 days
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => openDnc(digits || "")}>
                  <Ban className="mr-1.5 size-4" /> Add number
                </Button>
                <Button asChild size="sm">
                  <Link to="/dnc">Full DNC center</Link>
                </Button>
              </div>

              <ScrollArea className="h-[320px] pr-3">
                {(blocked.data?.events ?? []).length === 0 ? (
                  <div className="grid place-items-center gap-2 py-14 text-center">
                    <span className="grid size-12 place-items-center rounded-2xl bg-success/12 text-success">
                      <ShieldCheck className="size-5" />
                    </span>
                    <p className="text-sm text-muted-foreground">
                      No blocked dial attempts this week — the floor is staying compliant.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(blocked.data?.events ?? []).map((ev) => (
                      <div
                        key={ev.id}
                        className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-surface/40 p-3"
                      >
                        <Badge className={cn("border-0", DNC_ACTION_TONE[ev.action])}>
                          {DNC_ACTION_LABEL[ev.action] ?? ev.action}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium tabular-nums">{formatPhone(ev.phone_e164)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {ev.reason ?? "—"} · {ev.source}
                            {ev.actor_name ? ` · ${ev.actor_name}` : ""}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(ev.created_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      <CallbackDialog
        open={cbOpen}
        onOpenChange={setCbOpen}
        phone={cbTarget.phone}
        contactName={cbTarget.name}
        onSaved={refresh}
      />

      <AddToDncDialog
        open={dncOpen}
        onOpenChange={setDncOpen}
        phone={dncTarget.phone}
        contactName={dncTarget.name}
        source="agent-desk"
        onAdded={() => {
          refresh();
          queryClient.invalidateQueries({ queryKey: ["dnc-check"] });
        }}
      />
    </div>
  );
}

