import { NextResponse } from "next/server";

export const runtime = "nodejs";

const AIRPORTS_CSV_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv";
type AirportOption = { city: string; name: string; code: string; country: string };
let airportCache: { expiresAt: number; airports: AirportOption[] } | null = null;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"' && field.length === 0) quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function getAirports(): Promise<AirportOption[]> {
  if (airportCache && airportCache.expiresAt > Date.now()) return airportCache.airports;
  const response = await fetch(AIRPORTS_CSV_URL, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error("Worldwide airport data is temporarily unavailable.");
  const rows = parseCsv(await response.text());
  const headers = rows.shift() ?? [];
  const column = (name: string) => headers.indexOf(name);
  const displayRegion = new Intl.DisplayNames(["en"], { type: "region" });
  const seen = new Set<string>();
  const airports = rows.flatMap(row => {
    const code = (row[column("iata_code")] ?? "").toUpperCase();
    const type = row[column("type")] ?? "";
    if (!/^[A-Z]{3}$/.test(code) || type === "closed_airport" || type === "heliport" || type === "seaplane_base" || seen.has(code)) return [];
    seen.add(code);
    const name = row[column("name")] ?? code;
    const city = row[column("municipality")] || name;
    const countryCode = row[column("iso_country")] ?? "";
    const country = countryCode ? displayRegion.of(countryCode) ?? countryCode : "";
    return [{ city, name, code, country }];
  });
  airportCache = { airports, expiresAt: Date.now() + 86_400_000 };
  return airports;
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.slice(0, 80) ?? "";
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < 2) return NextResponse.json({ airports: [] });
  try {
    const airports = await getAirports();
    const parts = normalizedQuery.split(/\s+/).filter(Boolean);
    const matches = airports.filter(airport => {
      const searchable = normalize(`${airport.code} ${airport.city} ${airport.name} ${airport.country}`);
      return parts.every(part => searchable.includes(part));
    }).sort((a, b) => {
      const rank = (airport: AirportOption) => {
        const code = normalize(airport.code);
        const city = normalize(airport.city);
        const name = normalize(airport.name);
        return code === normalizedQuery ? 0 : city.startsWith(normalizedQuery) ? 1 : name.startsWith(normalizedQuery) ? 2 : 3;
      };
      return rank(a) - rank(b) || a.city.localeCompare(b.city) || a.name.localeCompare(b.name);
    }).slice(0, 12);
    return NextResponse.json({ airports: matches, source: "OurAirports" }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worldwide airport data is temporarily unavailable.";
    return NextResponse.json({ error: message, airports: [] }, { status: 502 });
  }
}
