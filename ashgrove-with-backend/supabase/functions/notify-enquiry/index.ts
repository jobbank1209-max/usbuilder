// Sends two emails when a new row is added to public.contacts:
//  1) a notification to you  2) an automatic reply to the visitor.
// Uses Resend (resend.com). Secrets are set with `supabase secrets set` (see supabase/EMAIL.md).
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function send(to: string, subject: string, html: string, replyTo?: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}` },
    body: JSON.stringify({ from: Deno.env.get("MAIL_FROM"), to, subject, html, reply_to: replyTo }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

Deno.serve(async (req) => {
  // The database webhook sends this secret so strangers cannot trigger emails.
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) return new Response("Forbidden", { status: 403 });
  try {
    const { record: c } = await req.json();
    if (!c?.email) return new Response("No record", { status: 400 });
    const owner = Deno.env.get("OWNER_EMAIL")!;
    const window = Deno.env.get("REPLY_WINDOW") || "two working days";
    await send(
      owner,
      `New enquiry from ${c.name}`,
      `<h2>New enquiry</h2><p><b>${esc(c.name)}</b><br>${esc(c.email)}<br>${esc(c.phone)}</p>
       <p>Project: ${esc(c.project_type)}<br>Budget: ${esc(c.budget)}<br>Start: ${esc(c.start_when)}</p>
       <p>${esc(c.message).replace(/\n/g, "<br>")}</p>`,
      c.email,
    );
    await send(
      c.email,
      "We received your enquiry | Ashgrove Construction",
      `<p>Hello ${esc(c.name)},</p><p>Thank you for contacting Ashgrove Construction. We have your message and will reply within ${esc(window)}.</p><p>Ashgrove Construction<br>Colombo, Sri Lanka</p>`,
    );
    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 });
  }
});
