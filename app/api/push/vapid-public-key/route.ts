import { NextResponse } from "next/server";

// A SW pushsubscriptionchange-hez (§21.5). A VAPID PUBLIKUS kulcs publikus-by-design.
export function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  return NextResponse.json({ key: key || null }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
