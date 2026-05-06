import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function searchFirecrawl(query: string, apiKey: string, limit = 3): Promise<string> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 12000);
    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit, scrapeOptions: { formats: ["markdown"] } }),
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!response.ok) return "";
    const data = await response.json();
    if (!data.data) return "";
    return data.data
      .map((r: any) => `SOURCE: ${r.url}\n${(r.markdown || r.description || "").substring(0, 2000)}`)
      .filter((s: string) => s.length > 20)
      .join("\n\n---\n\n");
  } catch (e) {
    console.error("Firecrawl error:", (e as Error).message);
    return "";
  }
}

function extractJSON(text: string): string {
  let cleaned = text
    .replace(/```json\s*/g, "").replace(/```\s*/g, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
  const firstBrace = cleaned.indexOf("[") !== -1 && (cleaned.indexOf("{") === -1 || cleaned.indexOf("[") < cleaned.indexOf("{"))
    ? cleaned.indexOf("[") : cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("]") !== -1 && (cleaned.lastIndexOf("}") === -1 || cleaned.lastIndexOf("]") > cleaned.lastIndexOf("}"))
    ? cleaned.lastIndexOf("]") : cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

interface ExecInput {
  id: string;
  name: string;
  title: string;
  tenureYears?: number;
}

function pairKey(id1: string, id2: string): string {
  return id1 < id2 ? `${id1}|${id2}` : `${id2}|${id1}`;
}

function confidenceRank(c: string): number {
  return c === "high" ? 3 : c === "medium" ? 2 : 1;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyName, executives } = await req.json();
    if (!companyName || !Array.isArray(executives) || executives.length < 2) {
      return new Response(JSON.stringify({ error: "companyName and executives[] required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };

    // Validate inputs — strictly require id and name
    const validExecs: ExecInput[] = executives
      .filter((e: any) => e.id && e.name && typeof e.id === "string" && typeof e.name === "string")
      .slice(0, 12);

    if (validExecs.length < 2) {
      return new Response(JSON.stringify({ error: "Need at least 2 valid executives with id and name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const execIdSet = new Set(validExecs.map(e => e.id));

    // Build stable reference list
    const execRefList = validExecs.map((e, i) =>
      `E${i + 1} | id="${e.id}" | ${e.name} | ${e.title} | tenure=${e.tenureYears ?? "unknown"}y`
    ).join("\n");

    // Generate all expected pairs
    const expectedPairs: Array<{ id1: string; id2: string; name1: string; name2: string }> = [];
    for (let i = 0; i < validExecs.length; i++) {
      for (let j = i + 1; j < validExecs.length; j++) {
        expectedPairs.push({
          id1: validExecs[i].id, id2: validExecs[j].id,
          name1: validExecs[i].name, name2: validExecs[j].name,
        });
      }
    }

    const pairRefList = expectedPairs.map((p, i) =>
      `P${i + 1}: "${p.name1}" (id="${p.id1}") ↔ "${p.name2}" (id="${p.id2}")`
    ).join("\n");

    // Web research — targeted Simply Wall St + career history queries
    let webContext = "";
    if (FIRECRAWL_API_KEY) {
      const queries = [
        `site:simplywall.st "${companyName}" management team ownership`,
        `"${companyName}" leadership team executive careers prior companies board`,
        ...validExecs.slice(0, 3).map(e => `"${e.name}" career history prior companies executive`),
      ];
      const results = await Promise.all(
        queries.map(q => searchFirecrawl(q, FIRECRAWL_API_KEY, 2))
      );
      webContext = results.filter(Boolean).join("\n\n===\n\n").substring(0, 8000);
    }

    const webSection = webContext.length > 50
      ? `\n\nWEB RESEARCH DATA:\n${webContext}`
      : "";

    const prompt = `You are a senior equity research analyst specializing in management team cohesion analysis.

TASK: For "${companyName}", analyze pairwise working relationships between these OPERATING executives.

EXECUTIVE REFERENCE LIST (use these EXACT ids in your response — copy character-for-character):
${execRefList}

ALL PAIRS TO ANALYZE (${expectedPairs.length} total — return EXACTLY this many):
${pairRefList}

CRITICAL DISTINCTION — you must separate TWO types of overlap:

1. **currentCompanyOverlapYears**: Years both executives have worked at "${companyName}" simultaneously.
   - Calculate as: min(exec1.tenureAtCurrentCompany, exec2.tenureAtCurrentCompany)
   - This is EXPECTED and NOT the main cohesion signal.

2. **priorSharedHistoryYears**: Years they worked at the SAME COMPANY BEFORE joining "${companyName}".
   - This is the REAL signal of deep cohesion.
   - Only count if you have evidence of overlapping tenure at a prior company.
   - Do NOT guess. If uncertain, set to 0.

3. **yearsWorkedTogether**: Set this equal to priorSharedHistoryYears ONLY. Do NOT add currentCompanyOverlapYears.

STATUS RULES (VERY IMPORTANT — read carefully):
- "confirmed_overlap": ONLY when priorSharedHistoryYears > 0 — they worked together at a PRIOR company before ${companyName}
- "current_only_overlap": When they currently overlap at ${companyName} but have NO proven prior shared history
- "confirmed_no_overlap": Evidence they did NOT work together before, and no current overlap
- "unknown": Cannot determine from available data

IMPORTANT: Do NOT mark pairs as "confirmed_overlap" just because they both currently work at "${companyName}". That is "current_only_overlap".
"confirmed_overlap" requires evidence of PRIOR shared company history.

CRITICAL RULES:
- Return EXACTLY ${expectedPairs.length} pairs
- Use EXACT executive1Id and executive2Id from the reference list — copy the UUID strings exactly
- Do NOT invent prior shared history. Only report it with evidence.
- If all you know is they both currently work at "${companyName}", use status "current_only_overlap"
- confidence: "high" if from reliable source, "medium" if from general knowledge, "low" if estimated
${webSection}

Return ONLY a JSON array:
[
  {
    "executive1Id": "exact-uuid",
    "executive2Id": "exact-uuid",
    "exec1Name": "Full Name",
    "exec2Name": "Full Name",
    "status": "confirmed_overlap",
    "yearsWorkedTogether": 3,
    "currentCompanyOverlapYears": 5,
    "priorSharedHistoryYears": 3,
    "sharedCompanies": ["Prior Company A", "${companyName}"],
    "overlapPeriod": "2016-present",
    "confidence": "high",
    "evidenceSummary": "Both at Prior Co (2016-2019), then both at ${companyName} (2019-present).",
    "sourceLabel": "Simply Wall St / Annual Report"
  }
]

No markdown, no explanation. ONLY the JSON array.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    const response = await fetch(AI_URL, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        max_tokens: 10000,
        messages: [
          { role: "system", content: "Return ONLY valid JSON array. No markdown." },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI research failed." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await response.json();
    const content = extractJSON(aiData.choices?.[0]?.message?.content || "[]");

    let rawPairs: any[];
    try {
      const parsed = JSON.parse(content);
      rawPairs = Array.isArray(parsed) ? parsed : (parsed.pairs || parsed.cohesionPairs || []);
    } catch {
      console.error("Failed to parse cohesion JSON:", content.substring(0, 200));
      return new Response(JSON.stringify({ error: "AI returned invalid cohesion data." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // STRICTLY validate returned pairs — ID-only, no name-based recovery
    const returnedPairs = new Map<string, any>();

    for (const p of rawPairs) {
      const id1 = p.executive1Id || "";
      const id2 = p.executive2Id || "";

      // Reject if IDs don't match our exec set — NO name-based recovery
      if (!execIdSet.has(id1) || !execIdSet.has(id2) || id1 === id2) continue;

      const key = pairKey(id1, id2);
      const currentOverlap = typeof p.currentCompanyOverlapYears === "number" ? p.currentCompanyOverlapYears : 0;
      const priorHistory = typeof p.priorSharedHistoryYears === "number" ? p.priorSharedHistoryYears : 0;

      const normalized = {
        executive1Id: key.split("|")[0],
        executive2Id: key.split("|")[1],
        exec1Name: p.exec1Name || "",
        exec2Name: p.exec2Name || "",
        status: ["confirmed_overlap", "current_only_overlap", "confirmed_no_overlap", "unknown"].includes(p.status) ? p.status : "unknown",
        yearsWorkedTogether: priorHistory, // Main metric = prior shared history only
        currentCompanyOverlapYears: currentOverlap,
        priorSharedHistoryYears: priorHistory,
        sharedCompanies: Array.isArray(p.sharedCompanies) ? p.sharedCompanies : [],
        overlapPeriod: p.overlapPeriod || "",
        confidence: ["high", "medium", "low"].includes(p.confidence) ? p.confidence : "low",
        evidenceSummary: p.evidenceSummary || "",
        sourceLabel: p.sourceLabel || "",
        isSyntheticFallback: false,
      };

      const existing = returnedPairs.get(key);
      if (!existing || confidenceRank(normalized.confidence) > confidenceRank(existing.confidence)) {
        returnedPairs.set(key, normalized);
      }
    }

    // Fill missing pairs as unknown
    for (const ep of expectedPairs) {
      const key = pairKey(ep.id1, ep.id2);
      if (!returnedPairs.has(key)) {
        returnedPairs.set(key, {
          executive1Id: key.split("|")[0],
          executive2Id: key.split("|")[1],
          exec1Name: ep.name1,
          exec2Name: ep.name2,
          status: "unknown",
          yearsWorkedTogether: 0,
          currentCompanyOverlapYears: 0,
          priorSharedHistoryYears: 0,
          sharedCompanies: [],
          overlapPeriod: "",
          confidence: "low",
          evidenceSummary: "",
          sourceLabel: "",
          isSyntheticFallback: true,
        });
      }
    }

    const finalPairs = Array.from(returnedPairs.values());
    const overlaps = finalPairs.filter(p => p.status === "confirmed_overlap").length;
    const noOverlap = finalPairs.filter(p => p.status === "confirmed_no_overlap").length;
    const unknown = finalPairs.filter(p => p.status === "unknown").length;
    const priorHistory = finalPairs.filter(p => p.priorSharedHistoryYears > 0).length;
    console.log(`Enriched ${finalPairs.length}/${expectedPairs.length} pairs: ${overlaps} overlaps (${priorHistory} with prior history), ${noOverlap} no-overlap, ${unknown} unknown`);

    return new Response(
      JSON.stringify({ success: true, pairs: finalPairs }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error:", e);
    if ((e as Error).name === "AbortError") {
      return new Response(JSON.stringify({ error: "Enrichment timed out. Try again." }),
        { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
