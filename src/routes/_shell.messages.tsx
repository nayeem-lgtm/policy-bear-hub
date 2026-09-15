import { createFileRoute } from "@tanstack/react-router";

import { CompanyChat } from "@/components/messaging/CompanyChat";

export const Route = createFileRoute("/_shell/messages")({
  head: () => ({
    meta: [
      { title: "Team Chat — PolicyBear Operations" },
      {
        name: "description",
        content:
          "One company-wide room for the whole floor: share files, react, mention teammates and reply in threads in real time.",
      },
      { property: "og:title", content: "Team Chat — PolicyBear Operations" },
      {
        property: "og:description",
        content: "Company-wide chat for the PolicyBear floor with files, reactions, mentions and threads.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  return <CompanyChat />;
}
