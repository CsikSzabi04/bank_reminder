// E-mail csatorna (emlékeztető-levelek). Szolgáltató: Resend-kompatibilis HTTP API (EMAIL_API_KEY + EMAIL_FROM secret).
// Nincs beállítva → { ok:false, reason:'no_provider' } és az e-mail sor `cancelled`-re kerül (a push/in_app ettől működik).
// Az Auth-levelek (regisztráció, jelszó-reset) a Supabase saját SMTP-jén mennek, ezt a modult nem érintik.
export interface EmailResult { ok: boolean; status?: number; reason?: string }

export async function sendEmail(to: string, msg: { subject: string; html: string; text: string }): Promise<EmailResult> {
  const key = Deno.env.get('EMAIL_API_KEY');
  const from = Deno.env.get('EMAIL_FROM');
  if (!key || !from) return { ok: false, reason: 'no_provider' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: msg.subject, html: msg.html, text: msg.text }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? { ok: true, status: res.status } : { ok: false, status: res.status, reason: `http_${res.status}` };
  } catch {
    return { ok: false, status: 0, reason: 'network' };
  }
}
