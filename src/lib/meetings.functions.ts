import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface InviteResult {
  sent: number;
  failed: number;
  skipped: number;
  reason?: "missing-key" | "no-recipients";
}

/** Email the meeting invitation to everyone on the invite list. */
export const sendMeetingInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { meetingId: string; joinUrl: string }) => input)
  .handler(async ({ data, context }): Promise<InviteResult> => {
    const { supabase } = context;

    const { data: meeting } = await supabase
      .from("meetings")
      .select("id,title,description,starts_at,duration_minutes,timezone,room_code")
      .eq("id", data.meetingId)
      .maybeSingle();
    if (!meeting) return { sent: 0, failed: 0, skipped: 0, reason: "no-recipients" };

    const { data: guests } = await supabase
      .from("meeting_participants")
      .select("id,name,email")
      .eq("meeting_id", data.meetingId);

    const recipients = (guests ?? []).filter((guest) => !!guest.email);
    if (!recipients.length) return { sent: 0, failed: 0, skipped: 0, reason: "no-recipients" };

    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) {
      await supabase
        .from("meeting_participants")
        .update({ email_status: "unavailable" })
        .eq("meeting_id", data.meetingId);
      return { sent: 0, failed: 0, skipped: recipients.length, reason: "missing-key" };
    }

    const from = process.env["MEETING_INVITE_FROM"] ?? "PolicyBear Meetings <onboarding@resend.dev>";
    const start = new Date(meeting.starts_at as string);
    const when = start.toLocaleString("en-US", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: (meeting.timezone as string) || "UTC",
    });

    let sent = 0;
    let failed = 0;

    for (const guest of recipients) {
      const html = `
        <div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
          <p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin:0 0 8px">PolicyBear meeting invitation</p>
          <h1 style="font-size:24px;margin:0 0 16px">${escapeHtml(meeting.title as string)}</h1>
          <p style="margin:0 0 6px"><strong>When:</strong> ${escapeHtml(when)} (${escapeHtml(
            String(meeting.timezone ?? "UTC"),
          )})</p>
          <p style="margin:0 0 16px"><strong>Length:</strong> ${meeting.duration_minutes} minutes</p>
          ${
            meeting.description
              ? `<p style="margin:0 0 20px;color:#334155">${escapeHtml(String(meeting.description))}</p>`
              : ""
          }
          <p style="margin:24px 0">
            <a href="${escapeHtml(data.joinUrl)}" style="background:#0f172a;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600">Join the meeting</a>
          </p>
          <p style="font-size:12px;color:#64748b;margin:0">Or open this link: ${escapeHtml(data.joinUrl)}</p>
          <p style="font-size:12px;color:#94a3b8;margin-top:28px">A product of Ray Advertising</p>
        </div>`;

      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: [guest.email],
            subject: `Meeting invite: ${meeting.title} — ${when}`,
            html,
          }),
        });
        if (response.ok) {
          sent += 1;
          await supabase
            .from("meeting_participants")
            .update({ email_status: "sent", email_sent_at: new Date().toISOString() })
            .eq("id", guest.id);
        } else {
          failed += 1;
          await supabase.from("meeting_participants").update({ email_status: "failed" }).eq("id", guest.id);
        }
      } catch {
        failed += 1;
        await supabase.from("meeting_participants").update({ email_status: "failed" }).eq("id", guest.id);
      }
    }

    return { sent, failed, skipped: 0 };
  });

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
