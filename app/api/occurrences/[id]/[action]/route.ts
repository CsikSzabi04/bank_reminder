import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { markPaid, snoozeOccurrence } from "@/lib/reminders/actions";
import { respond, sameOrigin } from "@/lib/push/route-utils";

// A service worker értesítés-gombjainak végpontja (§12.5): „Kifizettem" és „Holnap emlékeztess".
// Session (süti) + azonos Origin kell; az azonosítót és a műveletet szigorúan validáljuk.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/occurrences/[id]/[action]">) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
  const { id, action } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ ok: false, code: "validation" }, { status: 400 });

  if (action === "paid") return respond(await markPaid(id));
  if (action === "snooze") return respond(await snoozeOccurrence(id, 1)); // holnap a remind_time-kor
  return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
}
