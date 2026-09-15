import { createFileRoute } from "@tanstack/react-router";

import { MeetingsHub } from "@/components/meetings/MeetingsHub";

export const Route = createFileRoute("/_shell/meetings")({
  head: () => ({
    meta: [
      { title: "Meetings — PolicyBear Operations" },
      {
        name: "description",
        content:
          "Schedule team meetings, invite staff, keep agendas and notes, and join the built-in video room.",
      },
      { property: "og:title", content: "Meetings — PolicyBear Operations" },
      {
        property: "og:description",
        content: "Company meeting scheduling, invitations, agendas and a built-in video room.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MeetingsHub,
});
