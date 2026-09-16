import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  SEQUENCE_ANCHORS,
  fetchSequenceSteps,
  fetchTemplates,
  updateSequenceStep,
  updateTemplate,
} from "@/lib/onboarding";

const TIMING_OPTIONS = [
  { value: "0", label: "At the anchor time" },
  { value: "-2880", label: "2 days before" },
  { value: "-1440", label: "1 day before" },
  { value: "-120", label: "2 hours before" },
  { value: "-60", label: "1 hour before" },
  { value: "-15", label: "15 minutes before" },
  { value: "30", label: "30 minutes after" },
  { value: "60", label: "1 hour after" },
  { value: "1440", label: "1 day after" },
  { value: "2880", label: "2 days after" },
  { value: "4320", label: "3 days after" },
];

/**
 * Central editor for the hiring email sequence: when each email goes out and
 * exactly what it says. Every candidate follows this one sequence.
 */
export function EmailSequenceEditor() {
  const queryClient = useQueryClient();
  const stepsQuery = useQuery({ queryKey: ["onboarding-sequence-steps"], queryFn: fetchSequenceSteps });
  const templatesQuery = useQuery({ queryKey: ["onboarding-templates"], queryFn: fetchTemplates });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["onboarding-sequence-steps"] });
    void queryClient.invalidateQueries({ queryKey: ["onboarding-templates"] });
  };

  const saveStep = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      updateSequenceStep(id, patch as never),
    onSuccess: () => {
      toast.success("Timing updated for every candidate");
      refresh();
    },
    onError: () => toast.error("The timing could not be saved."),
  });

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div>
          <h2 className="font-display text-base font-bold tracking-tight">Sequence timing</h2>
          <p className="text-xs text-muted-foreground">
            These emails go out automatically for every candidate you add — no per-person setup.
          </p>
        </div>
        {(stepsQuery.data ?? []).map((step) => (
          <Card key={step.id} className="rounded-xl border-border/70 p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[11rem] flex-1">
                <p className="text-sm font-semibold">{step.name}</p>
                <p className="text-[0.68rem] text-muted-foreground">{step.template_key}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Timed from</Label>
                <Select
                  value={step.anchor}
                  onValueChange={(value) => saveStep.mutate({ id: step.id, patch: { anchor: value } })}
                >
                  <SelectTrigger className="w-[16rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEQUENCE_ANCHORS.map((anchor) => (
                      <SelectItem key={anchor.value} value={anchor.value}>
                        {anchor.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">When</Label>
                <Select
                  value={String(step.offset_minutes)}
                  onValueChange={(value) => saveStep.mutate({ id: step.id, patch: { offset_minutes: Number(value) } })}
                >
                  <SelectTrigger className="w-[12rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMING_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  checked={step.enabled}
                  onCheckedChange={(value) => saveStep.mutate({ id: step.id, patch: { enabled: value } })}
                />
                <span className="text-xs font-semibold">{step.enabled ? "On" : "Off"}</span>
              </div>
            </div>
          </Card>
        ))}
      </section>

      <section className="space-y-2">
        <div>
          <h2 className="font-display text-base font-bold tracking-tight">Email wording</h2>
          <p className="text-xs text-muted-foreground">
            Placeholders you can use: {"{{agent_first_name}}"}, {"{{interview_time}}"}, {"{{interview_link}}"},{" "}
            {"{{booking_link}}"}, {"{{onboarding_form_link}}"}, {"{{company_name}}"}.
          </p>
        </div>
        {(templatesQuery.data ?? []).map((template) => (
          <TemplateEditor
            key={template.template_key}
            templateKey={template.template_key}
            name={template.name}
            subject={template.subject}
            body={template.body}
            onSaved={refresh}
          />
        ))}
      </section>
    </div>
  );
}

function TemplateEditor({
  templateKey,
  name,
  subject,
  body,
  onSaved,
}: {
  templateKey: string;
  name: string;
  subject: string;
  body: string;
  onSaved: () => void;
}) {
  const [draftSubject, setDraftSubject] = useState(subject);
  const [draftBody, setDraftBody] = useState(body);

  useEffect(() => {
    setDraftSubject(subject);
    setDraftBody(body);
  }, [subject, body]);

  const save = useMutation({
    mutationFn: () => updateTemplate(templateKey, { subject: draftSubject, body: draftBody }),
    onSuccess: () => {
      toast.success("Email saved");
      onSaved();
    },
    onError: () => toast.error("The email could not be saved."),
  });

  const dirty = draftSubject !== subject || draftBody !== body;

  return (
    <Card className="rounded-xl border-border/70 p-3">
      <p className="text-sm font-semibold">{name}</p>
      <div className="mt-2 space-y-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Subject</Label>
          <Input value={draftSubject} onChange={(event) => setDraftSubject(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Message</Label>
          <Textarea rows={6} value={draftBody} onChange={(event) => setDraftBody(event.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button size="sm" variant="outline" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            <Save className="size-4" /> Save email
          </Button>
        </div>
      </div>
    </Card>
  );
}
