import "server-only";
import nodemailer from "nodemailer";
import type { CompanySettings } from "@/lib/types";

interface Notice { to: string; recipientName?: string | null; code: string; title: string; applicant: string }

/** Sends the reference-number notice via the provider chosen in Settings. Never throws. */
export async function sendRecipientNotice(settings: CompanySettings, n: Notice): Promise<{ sent: boolean; error?: string }> {
  if (!settings.notify_recipient || settings.smtp_provider === "none") return { sent: false };
  const from = process.env.EMAIL_FROM ?? `${settings.company_name} <noreply@localhost>`;
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const subject = `Document reference ${n.code}`;
  const html = `<p>Dear ${esc(n.recipientName || "Sir/Madam")},</p>
    <p>${esc(settings.company_name)} has issued the following document reference:</p>
    <p style="font-size:20px"><b>${esc(n.code)}</b></p>
    <p>Subject: ${esc(n.title)}<br/>Issued by: ${esc(n.applicant)}</p>`;
  try {
    if (settings.smtp_provider === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: n.to, subject, html }),
      });
      if (!res.ok) return { sent: false, error: `Resend ${res.status}` };
    } else {
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
      await transport.sendMail({ from, to: n.to, subject, html });
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
