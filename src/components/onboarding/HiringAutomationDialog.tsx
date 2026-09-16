import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarRange, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getHiringAutomation, saveHiringAutomation } from "@/lib/interview-booking.functions";

const DURATIONS = [15, 30, 45, 60];
const TIMEZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"];

/**
 * One interview window and one set of email switches shared by every candidate,
 * so interviews and the onboarding form no longer need per-candidate setup.
 */
export function HiringAutomationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const load = useServerFn(getHiringAutomation);
  const save = useServerFn(saveHiringAutomation);

  const settingsQuery = useQuery({
    queryKey: ["hiring-automation"],
    queryFn: () => load({ data: undefined as never }),
    enabled: open,
  });

  const [daysAhead, setDaysAhead] = useState(14);
  const [dailyStart, setDailyStart] = useState("09:00");
  const [dailyEnd, setDailyEnd] = useState("17:00");
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [timezone, setTimezone] = useState("America/New_York");
  const [meetingLink, setMeetingLink] = useState("");
  const [autoInterview, setAutoInterview] = useState(true);
  const [autoForm, setAutoForm] = useState(true);

  useEffect(() => {
    const row = settingsQuery.data;
    if (!row) return;
    setDaysAhead(row.interview_days_ahead);
    setDailyStart(row.daily_start.slice(0, 5));
    setDailyEnd(row.daily_end.slice(0, 5));
    setSlotMinutes(row.slot_minutes);
    setTimezone(row.timezone);
    setMeetingLink(row.meeting_link ?? "");
    setAutoInterview(row.auto_interview_invite);
    setAutoForm(row.auto_form_invite);
  }, [settingsQuery.data]);

  const submit = useMutation({
    mutationFn: () =>
      save({
        data: {
          interviewDaysAhead: daysAhead,
          dailyStart,
          dailyEnd,
          slotMinutes,
          timezone,
          meetingLink,
          autoInterviewInvite: autoInterview,
          autoFormInvite: autoForm,
        },
      }),
    onSuccess: () => {
      toast.success("Saved — this applies to every candidate");
      void queryClient.invalidateQueries({ queryKey: ["hiring-automation"] });
      void queryClient.invalidateQueries({ queryKey: ["candidate-interview-availability"] });
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Those settings could not be saved."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Interview & email automation</DialogTitle>
          <DialogDescription>
            Set your availability and invites once. Every candidate you add gets their own booking link and the same
            automated emails — no per-person setup.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <CalendarRange className="size-4 text-primary" /> Interview availability
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Bookable days ahead</Label>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={daysAhead}
                  onChange={(event) => setDaysAhead(Number(event.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs">Interview length</Label>
                <Select value={String(slotMinutes)} onValueChange={(value) => setSlotMinutes(Number(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {value} minutes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Available from</Label>
                <Input type="time" value={dailyStart} onChange={(event) => setDailyStart(event.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Available until</Label>
                <Input type="time" value={dailyEnd} onChange={(event) => setDailyEnd(event.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value.replace("America/", "")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Meeting link</Label>
                <Input
                  type="url"
                  placeholder="https://meet.google.com/…"
                  value={meetingLink}
                  onChange={(event) => setMeetingLink(event.target.value)}
                />
              </div>
            </div>
            <p className="mt-2 text-[0.7rem] text-muted-foreground">
              Weekdays only. Candidates only see times that are still free.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Mail className="size-4 text-primary" /> Automatic emails
            </p>
            <label className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span>
                Send the interview invitation with the booking link as soon as a candidate is added
                <span className="block text-xs text-muted-foreground">Reminders and follow-ups follow automatically.</span>
              </span>
              <Switch checked={autoInterview} onCheckedChange={setAutoInterview} />
            </label>
            <label className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span>
                Send the onboarding form after the interview is completed
                <span className="block text-xs text-muted-foreground">Each candidate gets it without you sending it.</span>
              </span>
              <Switch checked={autoForm} onCheckedChange={setAutoForm} />
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={submit.isPending} onClick={() => submit.mutate()}>
            Save for all candidates
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
