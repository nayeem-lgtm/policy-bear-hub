import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";

import { Card } from "@/components/ui/card";
import { AgentOnboardingForm } from "@/components/onboarding/AgentOnboardingForm";
import { useAuth } from "@/context/AuthContext";
import { fetchCandidateByEmail } from "@/lib/onboarding";

export const Route = createFileRoute("/_shell/onboarding")({
  head: () => ({
    meta: [
      { title: "My Onboarding — PolicyBear Agents" },
      {
        name: "description",
        content:
          "Complete your PolicyBear agent onboarding: licensing, banking, documents and authorizations in a short guided flow.",
      },
      { property: "og:title", content: "My Onboarding — PolicyBear Agents" },
      {
        property: "og:description",
        content:
          "Complete your PolicyBear agent onboarding: licensing, banking, documents and authorizations in a short guided flow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyOnboardingPage,
});

function MyOnboardingPage() {
  const { user } = useAuth();
  const email = user?.email ?? "";

  const candidateQuery = useQuery({
    queryKey: ["my-onboarding", email],
    queryFn: () => fetchCandidateByEmail(email),
    enabled: !!email,
  });

  if (candidateQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading your onboarding…</p>;
  }

  if (!candidateQuery.data) {
    return (
      <Card className="mx-auto max-w-xl rounded-2xl border-white/70 bg-card/80 p-8 text-center shadow-card">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-brand/10 text-brand">
          <ClipboardList className="size-5" />
        </span>
        <h1 className="mt-3 font-display text-lg font-bold tracking-tight">No onboarding assigned</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          There is no onboarding record for {email || "your account"} yet. Your onboarding manager will send you an
          invitation when it is ready.
        </p>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <AgentOnboardingForm candidate={candidateQuery.data} />
    </div>
  );
}
