import { NextResponse } from "next/server";
import { getSerpApiAccount } from "@/lib/serpapi";
import { authenticateRequest, encryptSerpApiKey, getStoredSerpApiKey } from "@/lib/user-serpapi-key";

export const runtime = "nodejs";

function freeSearchesRemaining(account: Awaited<ReturnType<typeof getSerpApiAccount>>) {
  const used = account.this_month_usage ?? 0;
  return Math.max(0, Math.min(250, account.searches_per_month ?? 250) - used);
}

export async function GET(request: Request) {
  try {
    const identity = await authenticateRequest(request);
    if (!identity) return NextResponse.json({ error: "Sign in to manage your SerpApi key." }, { status: 401 });
    const apiKey = await getStoredSerpApiKey(identity.admin, identity.user.id);
    if (!apiKey) return NextResponse.json({ configured: false, usageRemaining: null });
    const account = await getSerpApiAccount(apiKey);
    return NextResponse.json({ configured: true, usageRemaining: freeSearchesRemaining(account) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not check your SerpApi key.";
    return NextResponse.json({ error: message }, { status: message.includes("not configured") ? 503 : 502 });
  }
}

export async function POST(request: Request) {
  try {
    const identity = await authenticateRequest(request);
    if (!identity) return NextResponse.json({ error: "Sign in to save your SerpApi key." }, { status: 401 });
    const body = await request.json() as { apiKey?: unknown };
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (apiKey.length < 8 || apiKey.length > 256 || /\s/.test(apiKey)) {
      return NextResponse.json({ error: "Enter a valid SerpApi key." }, { status: 400 });
    }

    const account = await getSerpApiAccount(apiKey);
    if (account.account_status && account.account_status.toLowerCase() !== "active") {
      return NextResponse.json({ error: "That SerpApi account is not active." }, { status: 400 });
    }
    const { error } = await identity.admin.from("user_serpapi_keys").upsert({
      user_id: identity.user.id,
      encrypted_key: encryptSerpApiKey(apiKey),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw new Error("Could not securely save your SerpApi key.");
    return NextResponse.json({ configured: true, usageRemaining: freeSearchesRemaining(account) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save your SerpApi key.";
    const status = message.includes("not configured") ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const identity = await authenticateRequest(request);
    if (!identity) return NextResponse.json({ error: "Sign in to remove your SerpApi key." }, { status: 401 });
    const { error } = await identity.admin.from("user_serpapi_keys").delete().eq("user_id", identity.user.id);
    if (error) throw new Error("Could not remove your saved SerpApi key.");
    return NextResponse.json({ configured: false, usageRemaining: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove your SerpApi key.";
    return NextResponse.json({ error: message }, { status: message.includes("not configured") ? 503 : 502 });
  }
}
