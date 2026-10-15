import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exportFilename, isCsvTable, toCsv } from "@/lib/export";
import { createClient } from "@/utils/supabase/server";

// Adataim letöltése (GDPR, §9.4/§19.1): a saját adat JSON-ban (minden) vagy CSV-ben (emlékeztetők / esedékességek / kiadások).
// Az `export_my_data` RPC security invoker (az RLS a saját sorokra szűr); a válasz soha nem gyorsítótárazott.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "json";
  const table = url.searchParams.get("table");
  if (format !== "json" && format !== "csv") return NextResponse.json({ error: "bad_format" }, { status: 400 });
  if (format === "csv" && !isCsvTable(table)) return NextResponse.json({ error: "bad_table" }, { status: 400 });

  const supabase = createClient(await cookies());
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data, error } = await supabase.rpc("export_my_data");
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    console.error("export failed", { code: error?.code ?? "none" });
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }
  const exportedAt = String((data as Record<string, unknown>).exported_at ?? "");
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };

  if (format === "json") {
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${exportFilename("json", exportedAt)}"` },
    });
  }
  const rows = (data as Record<string, unknown>)[table as string];
  const list = Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
  // BOM: az Excel a magyar ékezeteket így ismeri fel UTF-8-ként
  return new NextResponse("﻿" + toCsv(list), {
    headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${exportFilename(table as "reminders", exportedAt)}"` },
  });
}
