import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, CheckCircle2, Clock3, ExternalLink, ShieldCheck, Video } from "lucide-react";

import { PolicyBearLogo } from "@/components/brand/PolicyBearLogo";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { bookPublicInterviewSlot, getPublicInterviewBookingPage } from "@/lib/interview-booking.functions";

export const Route = createFileRoute("/book-interview/$token")({
  head: () => ({ meta: [
    { title: "Book Your Interview — PolicyBear" },
    { name: "description", content: "Choose an available interview time with the PolicyBear hiring team." },
    { property: "og:title", content: "Book Your Interview — PolicyBear" },
    { property: "og:description", content: "Choose an available interview time with the PolicyBear hiring team." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: InterviewBookingPage,
});

function InterviewBookingPage() {
  const { token } = Route.useParams();
  const fetchPage = useServerFn(getPublicInterviewBookingPage);
  const book = useServerFn(bookPublicInterviewSlot);
  const pageQuery = useQuery({
    queryKey: ["public-interview-booking", token],
    queryFn: () => fetchPage({ data: { token } }),
    retry: false,
  });
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedSlot, setSelectedSlot] = useState<string>();
  const [confirmation, setConfirmation] = useState<{ startsAt: string; timezone: string; meetingLink: string | null }>();
  const slots = pageQuery.data?.availableSlots ?? [];
  const slotsByDay = useMemo(() => new Map(slots.map((slot) => [new Date(slot).toLocaleDateString("en-CA", { timeZone: pageQuery.data?.timezone }), slot])), [slots, pageQuery.data?.timezone]);
  const daySlots = useMemo(() => {
    if (!selectedDate || !pageQuery.data) return [];
    const key = selectedDate.toLocaleDateString("en-CA");
    return slots.filter((slot) => new Date(slot).toLocaleDateString("en-CA", { timeZone: pageQuery.data?.timezone }) === key);
  }, [selectedDate, slots, pageQuery.data]);
  const booking = useMutation({
    mutationFn: () => book({ data: { token, startsAt: selectedSlot ?? "" } }),
    onSuccess: (result) => setConfirmation(result),
    onError: () => void pageQuery.refetch(),
  });

  const page = pageQuery.data;
  if (pageQuery.isLoading) return <Shell><p className="text-center text-sm text-muted-foreground">Loading available times…</p></Shell>;
  if (pageQuery.isError || !page) return <Shell><Empty title="This booking link is not available" body="Please ask your PolicyBear contact for a new interview link." /></Shell>;
  const bookedAt = confirmation?.startsAt ?? page.bookedStartsAt;
  if (bookedAt) {
    const meetingLink = confirmation?.meetingLink ?? page.meetingLink;
    return <Shell><div className="mx-auto max-w-lg text-center"><span className="mx-auto grid size-14 place-items-center rounded-full bg-success/10 text-success"><CheckCircle2 className="size-7" /></span><h1 className="mt-4 font-display text-2xl font-bold">Your interview is booked</h1><p className="mt-2 text-muted-foreground">{page.confirmationNote ?? `We look forward to speaking with you, ${page.candidateFirstName}.`}</p><Card className="mt-6 p-5 text-left"><p className="text-xs font-semibold uppercase text-muted-foreground">Confirmed time</p><p className="mt-1 text-lg font-bold">{formatSlot(bookedAt, page.timezone)}</p><p className="text-sm text-muted-foreground">{page.slotMinutes} minutes · {page.timezone.replace("America/", "")}{page.locationLabel ? ` · ${page.locationLabel}` : ""}</p>{meetingLink && <Button className="mt-4 w-full" asChild><a href={meetingLink} target="_blank" rel="noreferrer">Open meeting link <ExternalLink className="size-4" /></a></Button>}</Card></div></Shell>;
  }
  if (!page.isActive || !slots.length) return <Shell><Empty title="No interview times are available" body="Please ask your PolicyBear contact to open a new set of times." /></Shell>;

  return <Shell><div className="mb-7"><p className="text-sm font-semibold text-primary">{page.hostName ?? "PolicyBear Agent Hiring"}</p><h1 className="mt-1 font-display text-3xl font-bold">{page.pageTitle}</h1><p className="mt-2 text-muted-foreground">{page.pageDescription ?? `Hi ${page.candidateFirstName}, select an available day and time that works for you.`}</p><p className="mt-2 flex flex-wrap items-center gap-3 text-sm font-medium text-muted-foreground"><span className="flex items-center gap-1.5"><Clock3 className="size-4 text-primary" /> {page.slotMinutes} minutes</span>{page.locationLabel && <span className="flex items-center gap-1.5"><Video className="size-4 text-primary" /> {page.locationLabel}</span>}</p></div><div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]"><Card className="overflow-hidden"><div className="border-b border-border px-5 py-4"><p className="flex items-center gap-2 font-semibold"><CalendarDays className="size-4 text-primary" /> Select a date</p></div><Calendar mode="single" selected={selectedDate} onSelect={(date) => { setSelectedDate(date); setSelectedSlot(undefined); }} disabled={(date) => !slotsByDay.has(date.toLocaleDateString("en-CA"))} className="pointer-events-auto mx-auto p-5 [--cell-size:2.75rem]" /></Card><Card className="p-5"><p className="flex items-center gap-2 font-semibold"><Clock3 className="size-4 text-primary" /> {selectedDate ? selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "Select a date first"}</p><div className="mt-4 grid grid-cols-2 gap-2">{daySlots.map((slot) => <Button key={slot} variant={selectedSlot === slot ? "default" : "outline"} onClick={() => setSelectedSlot(slot)}>{new Date(slot).toLocaleTimeString("en-US", { timeZone: page.timezone, hour: "numeric", minute: "2-digit" })}</Button>)}</div>{selectedDate && !daySlots.length && <p className="mt-5 text-sm text-muted-foreground">No times remain on this date.</p>}<div className="mt-6 border-t border-border pt-4"><p className="text-xs text-muted-foreground">Times shown in {page.timezone.replace("America/", "")} · {page.slotMinutes}-minute interview</p><Button className="mt-3 w-full" disabled={!selectedSlot || booking.isPending} onClick={() => booking.mutate()}>{booking.isPending ? "Confirming…" : "Confirm interview time"}</Button>{booking.isError && <p className="mt-2 text-xs text-destructive">That time could not be reserved. Please choose another.</p>}</div></Card></div></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) { return <main className="min-h-screen bg-background px-4 py-8 sm:px-6"><div className="mx-auto max-w-4xl"><header className="mb-10 flex items-center justify-between border-b border-border pb-5"><PolicyBearLogo /><span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><ShieldCheck className="size-4 text-success" /> Secure scheduling</span></header>{children}</div></main>; }
function Empty({ title, body }: { title: string; body: string }) { return <div className="mx-auto max-w-lg py-16 text-center"><h1 className="font-display text-2xl font-bold">{title}</h1><p className="mt-2 text-muted-foreground">{body}</p></div>; }
function formatSlot(value: string, timezone: string) { return new Date(value).toLocaleString("en-US", { timeZone: timezone, weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); }