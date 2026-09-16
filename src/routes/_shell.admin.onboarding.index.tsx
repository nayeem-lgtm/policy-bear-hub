import { createFileRoute } from "@tanstack/react-router";

import { OnboardingWorkspace } from "@/components/onboarding/OnboardingWorkspace";

export const Route = createFileRoute("/_shell/admin/onboarding/")({
  head: () => ({
    meta: [
      { title: "Agent Onboarding — PolicyBear Operations" },
      {
        name: "description",
        content:
          "Hiring and onboarding pipeline for PolicyBear agents: onboarding form, offer letter, carrier approval, employment agreement and ARM access.",
      },
      { property: "og:title", content: "Agent Onboarding — PolicyBear Operations" },
      {
        property: "og:description",
        content:
          "Track every PolicyBear agent from candidate to completed onboarding with documents, approvals and signatures.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnboardingWorkspace,
});
