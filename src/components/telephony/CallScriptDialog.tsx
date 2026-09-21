/**
 * Read-only agent call script. The agent reads the script here and types lead
 * details manually in the lead intake panel — no capture fields inside the script.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpenText,
  Lock,
  OctagonAlert,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SCRIPT_INTERNAL_WHY, SCRIPT_PHASES, SCRIPT_RULES } from "@/lib/call-script";
import {
  SCRIPT_DOC_EVENT,
  deleteScriptDoc,
  loadScriptDoc,
  parseScriptFile,
  saveScriptDoc,
  type ScriptDoc,
} from "@/lib/script-library";
import { cn } from "@/lib/utils";

type ScriptReaderPanelProps = {
  className?: string;
  bodyHeightClassName?: string;
  compact?: boolean;
  onClose?: () => void;
  closeLabel?: string;
};

function ScriptHeader({
  doc,
  busy,
  compact,
  onUploadClick,
  onDelete,
  onClose,
  closeLabel,
}: {
  doc: ScriptDoc | null;
  busy: boolean;
  compact?: boolean | undefined;
  onUploadClick: () => void;
  onDelete: () => void;
  onClose?: (() => void) | undefined;
  closeLabel?: string | undefined;
}) {
  return (
    <div className={cn("border-b border-border/60 bg-surface/40", compact ? "p-3" : "p-4 text-center")}>
      <div className={cn("flex flex-wrap items-start gap-3", compact ? "justify-between" : "justify-center")}>
        <div className={cn("min-w-0", compact ? "text-left" : "text-center")}>
          <h2 className="font-display text-xl font-semibold tracking-tight text-brand">POLICY BEAR</h2>
          <p className="text-sm font-semibold text-brand-tan">Inbound Final Expense — Agent Call Script</p>
          <p className="truncate text-xs text-muted-foreground">
            {doc
              ? `Uploaded script · ${doc.name} · added ${new Date(doc.uploadedAt).toLocaleString()}`
              : "CEO Approved · Agent-Ready Version 1.3 · Follow in Order · Do Not Skip Compliance Flags"}
          </p>
        </div>

        {onClose ? (
          <Button type="button" size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={onClose}>
            {closeLabel ?? "Show dialer"}
          </Button>
        ) : null}
      </div>

      <div className={cn("mt-3 flex flex-wrap items-center gap-2", compact ? "justify-start" : "justify-center")}>
        <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={onUploadClick}>
          <Upload className="size-3.5" />
          {busy ? "Reading…" : doc ? "Replace script" : "Upload script"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 text-destructive hover:text-destructive"
          disabled={!doc}
          title={doc ? "Remove the uploaded script" : "No uploaded script yet"}
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" /> Delete
        </Button>
        <span className="text-[0.65rem] text-muted-foreground">.docx, .txt or .md</span>
      </div>
    </div>
  );
}

function UploadedScriptContent({
  doc,
  bodyHeightClassName,
  idPrefix,
}: {
  doc: ScriptDoc;
  bodyHeightClassName: string;
  idPrefix: string;
}) {
  const headings = doc.blocks.map((b, i) => ({ ...b, i })).filter((b) => b.kind === "heading");

  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-[220px_1fr]", bodyHeightClassName)}>
      <aside className="hidden min-h-0 border-r border-border/60 bg-surface/30 lg:block">
        <ScrollArea className="h-full p-2">
          <div className="space-y-1">
            {headings.map((h) => (
              <Button
                key={`${h.i}-${h.text}`}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  document.getElementById(`${idPrefix}-doc-${h.i}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="h-auto w-full justify-start truncate px-3 py-2 text-left text-xs text-muted-foreground"
              >
                <span className="truncate">{h.text}</span>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <ScrollArea className="h-full">
        <div className="space-y-2.5 p-5">
          {doc.blocks.map((b, i) =>
            b.kind === "heading" ? (
              <p
                key={`${i}-${b.text}`}
                id={`${idPrefix}-doc-${i}`}
                className="pt-3 font-display text-base font-semibold uppercase tracking-[0.06em] text-brand"
              >
                {b.text}
              </p>
            ) : b.kind === "bullet" ? (
              <p key={`${i}-${b.text}`} id={`${idPrefix}-doc-${i}`} className="flex gap-2 pl-1 text-xs text-muted-foreground">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-border" />
                {b.text}
              </p>
            ) : (
              <p key={`${i}-${b.text}`} id={`${idPrefix}-doc-${i}`} className="rounded-lg border border-brand/20 bg-brand/5 p-2.5 text-sm">
                {b.text}
              </p>
            ),
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function BuiltInScriptContent({
  active,
  setActive,
  bodyHeightClassName,
  idPrefix,
}: {
  active: string;
  setActive: (id: string) => void;
  bodyHeightClassName: string;
  idPrefix: string;
}) {
  const goTo = (id: string) => {
    setActive(id);
    document.getElementById(`${idPrefix}-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-[220px_1fr]", bodyHeightClassName)}>
      <aside className="hidden min-h-0 border-r border-border/60 bg-surface/30 lg:block">
        <ScrollArea className="h-full p-2">
          <div className="space-y-1">
            {SCRIPT_PHASES.map((p) => (
              <Button
                key={p.id}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => goTo(p.id)}
                className={cn(
                  "h-auto w-full justify-start truncate px-3 py-2 text-left text-xs",
                  p.id === active ? "bg-brand/12 font-semibold text-brand" : "text-muted-foreground",
                )}
              >
                <span className="truncate">{p.title}</span>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <ScrollArea className="h-full">
        <div className="space-y-5 p-5">
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-destructive">
              <ShieldAlert className="size-3.5" /> Two strict company rules — follow exactly
            </p>
            <ul className="mt-2 space-y-1.5 text-xs text-foreground">
              {SCRIPT_RULES.map((r) => (
                <li key={r} className="flex gap-2">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-destructive" />
                  {r}
                </li>
              ))}
            </ul>
          </div>

          <p className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <span className="font-semibold">Why this payment rule exists — internal note.</span> {SCRIPT_INTERNAL_WHY}
            </span>
          </p>

          {SCRIPT_PHASES.map((phase) => (
            <section key={phase.id} id={`${idPrefix}-${phase.id}`} className="space-y-3">
              <div>
                <p className="font-display text-base font-semibold uppercase tracking-[0.06em] text-brand">{phase.title}</p>
                {phase.subtitle ? <p className="text-xs italic text-muted-foreground">{phase.subtitle}</p> : null}
              </div>
              <Separator />

              {phase.steps.map((step) => (
                <div key={step.id} className="space-y-2">
                  {step.stop ? (
                    <p className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs font-medium">
                      <OctagonAlert className="mt-0.5 size-3.5 shrink-0 text-brand-tan" />
                      {step.stop}
                    </p>
                  ) : null}

                  {(step.say ?? []).map((line) => (
                    <p key={line} className="rounded-lg border border-brand/25 bg-brand/8 p-2.5 text-sm italic">
                      <Badge variant="secondary" className="mr-2 align-middle text-[0.6rem]">
                        SAY
                      </Badge>
                      {line}
                    </p>
                  ))}

                  {step.bullets?.length ? (
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {step.bullets.map((b) => (
                        <li key={b} className="flex gap-2">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-border" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {step.note ? <p className="rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">{step.note}</p> : null}

                  {step.internal ? (
                    <p className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2 text-xs">
                      <Badge variant="secondary" className="h-4 shrink-0 text-[0.6rem]">
                        INTERNAL
                      </Badge>
                      {step.internal}
                    </p>
                  ) : null}
                </div>
              ))}
            </section>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function ScriptReaderPanel({
  className,
  bodyHeightClassName = "h-[76vh]",
  compact,
  onClose,
  closeLabel,
}: ScriptReaderPanelProps) {
  const [active, setActive] = useState(SCRIPT_PHASES[0]?.id ?? "");
  const [doc, setDoc] = useState<ScriptDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const idPrefix = compact ? "desk-script" : "script-phase";

  useEffect(() => {
    const sync = () => setDoc(loadScriptDoc());
    sync();
    window.addEventListener(SCRIPT_DOC_EVENT, sync);
    return () => window.removeEventListener(SCRIPT_DOC_EVENT, sync);
  }, []);

  const onUpload = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const parsed = await parseScriptFile(file);
      saveScriptDoc(parsed);
      toast.success(`Script uploaded — ${parsed.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that file.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onDelete = () => {
    deleteScriptDoc();
    toast.success("Uploaded script removed — showing the built-in script.");
  };

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border/60 bg-card shadow-card", className)}>
      <input
        ref={fileRef}
        type="file"
        accept=".docx,.txt,.md,text/plain,text/markdown"
        className="hidden"
        onChange={(e) => void onUpload(e.target.files?.[0])}
      />
      <ScriptHeader
        doc={doc}
        busy={busy}
        compact={compact}
        onUploadClick={() => fileRef.current?.click()}
        onDelete={onDelete}
        onClose={onClose}
        closeLabel={closeLabel}
      />
      {doc ? (
        <UploadedScriptContent doc={doc} bodyHeightClassName={bodyHeightClassName} idPrefix={idPrefix} />
      ) : (
        <BuiltInScriptContent
          active={active}
          setActive={setActive}
          bodyHeightClassName={bodyHeightClassName}
          idPrefix={idPrefix}
        />
      )}
    </div>
  );
}

export function CallScriptDialog({
  trigger,
  className,
}: {
  trigger?: ReactNode;
  className?: string;
  /** kept for call-site compatibility; the script itself is read-only */
  phone?: string;
  contactName?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className={cn("gap-2", className)}>
            <BookOpenText className="size-4" /> Agent script
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-6xl gap-0 overflow-hidden p-0">
        <ScriptReaderPanel className="rounded-none border-0 shadow-none" />
      </DialogContent>
    </Dialog>
  );
}
