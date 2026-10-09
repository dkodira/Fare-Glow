import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitValue = Number(url.searchParams.get("limit") ?? 20);
  const offsetValue = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number.isInteger(limitValue) ? Math.max(1, Math.min(50, limitValue)) : 20;
  const offset = Number.isInteger(offsetValue) ? Math.max(0, Math.min(10_000, offsetValue)) : 0;
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Feedback storage is not configured." }, { status: 503 });
  const { data, count, error } = await supabase.from("user_feedback")
    .select("id,category,message,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: "Could not load community feedback." }, { status: 502 });
  return NextResponse.json({ feedback: data ?? [], offset, hasMore: offset + (data?.length ?? 0) < (count ?? 0), total: count ?? 0 }, { headers: { "Cache-Control": "no-store" } });
}
