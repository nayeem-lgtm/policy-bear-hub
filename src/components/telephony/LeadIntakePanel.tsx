/**
 * Lead card for the agent desk — everything an agent types while on a call.
 * Saved per phone number in the browser so an agent can leave and come back.
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  BadgeCheck,
  HeartHandshake,
  Mail,
  MessageSquare,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  StickyNote,
  TriangleAlert,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatPhone } from "@/lib/phone";
import { LEAD_CARD_EVENT, loadLeadCard, saveLeadCard } from "@/lib/lead-card";
import { LEAD_FIELD_NAMES, LEAD_SECTIONS, leadFieldOptions } from "@/lib/lead-fields";

import { cn } from "@/lib/utils";

const SECTION_STYLE: Record<string, { icon: typeof User; tone: string }> = {
  contact: { icon: User, tone: "bg-brand/10 text-brand" },
  policy: { icon: BadgeCheck, tone: "bg-warning/20 text-brand-tan" },
  compliance: { icon: ShieldCheck, tone: "bg-success/15 text-success" },
  retention: { icon: HeartHandshake, tone: "bg-info/15 text-info" },
  crosssell: { icon: Sparkles, tone: "bg-brand-cyan/20 text-brand" },
  chargeback: { icon: TriangleAlert, tone: "bg-destructive/12 text-destructive" },
  internal: { icon: StickyNote, tone: "bg-muted text-muted-foreground" },
};

const SECTIONS = LEAD_SECTIONS.map((s) => ({
  ...s,
  icon: SECTION_STYLE[s.id]?.icon ?? User,
  tone: SECTION_STYLE[s.id]?.tone ?? "bg-muted text-muted-foreground",
}));

const ALL_FIELDS = LEAD_FIELD_NAMES;


export function LeadIntakePanel({
  phone,
  contactName,
  onAddToDnc,
}: {
  phone: string;
  contactName?: string | null;
  onAddToDnc?: (phone: string, name: string | null) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => loadLeadCard(phone));
  const [dirty, setDirty] = useState(false);
  const [sms, setSms] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  useEffect(() => {
    setValues(loadLeadCard(phone));
    setDirty(false);
  }, [phone]);

  // the guided script writes into the same record — mirror those edits live
  useEffect(() => {
    const handler = () => {
      setValues(loadLeadCard(phone));
      setDirty(false);
    };
    window.addEventListener(LEAD_CARD_EVENT, handler as EventListener);
    return () => window.removeEventListener(LEAD_CARD_EVENT, handler as EventListener);
  }, [phone]);

  useEffect(() => {
    if (!values["fullName"] && contactName) {
      setValues((v) => ({ ...v, fullName: contactName }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactName]);

  const filled = useMemo(
    () => ALL_FIELDS.filter((f) => (values[f] ?? "").trim().length > 0).length,
    [values],
  );

  const set = (name: string, value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    setDirty(true);
  };

  const save = () => {
    saveLeadCard(phone, values);
    setDirty(false);
    toast.success("Lead card saved", {
      description: `${filled} field(s) stored for ${phone ? formatPhone(phone) : "this lead"} · synced to Customers.`,
    });
  };

  const reset = () => {
    setValues({});
    saveLeadCard(phone, {});
    setDirty(false);
    toast("Lead card cleared");
  };

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-surface/50 p-3">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold">
            {values["fullName"] || contactName || "New lead"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {phone ? formatPhone(phone) : "No number selected"} · {filled} of {ALL_FIELDS.length} fields
            captured
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty ? <Badge variant="secondary">Unsaved</Badge> : null}
          <Button variant="ghost" className="gap-1.5" onClick={reset}>
            <RotateCcw className="size-4" /> Clear
          </Button>
          <Button className="gap-1.5" onClick={save}>
            <Save className="size-4" /> Save lead
          </Button>
        </div>
      </div>

      {/* sections */}
      <div className="space-y-4">
        {SECTIONS.map((s) => (
          <section key={s.id} className="rounded-2xl border border-border/60 p-3">
            <div className="flex items-center gap-2">
              <span className={cn("grid size-8 place-items-center rounded-xl", s.tone)}>
                <s.icon className="size-4" />
              </span>
              <p className="text-sm font-semibold">{s.title}</p>
            </div>
            <Separator className="my-3" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {s.fields.map((f) => (
                <div
                  key={f.name}
                  className={cn("space-y-1.5", f.kind === "area" && "sm:col-span-2 lg:col-span-3")}
                >
                  <Label htmlFor={`lead-${f.name}`} className="text-xs text-muted-foreground">
                    {f.label}
                  </Label>
                  {f.kind === "select" ? (
                    <Select
                      value={values[f.name] ?? ""}
                      onValueChange={(v) => set(f.name, v === "__clear" ? "" : v)}
                    >
                      <SelectTrigger id={`lead-${f.name}`}>
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {leadFieldOptions(f).map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                        {values[f.name] ? (
                          <SelectItem value="__clear" className="text-muted-foreground">
                            Clear selection
                          </SelectItem>
                        ) : null}
                      </SelectContent>
                    </Select>
                  ) : f.kind === "toggle" ? (
                    <div className="flex h-9 items-center gap-2 rounded-md border border-border/60 px-3">
                      <Switch
                        id={`lead-${f.name}`}
                        checked={values[f.name] === "Yes"}
                        onCheckedChange={(on) => set(f.name, on ? "Yes" : "No")}
                      />
                      <span className="text-xs text-muted-foreground">
                        {values[f.name] === "Yes" ? "ON" : "OFF"}
                      </span>
                    </div>
                  ) : f.kind === "area" ? (
                    <Textarea
                      id={`lead-${f.name}`}
                      rows={3}
                      value={values[f.name] ?? ""}
                      placeholder={f.placeholder}
                      onChange={(e) => set(f.name, e.target.value)}
                    />
                  ) : f.kind === "yesno" ? (
                    <div className="flex gap-1.5">
                      {["Yes", "No"].map((opt) => (
                        <Button
                          key={opt}
                          type="button"
                          size="sm"
                          variant={values[f.name] === opt ? "default" : "outline"}
                          className="flex-1 rounded-full"
                          onClick={() => set(f.name, values[f.name] === opt ? "" : opt)}
                        >
                          {opt}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <Input
                      id={`lead-${f.name}`}
                      type={f.kind === "date" ? "date" : f.kind === "number" ? "number" : "text"}
                      value={values[f.name] ?? ""}
                      placeholder={f.placeholder}
                      onChange={(e) => set(f.name, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>

            {s.id === "internal" ? (
              <Button
                variant="outline"
                className="mt-3 gap-1.5 text-destructive"
                onClick={() => onAddToDnc?.(phone, values["fullName"] || contactName || null)}
              >
                <Ban className="size-4" /> Add this number to DNC
              </Button>
            ) : null}
          </section>
        ))}
      </div>

      {/* quick outreach */}
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/60 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquare className="size-4 text-brand" /> SMS
          </p>
          <Separator className="my-3" />
          <Textarea
            rows={3}
            value={sms}
            placeholder={phone ? `Text ${formatPhone(phone)}…` : "Select a number first"}
            onChange={(e) => setSms(e.target.value)}
          />
          <Button
            className="mt-2 w-full"
            disabled={!phone || !sms.trim()}
            onClick={() => {
              toast.success("SMS queued", { description: formatPhone(phone) });
              setSms("");
            }}
          >
            Send SMS
          </Button>
        </section>
        <section className="rounded-2xl border border-border/60 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Mail className="size-4 text-info" /> Email
          </p>
          <Separator className="my-3" />
          <Input
            className="mb-2"
            value={emailSubject}
            placeholder="Subject"
            onChange={(e) => setEmailSubject(e.target.value)}
          />
          <Textarea
            rows={3}
            value={emailBody}
            placeholder={values["email"] ? `Email ${values["email"]}…` : "Add an email on the lead card"}
            onChange={(e) => setEmailBody(e.target.value)}
          />
          <Button
            className="mt-2 w-full"
            disabled={!values["email"] || !emailBody.trim()}
            onClick={() => {
              toast.success("Email queued", { description: values["email"] });
              setEmailBody("");
              setEmailSubject("");
            }}
          >
            Send email
          </Button>
        </section>
      </div>
    </div>
  );
}
