import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { formatMoney } from "@/lib/format";
import { buildIcs } from "@/lib/ics";
import type { Database } from "@/types/database.types";

const TOKEN = /^[A-Za-z0-9_-]{32,128}$/;

// Naptár-feed (§12.8): publikus, a token (192+ bit) az egyetlen hitelesítés; az `ics_feed` RPC anon-nak is hívható.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/ics/[token]">) {
  const { token: raw } = await ctx.params;
  const token = raw.replace(/\.ics$/i, "");
  if (!TOKEN.test(token)) return new NextResponse("Not found", { status: 404 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return new NextResponse("Unavailable", { status: 503 });

  const supabase = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc("ics_feed", { p_token: token });
  if (error) return new NextResponse("Unavailable", { status: 502 });

  const body = buildIcs(
    (data ?? []).map((r) => ({
      uid: r.uid,
      dueDate: r.due_date,
      summary: `${r.name} — ${formatMoney(r.amount, r.currency, "hu").replace(/[  ]/g, " ")}`,
      alarmDays: r.remind ? r.offset_days : null,
    })),
  );
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="bank-reminder.ics"',
      "Cache-Control": "private, max-age=900",
    },
  });
}
