import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BIRDNEST_URL = "https://birdnest.muns.io/stock/search";

interface BirdnestEntry {
  ticker: string;
  country: string;
  name: string;
  industry: string;
}

function mapBirdnestEntry(ticker: string, value: unknown): BirdnestEntry | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const [country, name, industry] = value;
  if (typeof country !== "string" || typeof name !== "string" || typeof industry !== "string") return null;
  return { ticker, country, name, industry };
}

function rankResults(entries: BirdnestEntry[], query: string): BirdnestEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return [...entries].sort((a, b) => {
    const at = a.ticker.toLowerCase();
    const bt = b.ticker.toLowerCase();
    const an = a.name.toLowerCase();
    const bn = b.name.toLowerCase();
    const score = (ticker: string, name: string): number => {
      if (ticker === q) return 0;
      if (ticker.startsWith(q)) return 1;
      if (name === q) return 2;
      if (name.startsWith(q)) return 3;
      if (ticker.includes(q)) return 4;
      if (name.includes(q)) return 5;
      return 6;
    };
    const sa = score(at, an);
    const sb = score(bt, bn);
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { query } = await req.json().catch(() => ({ query: "" }));
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = Deno.env.get("MUNS_BEARER_TOKEN");
    if (!token) {
      console.error("MUNS_BEARER_TOKEN is not configured");
      return new Response(JSON.stringify({ error: "Search is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(BIRDNEST_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    }).catch((e: unknown) => {
      console.error("Birdnest fetch failed:", (e as Error).message);
      return null;
    });

    clearTimeout(timeoutId);

    if (!response || !response.ok) {
      return new Response(JSON.stringify({ error: "Search upstream failed", results: [] }), {
        status: response?.status ?? 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await response.json().catch(() => null);
    const raw = payload?.data?.results ?? {};

    const entries: BirdnestEntry[] = [];
    for (const [ticker, value] of Object.entries(raw)) {
      const mapped = mapBirdnestEntry(ticker, value);
      if (mapped) entries.push(mapped);
    }

    const ranked = rankResults(entries, query).slice(0, 25);

    return new Response(JSON.stringify({ results: ranked }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("birdnest-search error:", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message, results: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
