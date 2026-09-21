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
  FileCheck2,
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
  Send,
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { quotePlans } from "@/lib/mock-data";
import { currency, unique } from "@/lib/use-filters";

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

type DeskTab = "lead" | "script" | "quotes" | "queue" | "callbacks" | "power" | "history" | "compliance";

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
  const [deskTab, setDeskTab] = useState<DeskTab>("lead");
  const [quoteZip, setQuoteZip] = useState("77042");
  const [quoteIncome, setQuoteIncome] = useState("38400");
  const [quoteAge, setQuoteAge] = useState("34");
  const [quoteTobacco, setQuoteTobacco] = useState(false);
  const [quoteCarrierFilter, setQuoteCarrierFilter] = useState("all");
  const [quoteMetalFilter, setQuoteMetalFilter] = useState("all");
  const [quoteSort, setQuoteSort] = useState("premium-asc");
  const [quoteCompare, setQuoteCompare] = useState<string[]>([]);

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
  const quoteCarriers = unique(quotePlans, (p) => p.carrier);
  const quoteMetals = unique(quotePlans, (p) => p.metal);
  const quoteSubsidy = useMemo(() => {
    const income = Number(quoteIncome) || 0;
    const ageAdjustment = Math.max(0, (Number(quoteAge) || 0) - 35) * 4;
    const tobaccoAdjustment = quoteTobacco ? 70 : 0;
    return Math.max(0, Math.round(420 - income / 200 + ageAdjustment - tobaccoAdjustment));
  }, [quoteAge, quoteIncome, quoteTobacco]);
  const quoteResults = useMemo(() => {
    const rows = quotePlans.filter(
      (p) =>
        (quoteCarrierFilter === "all" || p.carrier === quoteCarrierFilter) &&
        (quoteMetalFilter === "all" || p.metal === quoteMetalFilter),
    );
    return [...rows].sort((a, b) => {
      if (quoteSort === "premium-asc") return a.subsidizedPremium - b.subsidizedPremium;
      if (quoteSort === "premium-desc") return b.subsidizedPremium - a.subsidizedPremium;
      if (quoteSort === "deductible-asc") return a.deductible - b.deductible;
      if (quoteSort === "rating-desc") return b.rating - a.rating;
      return 0;
    });
  }, [quoteCarrierFilter, quoteMetalFilter, quoteSort]);
  const toggleQuoteCompare = (id: string) => {
    setQuoteCompare((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current,
    );
  };


  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4 text-foreground">
      <Card className="overflow-hidden rounded-2xl border-border/70 bg-card shadow-raised">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/60 bg-surface/35 px-4 py-3 sm:flex sm:flex-wrap sm:justify-between lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className={cn("relative grid size-11 shrink-0 place-items-center rounded-xl", active ? "bg-success/15 text-success" : ready ? "bg-brand-teal/15 text-brand-teal" : "bg-muted text-muted-foreground")}>
              <Phone className="size-5" />
              {ready ? <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-success ring-2 ring-card" /> : null}
            </span>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="truncate font-display text-xl font-semibold text-foreground sm:text-2xl">
                  {activeContactName ?? lead?.contact_name ?? "Active Agent Desk"}
                </h1>
                <Badge className="border-0 bg-success/12 text-success">{active ? "Verified call" : ready ? "Ready" : "Paused"}</Badge>
                <Badge className="border-0 bg-brand-orange/12 text-brand-orange">High intent</Badge>
              </div>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="tabular">{activePhone ? formatPhone(activePhone) : "No active caller"}</span>
                <span className="size-1 rounded-full bg-border" />
                <span>Policy Bear agent cockpit</span>
                <span className="size-1 rounded-full bg-border" />
                <span className="font-semibold text-brand-teal">{active ? `${active.direction} · ${active.state}` : "Standing by"}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <div className="hidden rounded-xl border border-border/60 bg-card px-3 py-2 text-right sm:block">
              <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">Call Duration</p>
              <p className="font-display text-lg font-semibold text-brand-orange tabular-nums">{active ? clock(liveSeconds) : clock(stats?.talkSeconds ?? 0)}</p>
            </div>
            <Button
              variant={deskTab === "lead" ? "default" : "outline"}
              size="sm"
              className="h-9 gap-1.5 rounded-xl"
              onClick={() => setDeskTab("lead")}
            >
              <ClipboardList className="size-4" /> Lead
            </Button>
            <Button
              variant={deskTab === "script" ? "default" : "outline"}
              size="sm"
              className="h-9 gap-1.5 rounded-xl"
              onClick={() => setDeskTab("script")}
            >
              <BookOpenText className="size-4" /> Script
            </Button>
            <Button
              variant={deskTab === "quotes" ? "default" : "outline"}
              size="sm"
              className="h-9 gap-1.5 rounded-xl"
              onClick={() => setDeskTab("quotes")}
            >
              <Star className="size-4" /> Quotes
            </Button>
            <CallScriptDialog
              phone={activePhone}
              contactName={activeContactName}
              trigger={
                <Button variant="outline" size="icon" className="size-9 rounded-xl" aria-label="Pop out agent script" title="Pop out agent script">
                  <BookOpenText className="size-4" />
                </Button>
              }
            />
            <Button
              variant="outline"
              size="icon"
              className="size-9 rounded-xl"
              title={sound ? "Mute desk audio" : "Enable desk audio"}
              aria-label={sound ? "Mute desk audio" : "Enable desk audio"}
              onClick={() => setSound((s) => !s)}
            >
              {sound ? <Bell className="size-4" /> : <BellOff className="size-4 text-muted-foreground" />}
            </Button>
            {active ? (
              <Button
                variant="destructive"
                size="sm"
                className="h-9 rounded-xl"
                onClick={() => controlMutation.mutate({ callId: active.id, action: "hangup" })}
              >
                <PhoneOff className="mr-1.5 size-4" /> End
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-3 lg:grid-cols-6 lg:px-6">
          {[
            { label: "Queue", value: stats?.waiting ?? 0, icon: PhoneIncoming, tone: "bg-success/15 text-success", live: (stats?.waiting ?? 0) > 0 },
            { label: "Calls", value: stats?.calls ?? 0, icon: PhoneCall, tone: "bg-brand/12 text-brand" },
            { label: "Connected", value: stats?.connected ?? 0, icon: Users, tone: "bg-info/15 text-info" },
            { label: "Talk", value: clock(stats?.talkSeconds ?? 0), icon: Timer, tone: "bg-warning/20 text-brand-tan" },
            { label: "Sales", value: stats?.sales ?? 0, icon: Rocket, tone: "bg-success/15 text-success" },
            { label: "Connect", value: `${connectRate}%`, icon: Signal, tone: "bg-brand-teal/15 text-brand-teal" },
          ].map((s) => (
            <div key={s.label} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 shadow-sm">
              <span className={cn("relative grid size-9 shrink-0 place-items-center rounded-lg", s.tone)}>
                <s.icon className="size-4" />
                {s.live ? <span className="absolute -right-0.5 -top-0.5 size-2 animate-pulse rounded-full bg-success" /> : null}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">{s.label}</p>
                <p className="truncate font-display text-lg font-semibold text-foreground tabular-nums">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {showShortcuts ? (
        <Card className="rounded-2xl border-border/70 bg-card p-3 shadow-card">
          <div className="flex flex-wrap gap-2">
            {SHORTCUTS.map((s) => (
              <span key={s.keys} className="flex items-center gap-1.5 rounded-full bg-surface/70 px-2.5 py-1 text-xs text-muted-foreground">
                <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-[0.65rem] text-foreground shadow-sm">{s.keys}</kbd>
                {s.label}
              </span>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid min-h-[720px] gap-4 xl:grid-cols-[minmax(220px,280px)_minmax(0,1fr)_minmax(320px,390px)]">
        <aside className="space-y-4">
          <Card className="overflow-hidden rounded-2xl border-border/70 bg-card shadow-card">
            <div className="border-b border-border/60 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">Live Queue</p>
                  <h2 className="font-display text-base font-semibold">Inbound floor</h2>
                </div>
                <Badge className="border-0 bg-success/12 text-success">{data?.queue.length ?? 0} waiting</Badge>
              </div>
            </div>
            <ScrollArea className="h-[250px]">
              <div className="space-y-2 p-3">
                {(data?.queue ?? []).length === 0 ? (
                  <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-border bg-surface/45 py-8 text-center">
                    <Volume2 className="size-5 text-muted-foreground" />
                    <p className="max-w-[12rem] text-xs text-muted-foreground">No callers waiting. New inbound calls appear here instantly.</p>
                  </div>
                ) : (
                  (data?.queue ?? []).slice(0, 4).map((c, i) => {
                    const waited = secondsSince(c.queued_at);
                    return (
                      <div key={c.id} className="rounded-xl border border-border/60 bg-surface/40 p-3">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{c.contact_name ?? formatPhone(c.phone_e164)}</p>
                            <p className="truncate text-xs text-muted-foreground">#{i + 1} in line {c.to_number ? `· ${formatPhone(c.to_number)}` : ""}</p>
                          </div>
                          <span className={cn("text-xs font-semibold tabular-nums", waitTone(waited))}>{clock(waited)}</span>
                        </div>
                        <Button className="mt-2 h-8 w-full rounded-lg" size="sm" disabled={Boolean(active) || !ready} onClick={() => answerCall(c.id)}>
                          Answer
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
            <div className="border-t border-border/60 p-3">
              <Button variant="outline" size="sm" className="w-full rounded-lg" onClick={() => setDeskTab("queue")}>
                Queue manager
              </Button>
            </div>
          </Card>

          <Card className="rounded-2xl border-border/70 bg-card p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">Agent Status</p>
                <h2 className="font-display text-base font-semibold">Floor controls</h2>
              </div>
              <Button variant="outline" size="icon" className="size-8 rounded-lg" onClick={() => setShowShortcuts((v) => !v)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts">
                <Keyboard className="size-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <label className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border/60 bg-surface/45 px-3 py-2 text-sm font-medium">
                <span className="min-w-0 truncate">Ready to receive</span>
                <Switch checked={ready} onCheckedChange={setReady} />
              </label>
              <label className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border/60 bg-surface/45 px-3 py-2 text-sm font-medium">
                <span className="min-w-0 truncate">Auto-answer queue</span>
                <Switch checked={autoAnswer} onCheckedChange={setAutoAnswer} />
              </label>
              <label className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border/60 bg-surface/45 px-3 py-2 text-sm font-medium">
                <span className="min-w-0 truncate">Auto-load leads</span>
                <Switch checked={autoNext} onCheckedChange={setAutoNext} />
              </label>
            </div>
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">
                <span>Connect rate</span>
                <span className="tabular-nums">{connectRate}%</span>
              </div>
              <Progress value={connectRate} className="h-2" />
            </div>
          </Card>

          <Card className="rounded-2xl border-border/70 bg-card p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">Callbacks</p>
                <h2 className="font-display text-base font-semibold">Follow-ups</h2>
              </div>
              <Badge variant="secondary">{callbacks.length}</Badge>
            </div>
            <div className="space-y-2">
              {callbacks.slice(0, 3).length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-surface/45 p-3 text-xs text-muted-foreground">No open callbacks right now.</p>
              ) : (
                callbacks.slice(0, 3).map((c) => (
                  <button key={c.id} type="button" className="w-full rounded-xl border border-border/60 bg-surface/35 p-3 text-left transition-colors hover:bg-surface" onClick={() => setDeskTab("callbacks")}>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <span className="truncate text-sm font-semibold">{c.contact_name ?? formatPhone(c.phone_e164)}</span>
                      <Badge className={cn("border-0", CALLBACK_STATUS_TONE[(c.status as CallbackStatus) ?? "Pending"])}>{c.status}</Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{c.reason}</p>
                  </button>
                ))
              )}
            </div>
            <Button className="mt-3 w-full rounded-lg" size="sm" variant="outline" onClick={() => openCallback(digits || active?.phone_e164 || "", active?.contact_name)}>
              <PlusCircle className="mr-1.5 size-4" /> New callback
            </Button>
          </Card>
        </aside>

        <Card className="min-w-0 overflow-hidden rounded-2xl border-border/70 bg-card shadow-card">
          <Tabs value={deskTab} onValueChange={(value) => setDeskTab(value as DeskTab)}>
            <div className="border-b border-border/60 bg-card px-4 py-3">
              <div className="overflow-x-auto pb-1">
                <TabsList className="h-11 min-w-max justify-start gap-1 rounded-xl bg-surface/70 p-1">
                  <TabsTrigger value="lead" className="rounded-lg px-3 data-[state=active]:bg-card data-[state=active]:text-brand-teal">
                    <ClipboardList className="mr-1.5 size-4" /> Lead Card
                  </TabsTrigger>
                  <TabsTrigger value="script" className="rounded-lg px-3 data-[state=active]:bg-card data-[state=active]:text-brand-teal">
                    <BookOpenText className="mr-1.5 size-4" /> Dynamic Script
                  </TabsTrigger>
                  <TabsTrigger value="quotes" className="rounded-lg px-3 data-[state=active]:bg-card data-[state=active]:text-brand-teal">
                    <Star className="mr-1.5 size-4" /> Quotes & Rates
                  </TabsTrigger>
                  <TabsTrigger value="history" className="rounded-lg px-3 data-[state=active]:bg-card data-[state=active]:text-brand-teal">
                    <History className="mr-1.5 size-4" /> Customer History
                  </TabsTrigger>
                  <TabsTrigger value="queue" className="rounded-lg px-3 data-[state=active]:bg-card data-[state=active]:text-brand-teal">
                    <PhoneIncoming className="mr-1.5 size-4" /> Queue
                  </TabsTrigger>
                  <TabsTrigger value="callbacks" className="rounded-lg px-3 data-[state=active]:bg-card data-[state=active]:text-brand-teal">
                    <CalendarClock className="mr-1.5 size-4" /> Callbacks
                  </TabsTrigger>
                  <TabsTrigger value="power" className="rounded-lg px-3 data-[state=active]:bg-card data-[state=active]:text-brand-teal">
                    <Gauge className="mr-1.5 size-4" /> Power
                  </TabsTrigger>
                  <TabsTrigger value="compliance" className="rounded-lg px-3 data-[state=active]:bg-card data-[state=active]:text-brand-teal">
                    <ShieldOff className="mr-1.5 size-4" /> DNC
                    {(blocked.data?.events.length ?? 0) > 0 ? <Badge variant="secondary" className="ml-2">{blocked.data?.events.length}</Badge> : null}
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            <TabsContent value="lead" className="m-0 p-4">
              <ScrollArea className="h-[calc(100vh-17rem)] min-h-[570px] pr-3">
                <LeadIntakePanel
                  phone={activePhone}
                  contactName={activeContactName}
                  onAddToDnc={(p: string, n: string | null) => openDnc(p, n)}
                />
              </ScrollArea>
            </TabsContent>

            <TabsContent value="script" className="m-0 p-4">
              <ScriptReaderPanel
                compact
                className="overflow-hidden rounded-xl border border-border/60 shadow-none"
                bodyHeightClassName="h-[calc(100vh-17rem)] min-h-[570px]"
              />
            </TabsContent>

            <TabsContent value="quotes" className="m-0 p-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(250px,310px)_minmax(0,1fr)]">
                <div className="space-y-3 rounded-xl border border-border/60 bg-surface/45 p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-display text-base font-semibold text-foreground">Applicant intake</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {activeContactName ?? "New applicant"}{activePhone ? ` · ${formatPhone(activePhone)}` : ""}
                      </p>
                    </div>
                    <Badge variant="secondary">{quoteCompare.length}/3</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <div className="space-y-1.5">
                      <Label htmlFor="quote-zip">ZIP code</Label>
                      <Input id="quote-zip" value={quoteZip} onChange={(e) => setQuoteZip(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="quote-income">Annual household income</Label>
                      <Input id="quote-income" value={quoteIncome} onChange={(e) => setQuoteIncome(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="quote-age">Applicant age</Label>
                      <Input id="quote-age" value={quoteAge} onChange={(e) => setQuoteAge(e.target.value)} />
                    </div>
                    <label className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">Tobacco use</span>
                      <Switch checked={quoteTobacco} onCheckedChange={setQuoteTobacco} />
                    </label>
                  </div>
                  <div className="rounded-xl border border-brand-teal/25 bg-brand-teal/5 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-brand-teal">Estimated monthly subsidy</p>
                    <p className="mt-1 font-display text-2xl font-semibold text-foreground">{currency(quoteSubsidy)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Based on ZIP {quoteZip || "—"} and current applicant details.</p>
                  </div>
                  <Button className="w-full gap-1.5 rounded-xl" disabled={quoteCompare.length < 2}>
                    <FileCheck2 className="size-4" /> Compare selected
                  </Button>
                </div>

                <div className="min-w-0 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Select value={quoteCarrierFilter} onValueChange={setQuoteCarrierFilter}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Carrier" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All carriers</SelectItem>
                        {quoteCarriers.map((carrier) => <SelectItem key={carrier} value={carrier}>{carrier}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={quoteMetalFilter} onValueChange={setQuoteMetalFilter}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Metal level" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All metal levels</SelectItem>
                        {quoteMetals.map((metal) => <SelectItem key={metal} value={metal}>{metal}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={quoteSort} onValueChange={setQuoteSort}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Sort" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="premium-asc">Premium: low to high</SelectItem>
                        <SelectItem value="premium-desc">Premium: high to low</SelectItem>
                        <SelectItem value="deductible-asc">Deductible: low to high</SelectItem>
                        <SelectItem value="rating-desc">Rating: high to low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <ScrollArea className="h-[calc(100vh-21rem)] min-h-[470px] pr-3">
                    <div className="space-y-2">
                      {quoteResults.map((plan) => (
                        <div key={plan.id} className="rounded-xl border border-border/60 bg-card p-3 shadow-sm transition-colors hover:border-brand-teal/35">
                          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
                            <Checkbox
                              checked={quoteCompare.includes(plan.id)}
                              onCheckedChange={() => toggleQuoteCompare(plan.id)}
                              className="mt-1"
                              aria-label={`Compare ${plan.planName}`}
                            />
                            <div className="min-w-0">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-semibold text-foreground">{plan.planName}</p>
                                <Badge variant="outline">{plan.metal}</Badge>
                                <Badge variant="outline">{plan.type}</Badge>
                                {plan.hsaEligible ? <Badge variant="outline">HSA</Badge> : null}
                              </div>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">{plan.carrier} · {plan.network} network</p>
                              <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                                <span><span className="text-muted-foreground">Deductible</span><br /><strong>{currency(plan.deductible)}</strong></span>
                                <span><span className="text-muted-foreground">MOOP</span><br /><strong>{currency(plan.oopMax)}</strong></span>
                                <span><span className="text-muted-foreground">PCP</span><br /><strong>{currency(plan.pcpCopay)}</strong></span>
                                <span><span className="text-muted-foreground">Rx</span><br /><strong>{currency(plan.genericRx)}</strong></span>
                              </div>
                            </div>
                            <div className="col-span-2 text-left lg:col-span-1 lg:text-right">
                              <p className="font-display text-2xl font-semibold text-foreground">{currency(plan.subsidizedPremium)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                              <p className="text-xs text-muted-foreground line-through">{currency(plan.premium)}/mo</p>
                              <div className="mt-2 flex justify-start gap-1.5 lg:justify-end">
                                <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg"><Send className="size-3.5" /> Send</Button>
                                <Button size="sm" className="h-8 gap-1.5 rounded-lg"><FileCheck2 className="size-3.5" /> Apply</Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="queue" className="m-0 p-4">
              <ScrollArea className="h-[360px] pr-3">
                {(data?.queue ?? []).length === 0 ? (
                  <div className="grid place-items-center gap-2 py-14 text-center">
                    <span className="grid size-12 place-items-center rounded-xl bg-surface text-muted-foreground">
                      <Volume2 className="size-5" />
                    </span>
                    <p className="text-sm text-muted-foreground">No callers waiting. Inbound calls appear here the moment they land.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(data?.queue ?? []).map((c, i) => {
                      const waited = secondsSince(c.queued_at);
                      return (
                        <div key={c.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/60 bg-surface/40 p-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
                            <PhoneIncoming className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{formatPhone(c.phone_e164)} <span className="text-xs text-muted-foreground">#{i + 1} in line</span></p>
                            <p className="truncate text-xs text-muted-foreground">{c.contact_name ?? "Unknown"}{c.to_number ? ` · on ${formatPhone(c.to_number)}` : ""}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className={cn("text-sm font-semibold tabular-nums", waitTone(waited))}>{clock(waited)}</span>
                            <Button size="sm" disabled={Boolean(active) || !ready} onClick={() => answerCall(c.id)}>Answer</Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
              <Separator className="my-4" />
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Input placeholder="Test caller number" value={sim.phone} onChange={(e) => setSim((s) => ({ ...s, phone: e.target.value }))} />
                <Select value={sim.numberId} onValueChange={(v) => setSim((s) => ({ ...s, numberId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Called number" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Any number</SelectItem>
                    {(data?.numbers ?? []).map((n) => <SelectItem key={n.id} value={n.id}>{n.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" disabled={sim.phone.length < 7 || simulateMutation.isPending} onClick={() => simulateMutation.mutate()}>
                  <PhoneIncoming className="mr-2 size-4" /> Place test call
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="callbacks" className="m-0 p-4">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/60 bg-surface/40 p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/12 text-brand">
                  <CalendarClock className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">Set a callback for any number</p>
                  <p className="truncate text-xs text-muted-foreground">Quick slots, reason presets and notes — it lands straight in the callback book.</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => openCallback(digits || active?.phone_e164 || "", active?.contact_name)}><PlusCircle className="mr-1.5 size-4" /> Set</Button>
                  <Button asChild size="sm" variant="outline"><Link to="/callbacks">Book</Link></Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(["open", ...CALLBACK_STATUSES] as const).map((s) => (
                  <Button key={s} size="sm" variant={cbFilter === s ? "default" : "outline"} className="rounded-full text-xs" onClick={() => setCbFilter(s as "open" | CallbackStatus)}>
                    {s === "open" ? "Open" : s}
                  </Button>
                ))}
              </div>
              <ScrollArea className="mt-3 h-[350px] pr-3">
                {callbacks.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">Nothing here — booked callbacks show up with their status and due time.</p>
                ) : (
                  <div className="space-y-2">
                    {callbacks.map((c) => (
                      <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/60 bg-surface/40 p-3 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{formatPhone(c.phone_e164)} <span className="text-muted-foreground">{c.contact_name ?? ""}</span></p>
                          <p className="truncate text-xs text-muted-foreground">
                            {c.reason}{c.scheduled_at ? ` · ${new Date(c.scheduled_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : " · unscheduled"}{c.attempts ? ` · ${c.attempts} attempts` : ""}
                          </p>
                        </div>
                        <Badge className={cn("border-0", CALLBACK_STATUS_TONE[(c.status as CallbackStatus) ?? "Pending"])}>{c.status}</Badge>
                        <Select value={c.status} onValueChange={(v) => callbackStatusMutation.mutate({ id: c.id, status: v as CallbackStatus })}>
                          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{CALLBACK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button size="sm" disabled={Boolean(active)} onClick={() => dialMutation.mutate({ phone: c.phone_e164, mode: "manual", callbackId: c.id, ...(c.contact_name ? { contactName: c.contact_name } : {}) })}>
                          <Phone className="mr-1 size-4" /> Call
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="power" className="m-0 space-y-4 p-4">
              <div className="grid gap-2 lg:grid-cols-[minmax(0,260px)_auto_auto]">
                <Select value={campaignId} onValueChange={setCampaignId}>
                  <SelectTrigger><SelectValue placeholder="Pick a campaign" /></SelectTrigger>
                  <SelectContent>{(data?.campaigns ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · {c.mode}</SelectItem>)}</SelectContent>
                </Select>
                <Button disabled={!campaignId || leadMutation.isPending} onClick={() => leadMutation.mutate()}><ArrowLeftRight className="mr-2 size-4" /> Next lead</Button>
                {lead ? (
                  <Button disabled={Boolean(active)} onClick={() => dialMutation.mutate({ phone: lead.phone_e164, mode: "power", dialTaskId: lead.id, campaignId, ...(lead.contact_name ? { contactName: lead.contact_name } : {}) })}>
                    <PhoneCall className="mr-2 size-4" /> Dial {formatPhone(lead.phone_e164)}
                  </Button>
                ) : null}
              </div>
              <ScrollArea className="h-[380px] pr-3">
                {(data?.tasks ?? []).length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No leads loaded. Operations can upload lists in Phone System → Campaigns.</p>
                ) : (
                  <div className="space-y-2">
                    {(data?.tasks ?? []).map((t) => (
                      <div key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/60 bg-surface/40 p-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{formatPhone(t.phone_e164)}</p>
                          <p className="truncate text-xs text-muted-foreground">{t.contact_name ?? "Lead"} · {t.attempts} attempts{t.last_outcome ? ` · ${t.last_outcome}` : ""}</p>
                        </div>
                        <Button size="sm" variant="outline" disabled={Boolean(active)} onClick={() => dialMutation.mutate({ phone: t.phone_e164, mode: "power", dialTaskId: t.id, ...(t.campaign_id ? { campaignId: t.campaign_id } : {}), ...(t.contact_name ? { contactName: t.contact_name } : {}) })}>Dial</Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="history" className="m-0 p-4">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search today's calls" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <ScrollArea className="h-[430px] pr-3">
                {history.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No calls yet today.</p>
                ) : (
                  <div className="space-y-2">
                    {history.map((c) => (
                      <div key={c.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl border border-border/60 bg-surface/40 p-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">{c.direction === "inbound" ? <PhoneIncoming className="size-4" /> : <PhoneCall className="size-4" />}</span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{formatPhone(c.phone_e164)} <span className="text-muted-foreground">{c.contact_name ?? ""}</span></p>
                          <p className="text-xs text-muted-foreground">{new Date(c.queued_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {clock(c.talk_seconds ?? 0)} talk</p>
                        </div>
                        {c.disposition ? <Badge className={cn("border-0", DISPOSITION_TONE[c.disposition] ?? "")}>{c.disposition}</Badge> : <Badge variant="outline" className="capitalize">{c.state}</Badge>}
                        <div className="flex shrink-0 gap-1">
                          <Button size="sm" variant="ghost" disabled={Boolean(active)} onClick={() => dialMutation.mutate({ phone: c.phone_e164 ?? "", mode: "manual" })}><PhoneCall className="size-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-destructive" title="Add to Do-Not-Call" onClick={() => openDnc(c.phone_e164, c.contact_name)}><Ban className="size-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="compliance" className="m-0 space-y-3 p-4">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/60 bg-surface/40 p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-destructive/12 text-destructive"><ShieldOff className="size-4" /></span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{blocked.data?.totals.active ?? 0} numbers suppressed</p>
                  <p className="truncate text-xs text-muted-foreground">{blocked.data?.totals.blocked ?? 0} dial attempts blocked in the last 7 days</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => openDnc(digits || "")}><Ban className="mr-1.5 size-4" /> Add</Button>
                  <Button asChild size="sm"><Link to="/dnc">DNC center</Link></Button>
                </div>
              </div>
              <ScrollArea className="h-[430px] pr-3">
                {(blocked.data?.events ?? []).length === 0 ? (
                  <div className="grid place-items-center gap-2 py-14 text-center">
                    <span className="grid size-12 place-items-center rounded-xl bg-success/12 text-success"><ShieldCheck className="size-5" /></span>
                    <p className="text-sm text-muted-foreground">No blocked dial attempts this week — the floor is staying compliant.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(blocked.data?.events ?? []).map((ev) => (
                      <div key={ev.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/60 bg-surface/40 p-3">
                        <Badge className={cn("border-0", DNC_ACTION_TONE[ev.action])}>{DNC_ACTION_LABEL[ev.action] ?? ev.action}</Badge>
                        <div className="min-w-0">
                          <p className="truncate font-medium tabular-nums">{formatPhone(ev.phone_e164)}</p>
                          <p className="truncate text-xs text-muted-foreground">{ev.reason ?? "—"} · {ev.source}{ev.actor_name ? ` · ${ev.actor_name}` : ""}</p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">{new Date(ev.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </Card>

        <aside className="space-y-4">
          <Card className="overflow-hidden rounded-2xl border-brand-ink/80 bg-brand-ink text-brand-ink-foreground shadow-raised">
            <div className="border-b border-brand-ink-foreground/10 p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="min-w-0">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-brand-ink-foreground/55">Professional Softphone</p>
                  <p className="truncate font-display text-lg font-semibold">{active ? formatPhone(active.phone_e164) : digits ? formatPhone(digits) : "Ready to dial"}</p>
                </div>
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", active ? "bg-brand-orange text-primary-foreground" : "bg-success text-success-foreground")}>
                  {active ? <Signal className="size-5" /> : <Phone className="size-5" />}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-brand-ink-foreground/60">{active?.contact_name ?? lead?.contact_name ?? "Manual, inbound, and power dial supported"}</p>
            </div>

            {active ? (
              <div className="space-y-4 p-4">
                <div className="rounded-xl bg-brand-ink-foreground/10 p-4 text-center">
                  <Badge className="mb-2 border-0 bg-brand-ink-foreground/10 text-brand-ink-foreground capitalize">{active.direction} · {active.state}{active.muted ? " · muted" : ""}</Badge>
                  <p className="font-display text-4xl font-semibold tabular-nums">{clock(liveSeconds)}</p>
                  {tones ? <p className="mt-1 text-xs tracking-widest text-brand-ink-foreground/55">DTMF {tones}</p> : null}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" className="h-11 border-brand-ink-foreground/15 bg-brand-ink-foreground/10 text-brand-ink-foreground hover:bg-brand-ink-foreground/15" disabled={!connected} onClick={() => controlMutation.mutate({ callId: active.id, action: active.on_hold ? "resume" : "hold" })}>
                    {active.on_hold ? <Play className="mr-1 size-4" /> : <Pause className="mr-1 size-4" />}{active.on_hold ? "Resume" : "Hold"}
                  </Button>
                  <Button variant="outline" className="h-11 border-brand-ink-foreground/15 bg-brand-ink-foreground/10 text-brand-ink-foreground hover:bg-brand-ink-foreground/15" disabled={!connected} onClick={() => controlMutation.mutate({ callId: active.id, action: active.muted ? "unmute" : "mute" })}>
                    {active.muted ? <MicOff className="mr-1 size-4" /> : <Mic className="mr-1 size-4" />}{active.muted ? "Unmute" : "Mute"}
                  </Button>
                  <Button variant="outline" className="h-11 border-brand-ink-foreground/15 bg-brand-ink-foreground/10 text-brand-ink-foreground hover:bg-brand-ink-foreground/15" disabled={!connected} onClick={() => setShowInCallPad((v) => !v)}>
                    <Grip className="mr-1 size-4" /> Pad
                  </Button>
                </div>
                {showInCallPad ? (
                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-brand-ink-foreground/10 p-2">
                    {KEYPAD.map((k) => <Button key={k.key} variant="ghost" className="h-10 text-brand-ink-foreground hover:bg-brand-ink-foreground/10" onClick={() => sendTone(k.key)}>{k.key}</Button>)}
                  </div>
                ) : null}
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <Input className="border-brand-ink-foreground/15 bg-brand-ink-foreground/10 text-brand-ink-foreground placeholder:text-brand-ink-foreground/45" placeholder="Transfer extension or number" value={transferTo} onChange={(e) => setTransferTo(e.target.value)} />
                  <Button variant="outline" className="border-brand-ink-foreground/15 bg-brand-ink-foreground/10 text-brand-ink-foreground hover:bg-brand-ink-foreground/15" disabled={!connected || !transferTo} onClick={() => controlMutation.mutate({ callId: active.id, action: "transfer", transferTo })}>
                    <PhoneForwarded className="size-4" />
                  </Button>
                </div>
                {active.state === "ringing" && active.direction === "inbound" ? <Button className="h-12 w-full rounded-xl bg-success text-success-foreground hover:bg-success/90" onClick={() => answerCall(active.id)}><Phone className="mr-2 size-4" /> Answer</Button> : null}
                <Button variant="destructive" className="h-12 w-full rounded-xl" onClick={() => controlMutation.mutate({ callId: active.id, action: "hangup" })}>
                  <PhoneOff className="mr-2 size-4" /> End interaction
                </Button>
              </div>
            ) : (
              <div className="space-y-4 p-4">
                <div className="rounded-xl border border-brand-ink-foreground/10 bg-brand-ink-foreground/10 p-3">
                  <Input
                    value={digits}
                    onChange={(e) => setDigits(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") dialNow(); }}
                    placeholder="Enter a number"
                    className="h-12 border-0 bg-transparent text-center font-display text-2xl font-semibold tracking-wider text-brand-ink-foreground shadow-none placeholder:text-brand-ink-foreground/45 focus-visible:ring-0"
                  />
                  {digits ? <p className="text-center text-xs text-brand-ink-foreground/60">{formatPhone(digits)}</p> : <p className="text-center text-xs text-brand-ink-foreground/60">Type numbers here or use your keyboard</p>}
                  {debouncedDigits.replace(/\D/g, "").length >= 7 ? (
                    <div className={cn("mt-2 flex items-center justify-center gap-1.5 text-xs font-medium", dncCheck.isFetching ? "text-brand-ink-foreground/60" : dncBlocked ? "text-destructive" : "text-success")}>
                      {dncCheck.isFetching ? <>Checking Do-Not-Call…</> : dncBlocked ? <><ShieldOff className="size-3.5" /> On DNC — {dncEntry?.reason}</> : <><ShieldCheck className="size-3.5" /> Cleared against DNC</>}
                    </div>
                  ) : null}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {KEYPAD.map((k) => (
                    <Button key={k.key} variant="ghost" className="h-14 flex-col gap-0 rounded-xl bg-brand-ink-foreground/10 font-display text-lg text-brand-ink-foreground transition-transform hover:bg-brand-ink-foreground/15 active:scale-95" onClick={() => pressKey(k.key)}>
                      {k.key}{k.sub ? <span className="text-[0.6rem] tracking-widest text-brand-ink-foreground/50">{k.sub}</span> : null}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <Select value={fromId} onValueChange={setFromId}>
                    <SelectTrigger className="border-brand-ink-foreground/15 bg-brand-ink-foreground/10 text-brand-ink-foreground"><SelectValue placeholder="Caller ID" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automatic caller ID</SelectItem>
                      {(data?.numbers ?? []).map((n) => <SelectItem key={n.id} value={n.id}>{n.label} · {formatPhone(n.e164)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="text-brand-ink-foreground hover:bg-brand-ink-foreground/10" onClick={() => setDigits((d) => d.slice(0, -1))}><Delete className="size-4" /></Button>
                </div>
                <Button className="h-12 w-full rounded-xl bg-success text-success-foreground hover:bg-success/90" disabled={digits.length < 7 || dialMutation.isPending || dncBlocked} onClick={dialNow}>
                  {dncBlocked ? <><ShieldOff className="mr-2 size-4" /> Blocked — on DNC</> : <><PhoneCall className="mr-2 size-4" /> Start call</>}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="border-brand-ink-foreground/15 bg-brand-ink-foreground/10 text-brand-ink-foreground hover:bg-brand-ink-foreground/15" onClick={() => void pasteNumber()}><ClipboardPaste className="mr-1.5 size-4" /> Paste</Button>
                  <Button variant="outline" className="border-brand-ink-foreground/15 bg-brand-ink-foreground/10 text-brand-ink-foreground hover:bg-brand-ink-foreground/15" disabled={!digits} onClick={() => setDigits("")}><Trash2 className="mr-1.5 size-4" /> Clear</Button>
                  <Button variant="outline" className="border-brand-ink-foreground/15 bg-brand-ink-foreground/10 text-brand-ink-foreground hover:bg-brand-ink-foreground/15" disabled={!digits} onClick={() => void copyNumber(digits)}><Copy className="mr-1.5 size-4" /> Copy</Button>
                  <Button variant="outline" className="border-brand-ink-foreground/15 bg-brand-ink-foreground/10 text-brand-ink-foreground hover:bg-brand-ink-foreground/15" disabled={digits.replace(/\D/g, "").length < 7} onClick={() => toggleSpeedDial(digits)}><Star className={cn("mr-1.5 size-4", inSpeedDial(digits) && "fill-current text-warning")} /> {inSpeedDial(digits) ? "Saved" : "Save"}</Button>
                </div>
                {dncBlocked ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    <div className="flex gap-2"><ShieldAlert className="size-4 shrink-0" /><span>Dialing is blocked for compliance. Any attempt is logged.</span></div>
                    <Button asChild size="sm" variant="outline" className="mt-2 h-8 w-full"><Link to="/dnc">Open DNC center</Link></Button>
                  </div>
                ) : null}
              </div>
            )}
          </Card>

          <Card className="rounded-2xl border-border/70 bg-card shadow-card">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 p-4">
              <div className="min-w-0">
                <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">Call Outcome</p>
                <h2 className="truncate font-display text-base font-semibold">Disposition notes</h2>
              </div>
              <Badge variant="outline">{inWrap ? "Wrap-up" : "Drafting"}</Badge>
            </div>
            <div className="space-y-3 p-4">
              {inWrap ? (
                <div className="rounded-xl border border-warning/40 bg-warning/10 p-3">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-muted-foreground"><Timer className="size-3.5" /> Wrap-up time</span>
                    <span className={cn("font-semibold tabular-nums", wrapLeft === 0 ? "text-destructive" : "text-foreground")}>{wrapLeft === 0 ? "Overrun" : `${wrapLeft}s left`}</span>
                  </div>
                  <Progress value={(wrapLeft / WRAP_ALLOWANCE) * 100} className="h-1.5" />
                </div>
              ) : null}
              <div className="flex flex-wrap gap-1.5">
                {QUICK_DISPOSITIONS.map((d) => (
                  <Button key={d} size="sm" variant={disposition === d ? "default" : "outline"} className="rounded-full text-xs" onClick={() => setDisposition(d)}>{d}</Button>
                ))}
              </div>
              <Select value={disposition} onValueChange={(v) => setDisposition(v as Disposition)}>
                <SelectTrigger><SelectValue placeholder="All outcomes…" /></SelectTrigger>
                <SelectContent>{DISPOSITIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
              <div className="space-y-1.5">
                <Label className="text-xs">Call notes</Label>
                <Textarea rows={5} value={inWrap ? notes : liveNotes} onChange={(e) => inWrap ? setNotes(e.target.value) : setLiveNotes(e.target.value)} placeholder="Enter detailed call notes, objections, needs, and next step…" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Schedule a callback</Label>
                <Input type="datetime-local" value={callbackAt} onChange={(e) => setCallbackAt(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="rounded-xl" onClick={() => openCallback(digits || active?.phone_e164 || "", active?.contact_name)}>
                  <CalendarClock className="mr-1.5 size-4" /> Follow-up
                </Button>
                <Button className="rounded-xl" disabled={!active || !disposition || wrapMutation.isPending} onClick={() => wrapMutation.mutate(disposition as Disposition)}>
                  Submit outcome
                </Button>
              </div>
              {speedDial.length ? (
                <div className="border-t border-border/60 pt-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Zap className="size-3.5" /> Speed dial</p>
                  <div className="flex flex-wrap gap-1.5">
                    {speedDial.map((s) => (
                      <span key={s.phone} className="group flex items-center gap-1 rounded-full bg-brand/12 py-0.5 pl-2.5 pr-1 text-xs text-brand">
                        <button type="button" className="font-medium" onClick={() => setDigits(s.phone)}>{s.name || formatPhone(s.phone)}</button>
                        <button type="button" className="rounded-full p-1 text-muted-foreground hover:text-destructive" aria-label="Remove from speed dial" onClick={() => toggleSpeedDial(s.phone)}><Trash2 className="size-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        </aside>
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

