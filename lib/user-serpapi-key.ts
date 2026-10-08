import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const encryptionKey = process.env.FARE_GLOW_ENCRYPTION_KEY;
  if (!url || !anonKey || !serviceRoleKey) throw new Error("Supabase server credentials are not configured.");
  if (!encryptionKey || !/^[a-fA-F0-9]{64}$/.test(encryptionKey)) throw new Error("FARE_GLOW_ENCRYPTION_KEY must be 64 hexadecimal characters.");
  return { url, anonKey, serviceRoleKey, encryptionKey: Buffer.from(encryptionKey, "hex") };
}

export function areUserSerpApiKeysConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    /^[a-fA-F0-9]{64}$/.test(process.env.FARE_GLOW_ENCRYPTION_KEY ?? ""),
  );
}

export async function authenticateRequest(request: Request): Promise<{ user: User; admin: SupabaseClient } | null> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const { url, anonKey, serviceRoleKey } = config();
  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return { user: data.user, admin };
}

export function encryptSerpApiKey(apiKey: string) {
  const { encryptionKey } = config();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString("base64")).join(".");
}

export function decryptSerpApiKey(value: string) {
  const { encryptionKey } = config();
  const [encodedIv, encodedTag, encodedData] = value.split(".");
  if (!encodedIv || !encodedTag || !encodedData) throw new Error("Stored SerpApi key could not be read.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(encodedIv, "base64"));
  decipher.setAuthTag(Buffer.from(encodedTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encodedData, "base64")), decipher.final()]).toString("utf8");
}

export async function getStoredSerpApiKey(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.from("user_serpapi_keys").select("encrypted_key").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Could not read your saved SerpApi key.");
  return data?.encrypted_key ? decryptSerpApiKey(data.encrypted_key as string) : null;
}
