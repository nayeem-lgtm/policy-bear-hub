import { createFileRoute } from "@tanstack/react-router";

import { MeetingDetail } from "@/components/meetings/MeetingDetail";

export const Route = createFileRoute("/_shell/meetings/$meetingId")({
  head: () => ({
    meta: [
      { title: "Meeting room — PolicyBear Operations" },
      {
        name: "description",
        content: "Meeting agenda, notes, attendance and the built-in video room for your team.",
      },
      { property: "og:title", content: "Meeting room — PolicyBear Operations" },
      {
        property: "og:description",
        content: "Open the agenda, take notes, track attendance and join the video room.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MeetingPage,
});

function MeetingPage() {
  const { meetingId } = Route.useParams();
  return <MeetingDetail meetingId={meetingId} />;
}
