import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { savePushSubscription } from "@/lib/push/actions";
import { respond, sameOrigin } from "@/lib/push/route-utils";
import { detectPlatform } from "@/lib/push-client";
import { createClient } from "@/utils/supabase/server";

const body = z.object({
  subscription: z.object({ endpoint: z.string(), keys: z.object({ p256dh: z.string(), auth: z.string() }) }),
  oldEndpoint: z.string().max(1000).nullish(),
});

// A SW pushsubscriptionchange-ből: új feliratkozás + a régi végpont törlése (session kell; a proxy 401-et ad nélküle)
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "validation" }, { status: 400 });

  const ua = request.headers.get("user-agent") ?? "";
  const saved = await savePushSubscription({
    ...parsed.data.subscription,
    platform: detectPlatform({ userAgent: ua, platform: "", maxTouchPoints: 0 }),
    label: "",
  });
  if (!saved.ok) return respond(saved);

  const old = parsed.data.oldEndpoint;
  if (old && old !== parsed.data.subscription.endpoint) {
    await createClient(await cookies()).rpc("unregister_push_subscription", { p_endpoint: old });
  }
  return respond({ ok: true });
}
