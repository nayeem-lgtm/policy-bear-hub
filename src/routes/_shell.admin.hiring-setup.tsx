import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CalendarRange, LayoutTemplate, Mail, Save, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmailSequenceEditor } from "@/components/onboarding/EmailSequenceEditor";
import { getHiringAutomation, saveHiringAutomation } from "@/lib/interview-booking.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/admin/hiring-setup")({
  head: () => ({
    meta: [
      { title: "Interview & Email Setup — PolicyBear Hiring" },
      {
        name: "description",
        content:
          "Set your interview availability, customise the candidate booking page and edit the hiring email sequence once for every candidate.",
      },
      { property: "og:title", content: "Interview & Email Setup — PolicyBear Hiring" },
      {
        property: "og:description",
        content:
          "One interview calendar, one branded booking page and one email sequence used for every PolicyBear candidate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HiringSetupPage,
});

const DURATIONS = [15, 20, 30, 45, 60, 90];
const TIMEZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Asia/Dhaka"];
const NOTICE = [0, 1, 2, 4, 12, 24, 48];
const DAYS = [
  { value: 1, short: "Mon" },
  { value: 2, short: "Tue" },
  { value: 3, short: "Wed" },
  { value: 4, short: "Thu" },
  { value: 5, short: "Fri" },
  { value: 6, short: "Sat" },
  { value: 7, short: "Sun" },
];

function HiringSetupPage() {
  const queryClient = useQueryClient();
  const load = useServerFn(getHiringAutomation);
  const save = useServerFn(saveHiringAutomation);

  const settingsQuery = useQuery({
    queryKey: ["hiring-automation"],
    queryFn: () => load({ data: undefined as never }),
  });

  const [daysAhead, setDaysAhead] = useState(14);
  const [dailyStart, setDailyStart] = useState("09:00");
  const [dailyEnd, setDailyEnd] = useState("17:00");
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [timezone, setTimezone] = useState("America/New_York");
  const [meetingLink, setMeetingLink] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [noticeHours, setNoticeHours] = useState(4);
  const [pageTitle, setPageTitle] = useState("Agent interview");
  const [pageDescription, setPageDescription] = useState("");
  const [hostName, setHostName] = useState("");
  const [locationLabel, setLocationLabel] = useState("Google Meet");
  const [confirmationNote, setConfirmationNote] = useState("");
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
    setWeekdays(row.available_weekdays?.length ? row.available_weekdays : [1, 2, 3, 4, 5]);
    setNoticeHours(row.min_notice_hours);
    setPageTitle(row.page_title);
    setPageDescription(row.page_description ?? "");
    setHostName(row.host_name ?? "");
    setLocationLabel(row.location_label ?? "Google Meet");
    setConfirmationNote(row.confirmation_note ?? "");
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
          availableWeekdays: [...weekdays].sort((a, b) => a - b),
          minNoticeHours: noticeHours,
          pageTitle,
          pageDescription,
          hostName,
          locationLabel,
          confirmationNote,
        },
      }),
    onSuccess: () => {
      toast.success("Saved — this now applies to every candidate");
      void queryClient.invalidateQueries({ queryKey: ["hiring-automation"] });
      void queryClient.invalidateQueries({ queryKey: ["candidate-interview-availability"] });
      void queryClient.invalidateQueries({ queryKey: ["candidate-booking-link"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Those settings could not be saved."),
  });

  const toggleDay = (value: number) =>
    setWeekdays((current) =>
      current.includes(value) ? current.filter((day) => day !== value) : [...current, value],
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="ghost" className="-ml-2 mb-1 text-xs text-muted-foreground">
            <Link to="/admin/onboarding">
              <ArrowLeft className="size-4" /> Back to hiring pipeline
            </Link>
          </Button>
          <h1 className="font-display text-2xl font-bold tracking-tight">Interview &amp; email setup</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Set this up once. Every candidate you add gets their own booking link on this calendar, sees this booking
            page and receives this email sequence — nothing to configure person by person.
          </p>
        </div>
        <Button disabled={submit.isPending || !weekdays.length} onClick={() => submit.mutate()}>
          <Save className="size-4" /> Save for all candidates
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* ------------------------------------------- interview availability */}
        <Card className="rounded-xl border-border p-4 shadow-card">
          <p className="flex items-center gap-2 text-sm font-bold">
            <CalendarRange className="size-4 text-primary" /> Interview availability
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The window candidates can book inside. They only ever see times that are still free.
          </p>

          <div className="mt-4">
            <Label className="text-xs">Days you take interviews</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {DAYS.map((day) => {
                const on = weekdays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Available from</Label>
              <Input type="time" value={dailyStart} onChange={(event) => setDailyStart(event.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Available until</Label>
              <Input type="time" value={dailyEnd} onChange={(event) => setDailyEnd(event.target.value)} />
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
              <Label className="text-xs">Minimum notice</Label>
              <Select value={String(noticeHours)} onValueChange={(value) => setNoticeHours(Number(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTICE.map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value === 0 ? "No notice needed" : `${value} hour${value === 1 ? "" : "s"} ahead`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                      {value.replace("America/", "").replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* ------------------------------------------------- booking page look */}
        <Card className="rounded-xl border-border p-4 shadow-card">
          <p className="flex items-center gap-2 text-sm font-bold">
            <LayoutTemplate className="size-4 text-primary" /> Booking page
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            What candidates see when they open their interview link.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <Label className="text-xs">Interview name</Label>
              <Input
                value={pageTitle}
                placeholder="Agent interview"
                onChange={(event) => setPageTitle(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Host shown to candidates</Label>
                <Input
                  value={hostName}
                  placeholder="Nayeem Ahmad · PolicyBear"
                  onChange={(event) => setHostName(event.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Where it happens</Label>
                <Input
                  value={locationLabel}
                  placeholder="Google Meet"
                  onChange={(event) => setLocationLabel(event.target.value)}
                />
              </div>
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
            <div>
              <Label className="text-xs">Intro text</Label>
              <Textarea
                rows={2}
                placeholder="Pick a time that suits you — we'll talk through the role, licensing and next steps."
                value={pageDescription}
                onChange={(event) => setPageDescription(event.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Message after they book</Label>
              <Textarea
                rows={2}
                placeholder="You'll get a confirmation email with the meeting link."
                value={confirmationNote}
                onChange={(event) => setConfirmationNote(event.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* ------------------------------------------------ automatic emails */}
        <Card className="rounded-xl border-border p-4 shadow-card xl:col-span-2">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Users className="size-4 text-primary" /> What happens automatically
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <span>
                Send the interview invitation with the booking link as soon as a candidate is added
                <span className="mt-1 block text-xs text-muted-foreground">
                  Reminders and follow-ups then run on the timing below.
                </span>
              </span>
              <Switch checked={autoInterview} onCheckedChange={setAutoInterview} />
            </label>
            <label className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <span>
                Send the onboarding form once the interview is completed
                <span className="mt-1 block text-xs text-muted-foreground">
                  Every candidate receives it without you sending anything.
                </span>
              </span>
              <Switch checked={autoForm} onCheckedChange={setAutoForm} />
            </label>
          </div>
        </Card>
      </div>

      <Card className="rounded-xl border-border p-4 shadow-card">
        <p className="flex items-center gap-2 text-sm font-bold">
          <Mail className="size-4 text-primary" /> Email sequence
        </p>
        <div className="mt-4">
          <EmailSequenceEditor />
        </div>
      </Card>
    </div>
  );
}
