const BIRDNEST_URL = "https://birdnest.muns.io/stock/search";
const MUNS_BEARER_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWE5ZGMyYi0xZDBmLTQ2MzctOGE2Ny0wM2VhNzFmMGYyY2YiLCJlbWFpbCI6Im5hZGFtc2FsdWphQGdtYWlsLmNvbSIsIm9yZ0lkIjoiMSIsImF1dGhvcml0eSI6ImFkbWluIiwiaWF0IjoxNzc4NDM0MDY4LCJleHAiOjE3Nzg4NjYwNjh9.uqQ3uVj2JcwpF3eoaZ2VZ5kMaa2U1Pm47nC9ejHo1rQ";

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  MUNS_BEARER_TOKEN?: string;
}

interface BirdnestPayload {
  data?: { results?: Record<string, unknown> };
}

interface BirdnestEntry {
  ticker: string;
  country: string;
  name: string;
  industry: string;
}

function mapEntry(ticker: string, value: unknown): BirdnestEntry | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const [country, name, industry] = value;
  if (typeof country !== "string" || typeof name !== "string" || typeof industry !== "string") return null;
  return { ticker, country, name, industry };
}

function rank(entries: BirdnestEntry[], query: string): BirdnestEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return [...entries].sort((a, b) => {
    const score = (ticker: string, name: string): number => {
      const t = ticker.toLowerCase();
      const n = name.toLowerCase();
      if (t === q) return 0;
      if (t.startsWith(q)) return 1;
      if (n === q) return 2;
      if (n.startsWith(q)) return 3;
      if (t.includes(q)) return 4;
      if (n.includes(q)) return 5;
      return 6;
    };
    const sa = score(a.ticker, a.name);
    const sb = score(b.ticker, b.name);
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });
}

async function handleSearch(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let query = "";
  try {
    const body = (await request.json()) as { query?: unknown };
    if (typeof body?.query === "string") query = body.query.trim();
  } catch {
    /* empty body */
  }

  if (!query) {
    return new Response(JSON.stringify({ results: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = env.MUNS_BEARER_TOKEN || MUNS_BEARER_TOKEN;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let upstream: Response | null = null;
  try {
    upstream = await fetch(BIRDNEST_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `Upstream fetch failed: ${(e as Error).message}`, results: [] }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return new Response(
      JSON.stringify({ error: `Birdnest ${upstream.status}: ${detail.slice(0, 200)}`, results: [] }),
      { status: upstream.status, headers: { "Content-Type": "application/json" } },
    );
  }

  const payload = (await upstream.json().catch(() => null)) as BirdnestPayload | null;
  const raw = payload?.data?.results ?? {};

  const entries: BirdnestEntry[] = [];
  for (const [ticker, value] of Object.entries(raw)) {
    const mapped = mapEntry(ticker, value);
    if (mapped) entries.push(mapped);
  }

  const ranked = rank(entries, query).slice(0, 25);

  return new Response(JSON.stringify({ results: ranked }), {
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/search") {
      return handleSearch(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
