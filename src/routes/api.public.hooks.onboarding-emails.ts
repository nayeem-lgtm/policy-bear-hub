/**
 * Scheduled runner for the automated hiring email sequence.
 *
 * Called on a schedule (or manually) to send every due pre-interview reminder
 * and post-interview follow-up. Public prefix, so the caller is verified with
 * the project's cron secret.
 */

import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

async function run() {
  const [{ supabaseAdmin }, { runHiringSequences }] = await Promise.all([
    import("@/integrations/supabase/client.server"),
    import("@/lib/onboarding-sequence.server"),
  ]);
  const result = await runHiringSequences(supabaseAdmin);
  return Response.json({ ok: true, ...result });
}

export const Route = createFileRoute("/api/public/hooks/onboarding-emails")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        try {
          return await run();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          console.error("onboarding-emails run failed:", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
