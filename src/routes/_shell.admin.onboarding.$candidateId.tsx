import { createFileRoute, useParams } from "@tanstack/react-router";

import { OnboardingProfile } from "@/components/onboarding/OnboardingProfile";

export const Route = createFileRoute("/_shell/admin/onboarding/$candidateId")({
  head: () => ({
    meta: [
      { title: "Onboarding Profile — PolicyBear Operations" },
      {
        name: "description",
        content:
          "Agent onboarding profile: personal details, licensing, banking, documents, authorizations, timeline and email log.",
      },
      { property: "og:title", content: "Onboarding Profile — PolicyBear Operations" },
      {
        property: "og:description",
        content: "Review a PolicyBear agent's onboarding record and move them through each required stage.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnboardingProfilePage,
});

function OnboardingProfilePage() {
  const { candidateId } = useParams({ from: "/_shell/admin/onboarding/$candidateId" });
  return <OnboardingProfile candidateId={candidateId} />;
}
