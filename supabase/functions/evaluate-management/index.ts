import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => {
    console.log(`${label} timed out after ${ms}ms`);
    resolve(null);
  }, ms));
  return Promise.race([promise, timeout]);
}

async function searchFirecrawl(query: string, apiKey: string, limit = 3): Promise<string> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000);
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
      .map((r: any) => `SOURCE: ${r.title || r.url}\n${(r.markdown || r.description || "").substring(0, 1500)}`)
      .filter((s: string) => s.length > 20)
      .join("\n\n---\n\n");
  } catch (e) {
    console.error("Firecrawl error:", (e as Error).message);
    return "";
  }
}

// Extract candidate names+titles from raw web text using regex patterns
function extractCandidatesFromWeb(webText: string): { name: string; title: string }[] {
  const candidates: { name: string; title: string }[] = [];
  const titlePatterns = [
    /(?:Mr\.|Ms\.|Mrs\.|Dr\.|Shri|Smt\.?|CA)?\s*([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?))\s*[-–,]\s*((?:Non[-\s]?Executive\s+)?Chairman|Chairperson|Managing\s+Director|Whole[-\s]?Time\s+Director|Executive\s+Director|Independent\s+Director|Nominee\s+Director|Chief\s+(?:Executive|Financial|Operating|Technology|Human\s+Resources)\s+Officer|CEO|CFO|COO|CTO|CHRO|Company\s+Secretary|President|General\s+Counsel)/gi,
    /((?:Non[-\s]?Executive\s+)?Chairman|Chairperson|Managing\s+Director|Whole[-\s]?Time\s+Director|Executive\s+Director|Independent\s+Director|CEO|CFO|COO|Company\s+Secretary)\s*[-–:]\s*(?:Mr\.|Ms\.|Mrs\.|Dr\.|Shri|Smt\.?|CA)?\s*([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?))/gi,
  ];
  
  for (const pattern of titlePatterns) {
    let match;
    while ((match = pattern.exec(webText)) !== null) {
      // Pattern 1: name first, Pattern 2: title first
      const isNameFirst = pattern === titlePatterns[0];
      const name = (isNameFirst ? match[1] : match[2]).trim();
      const title = (isNameFirst ? match[2] : match[1]).trim();
      if (name.length > 3 && name.length < 50 && !name.match(/^(The|This|That|From|With|About)$/i)) {
        candidates.push({ name, title });
      }
    }
  }
  
  // Deduplicate by lowercase name
  const seen = new Set<string>();
  return candidates.filter(c => {
    const key = c.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Role/title tokens for pattern-based rejection
const ROLE_TOKENS = new Set([
  'chairman', 'chairperson', 'chair', 'executive', 'director', 'independent',
  'managing', 'non-executive', 'nonexecutive', 'nominee', 'whole-time',
  'wholetime', 'board', 'member', 'lead', 'group', 'senior', 'joint',
  'additional', 'alternate', 'associate', 'deputy', 'acting',
  'ceo', 'cfo', 'coo', 'cto', 'chro', 'president', 'officer',
  'chief', 'financial', 'operating', 'technology',
  'company', 'secretary', 'general', 'counsel', 'vice',
  'head', 'manager', 'partner', 'treasurer', 'auditor',
  'non', 'the', 'of', 'and', '&',
]);

// Check if string is composed mostly/entirely of role/title words
function isRoleTitlePhrase(name: string): boolean {
  const cleaned = name.replace(/^(mr\.?|ms\.?|mrs\.?|dr\.?|shri\.?|smt\.?|ca\.?|prof\.?)\s+/i, '').trim()
    .toLowerCase().replace(/[-–]/g, ' ').replace(/\s+/g, ' ');
  const tokens = cleaned.split(/\s+/).filter((t: string) => t.length > 0);
  if (tokens.length === 0) return true;
  const roleCount = tokens.filter((t: string) => ROLE_TOKENS.has(t)).length;
  if (roleCount === tokens.length) return true;
  if (tokens.length >= 2 && roleCount >= tokens.length - 1) {
    const nonRole = tokens.filter((t: string) => !ROLE_TOKENS.has(t));
    if (nonRole.length <= 1 && nonRole.every((t: string) => t.length < 3)) return true;
  }
  return false;
}

// Validate that a string is a real person name, not a generic role or composite title phrase
function isPersonName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const cleaned = name.replace(/^(mr\.?|ms\.?|mrs\.?|dr\.?|shri\.?|smt\.?|ca\.?|prof\.?)\s+/i, '').trim();
  if (cleaned.length < 3) return false;
  if (cleaned.length > 60) return false;
  if (/^[A-Z]{2,}$/.test(cleaned)) return false;
  if (!/[a-zA-Z]/.test(cleaned)) return false;
  // Reject composite title phrases like "Executive Chairman", "Lead Independent Director"
  if (isRoleTitlePhrase(name)) return false;
  // Must have person-like structure: at least 2 non-role tokens
  const tokens = cleaned.split(/\s+/).filter((t: string) => t.length > 0);
  const nonRoleTokens = tokens.filter((t: string) => !ROLE_TOKENS.has(t.toLowerCase()));
  if (nonRoleTokens.length < 2 && !(nonRoleTokens.length === 1 && cleaned.length >= 5 && tokens.length === 1)) {
    // Allow single-word names >= 5 chars, but multi-word must have 2+ non-role tokens
    if (tokens.length >= 2) return false;
  }
  return true;
}

// Classify title as operating executive vs board-only
function isOperatingTitle(title: string): boolean {
  return /\b(ceo|cfo|coo|cto|chro|chief|managing director|company secretary|president|general counsel|head|vp|vice president|whole[-\s]?time director)\b/i.test(title);
}

function isBoardOnlyTitle(title: string): boolean {
  if (isOperatingTitle(title)) return false;
  return /\b(chairman|chairperson|independent director|non[-\s]?executive|nominee director|director)\b/i.test(title);
}

// Merge web-extracted candidates into AI result if missing
function mergeLeaders(companyData: any, candidates: { name: string; title: string }[]) {
  const DIR_RE = /(chairman|chairperson|director|whole[-\s]?time director|managing director|executive director|non[-\s]?executive|independent director)/i;
  const EXE_RE = /(ceo|chief|cfo|coo|cto|president|company secretary|whole[-\s]?time director|managing director)/i;
  
  const existingNames = new Set<string>();
  for (const e of (companyData.executives || [])) existingNames.add(e.name?.toLowerCase().trim());
  for (const b of (companyData.boardMembers || [])) existingNames.add(b.name?.toLowerCase().trim());
  
  let added = 0;
  for (const c of candidates) {
    if (!isPersonName(c.name)) continue; // Validate person name
    if (existingNames.has(c.name.toLowerCase().trim())) continue;
    
    if (DIR_RE.test(c.title)) {
      if (!companyData.boardMembers) companyData.boardMembers = [];
      companyData.boardMembers.push({
        name: c.name, title: c.title, background: "Identified from public filings.",
        otherBoards: [], crossRelationships: [], tenure: "See annual report"
      });
      added++;
    }
    if (EXE_RE.test(c.title)) {
      if (!companyData.executives) companyData.executives = [];
      companyData.executives.push({
        name: c.name, title: c.title, age: null, tenureYears: null,
        reportsTo: null, priorRoles: [], achievements: ["See annual report"],
        financialMetrics: { revenueGrowth: "See filings", marginTrend: "See filings", roic: "See filings", notableMetrics: ["Per public disclosures"] },
        ownershipStake: "See filings", insiderTransactions: "See filings"
      });
      added++;
    }
    existingNames.add(c.name.toLowerCase().trim());
  }
  if (added > 0) console.log(`Merged ${added} candidates from web data`);
  return companyData;
}

// Final sanitization pass: remove invalid names, dedupe, board-only titles out of executives
function sanitizeCompanyData(companyData: any): any {
  // Sanitize executives: valid person name + NOT board-only title
  const seenExecs = new Set<string>();
  companyData.executives = (companyData.executives || []).filter((e: any) => {
    if (!isPersonName(e.name)) return false;
    // Board-only titles must never remain in executives
    if (isBoardOnlyTitle(e.title || '')) return false;
    const key = e.name.toLowerCase().trim();
    if (seenExecs.has(key)) return false;
    seenExecs.add(key);
    return true;
  });

  // Sanitize board members
  const seenBoard = new Set<string>();
  companyData.boardMembers = (companyData.boardMembers || []).filter((b: any) => {
    if (!isPersonName(b.name)) return false;
    const key = b.name.toLowerCase().trim();
    if (seenBoard.has(key)) return false;
    seenBoard.add(key);
    return true;
  });

  return companyData;
}

function extractJSON(text: string): string {
  // Strip markdown fences and thinking tags
  let cleaned = text
    .replace(/```json\s*/g, "").replace(/```\s*/g, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

function repairAndParseJSON(text: string): any {
  // Sanitize control characters inside strings (common LLM issue)
  let sanitized = text.replace(/[\x00-\x1f]/g, (ch) => {
    if (ch === '\n') return '\\n';
    if (ch === '\r') return '\\r';
    if (ch === '\t') return '\\t';
    return '';
  });
  
  // Try direct parse
  try { return JSON.parse(sanitized); } catch {}
  
  // Fix trailing commas
  let fixed = sanitized.replace(/,\s*([}\]])/g, "$1");
  try { return JSON.parse(fixed); } catch {}
  
  // Close unclosed strings first, then close structures
  let inString = false, escaped = false;
  const stack: string[] = [];
  for (const ch of fixed) {
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }
  
  // If we're inside a string, close it
  if (inString) {
    fixed += '"';
  }
  
  // Remove any trailing partial key-value and close structures
  if (stack.length > 0) {
    // Remove trailing incomplete entries
    fixed = fixed.replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/, "");
    fixed = fixed.replace(/,\s*"[^"]*"\s*:\s*$/, "");
    fixed = fixed.replace(/,\s*"[^"]*$/, "");
    fixed = fixed.replace(/,\s*$/, "");
    fixed += stack.reverse().join("");
    try { return JSON.parse(fixed); } catch (e) {
      console.error("Repair close-structures failed:", (e as Error).message?.substring(0, 100));
    }
  }
  
  // Last resort: try to extract just companyData and scoringResult separately
  try {
    const cdMatch = fixed.match(/"companyData"\s*:\s*(\{[\s\S]*)/);
    if (cdMatch) {
      // Find balanced closing brace for companyData
      let depth = 0, end = -1;
      for (let i = 0; i < cdMatch[1].length; i++) {
        if (cdMatch[1][i] === '{') depth++;
        else if (cdMatch[1][i] === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end > 0) {
        const companyData = JSON.parse(cdMatch[1].substring(0, end + 1));
        return { companyData, scoringResult: { scores: [], executiveScores: [], summary: "" } };
      }
    }
  } catch {}
  
  console.error("JSON repair failed. First 200:", text.substring(0, 200));
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyName } = await req.json();
    if (!companyName || typeof companyName !== "string") {
      return new Response(JSON.stringify({ error: "companyName is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const today = new Date().toISOString().split("T")[0];
    const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };
    const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

    // Step 1: Ticker + web scraping in parallel (hard-capped at 8s total)
    const tickerPromise = fetch(AI_URL, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        max_tokens: 50,
        messages: [{ role: "user", content: `Stock ticker for "${companyName}"? Reply ONLY the ticker (e.g. AAPL, TCS.NS). Nothing else.` }],
      }),
    }).then(async (r) => {
      if (!r.ok) return "";
      const d = await r.json();
      return (d.choices?.[0]?.message?.content || "").trim().replace(/[^A-Z0-9.]/gi, "").substring(0, 15);
    }).catch(() => "");

    let webContext = "";
    
    // Run Firecrawl + ticker in parallel
    const fcQueries = FIRECRAWL_API_KEY ? [
      `"${companyName}" CEO CFO "managing director" key executives leadership team 2024 2025`,
      `"${companyName}" board of directors chairman "whole-time director" "non-executive" independent directors annual report`,
      `site:goodreturns.in "${companyName}" management team directors`,
    ] : [];
    
    const promises: Promise<any>[] = [
      withTimeout(tickerPromise, 8000, "ticker"),
    ];
    
    if (FIRECRAWL_API_KEY) {
      promises.push(
        withTimeout(
          Promise.all(fcQueries.map((q, i) => withTimeout(searchFirecrawl(q, FIRECRAWL_API_KEY, 3), 12000, `fc-${i}`))),
          15000, "fc-all"
        )
      );
    } else {
      promises.push(Promise.resolve(null));
    }
    
    const [tickerRes, fcRes] = await Promise.all(promises);
    const ticker = (tickerRes as string) || "";
    
    const fcContext = (fcRes as string[] | null)?.filter(Boolean).join("\n\n===\n\n") || "";
    
    webContext = fcContext.substring(0, 5000);
    console.log(`Ticker: ${ticker}, FC: ${fcContext.length}, Web: ${webContext.length} chars`);
    
    return await doAICall(AI_URL, aiHeaders, companyName, ticker, webContext, today, corsHeaders);
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

async function doAICall(
  AI_URL: string,
  aiHeaders: Record<string, string>,
  companyName: string,
  ticker: string,
  webContext: string,
  today: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const webSection = webContext.length > 50
    ? `\n\nWEB RESEARCH DATA (use to VERIFY and GROUND your response — cross-check names against this data):\n${webContext}`
    : "";

  const combinedPrompt = `You are a senior equity research analyst at a top buy-side fund. Today is ${today}.

TASK: Research "${companyName}" (${ticker || "unknown ticker"}) — the PARENT LISTED ENTITY — and return a comprehensive JSON with executives, board, and scores.

CRITICAL — RENAMED COMPANIES: If "${companyName}" is a recently renamed company (e.g. "Eternal Limited" = formerly "Zomato", "Adani Wilmar" = formerly "Adani Enterprises' subsidiary"), identify the ACTUAL company and its REAL leadership. Use web data below to verify the company identity.

MANDATORY EXECUTIVE ROLES (return ALL of these for the PARENT company):
- CEO or Managing Director (reportsTo: null) — REQUIRED
- CFO or Chief Financial Officer — REQUIRED  
- COO or equivalent operational head — REQUIRED
- At least 3 more C-suite: CTO, CHRO, General Counsel, Company Secretary, Presidents, Head of Strategy, etc.
Total: minimum 6 executives, ideally 8.

MANDATORY BOARD (minimum 5):
- Chairman/Chairperson (including Non-Executive Chairman) — REQUIRED
- Whole-Time Directors — include ALL of them
- At least 3 other directors (independent, non-executive, nominee, etc.)
- For Indian companies: include ALL KMP (Key Managerial Personnel) and ALL directors listed in annual report — Non-Executive Chairman, Whole-Time Directors, Independent Directors, Nominee Directors

KEY RULES:
- PARENT COMPANY ONLY. NEVER include subsidiary executives.
- PRIORITIZE names from web research data below. If web data confirms executive names, USE THOSE. If web data is sparse, supplement with your training knowledge for well-known public company leaders.
- NEVER HALLUCINATE NAMES. If you are not confident about a name, use the web data. If neither source has the name, omit that role rather than inventing a person.
- For Indian companies: "Managing Director" = CEO. Include Company Secretary.
- Every executive MUST have: 2+ priorRoles, 2+ achievements, filled financialMetrics (revenueGrowth, marginTrend, roic, notableMetrics with at least 2 items each).
- Never use "N/A". Estimate: "~12%", "(est.) 55".
- Score 0-100: excellent=80+, good=65-79, mediocre=45-64, poor=<45.
- CRITICAL SCORING RULE: Each executive MUST have DIFFERENTIATED scores based on their INDIVIDUAL track record. Do NOT give all executives the same score (e.g. all 50). A CEO with 10 years of strong execution deserves 75-85; a newly appointed CFO with 2 years might get 55-65. Vary scores by at least 10 points across executives. If you don't have enough data to differentiate, estimate based on tenure, seniority, and role impact.
- Return ONLY valid JSON. No text/markdown before or after.
${webSection}

JSON SCHEMA:
{
  "companyData": {
    "companyName": "Full Legal Name",
    "ticker": "${ticker || "TICKER"}",
    "executives": [
      {
        "name": "Full Name", "title": "CEO", "age": 55, "tenureYears": 5,
        "reportsTo": null,
        "priorRoles": [{"company": "Co", "title": "Title", "years": "2018-2022"}],
        "achievements": ["Led revenue growth from $X to $Y"],
        "financialMetrics": {"revenueGrowth": "12%", "marginTrend": "+2pp", "roic": "15%", "notableMetrics": ["Market cap grew X%"]},
        "ownershipStake": "X%", "insiderTransactions": "Bought/sold X shares in 2024"
      }
    ],
    "boardMembers": [
      {"name": "Name", "title": "Chairman", "background": "2-3 sentence bio", "otherBoards": ["Company"], "crossRelationships": ["Relationship"], "tenure": "5 years"}
    ],
    "cohesionPairs": [
      {"exec1Name": "N1", "exec2Name": "N2", "yearsWorkedTogether": 3, "sharedCompanies": ["Co"]}
    ]
  },
  "scoringResult": {
    "scores": [
      {"dimension": "tenure_stability", "score": 72, "reasoning": "One sentence.", "dataPoints": ["Fact"]},
      {"dimension": "execution_track_record", "score": 65, "reasoning": "...", "dataPoints": ["..."]},
      {"dimension": "capital_allocation", "score": 68, "reasoning": "...", "dataPoints": ["..."]},
      {"dimension": "insider_alignment", "score": 55, "reasoning": "...", "dataPoints": ["..."]},
      {"dimension": "team_cohesion", "score": 63, "reasoning": "...", "dataPoints": ["..."]}
    ],
    "executiveScores": [
      {"name": "Exec Name", "scores": [
        {"dimension": "tenure_stability", "score": 80, "reasoning": "Brief"},
        {"dimension": "execution_track_record", "score": 75, "reasoning": "Brief"},
        {"dimension": "capital_allocation", "score": 70, "reasoning": "Brief"},
        {"dimension": "insider_alignment", "score": 60, "reasoning": "Brief"},
        {"dimension": "team_cohesion", "score": 65, "reasoning": "Brief"}
      ]}
    ],
    "summary": "2-3 paragraph buy-side assessment."
  }
}

FINAL CHECK before responding:
1. Does your response have 6+ PARENT company executives including CEO/MD and CFO with REAL names? If not, fix it.
2. Does the boardMembers array include the Chairman (even if Non-Executive), ALL Whole-Time Directors, and at least 3 Independent Directors? If not, fix it.
3. For Indian companies: are ALL KMP and directors from the annual report included? If not, add them.
4. Are executiveScores DIFFERENTIATED? If more than 2 executives share the same composite score, FIX IT — vary based on tenure, track record, and seniority.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(AI_URL, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        max_tokens: 16000,
        messages: [
          { role: "system", content: `You are a senior equity research analyst. Return ONLY valid JSON. NEVER include subsidiary executives. NEVER invent names.` },
          { role: "user", content: combinedPrompt },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      console.error("AI error:", status);
      return new Response(JSON.stringify({ error: "AI research failed. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await response.json();
    const content = extractJSON(aiData.choices?.[0]?.message?.content || "");

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      console.error("JSON parse failed, attempting repair. Length:", content.length, "Last 100:", content.substring(content.length - 100));
      result = repairAndParseJSON(content);
      if (!result) {
        return new Response(JSON.stringify({ error: "AI returned invalid data. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.log("JSON repair succeeded");
    }

    let companyData = result.companyData || result;
    const scoringResult = result.scoringResult || { scores: [], executiveScores: [], summary: "" };

    // Post-process: deterministically merge any directors/executives found in web data but missing from AI response
    if (webContext.length > 50) {
      const candidates = extractCandidatesFromWeb(webContext);
      if (candidates.length > 0) {
        console.log(`Web candidates found: ${candidates.map(c => `${c.name} (${c.title})`).join(", ")}`);
        companyData = mergeLeaders(companyData, candidates);
      }
    }

    // Verification call: ask a second model to list missing directors
    try {
      const currentNames = [
        ...(companyData.executives || []).map((e: any) => e.name),
        ...(companyData.boardMembers || []).map((b: any) => b.name),
      ];
      const verifyResp = await withTimeout(fetch(AI_URL, {
        method: "POST",
        headers: aiHeaders,
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `For "${companyName}" (listed Indian/global company), I already have these people: ${currentNames.join(", ")}. 
Are any REAL directors or KMP MISSING? Especially: Non-Executive Chairman, Whole-Time Directors, Company Secretary.
Reply ONLY as JSON array: [{"name":"Full Name","title":"Exact Title"}] or [] if none missing. NO explanation.`
          }],
        }),
      }), 12000, "verify");
      
      if (verifyResp && (verifyResp as Response).ok) {
        const vData = await (verifyResp as Response).json();
        const vContent = extractJSON(vData.choices?.[0]?.message?.content || "[]");
        try {
          const missing = JSON.parse(vContent);
          if (Array.isArray(missing) && missing.length > 0) {
            console.log(`Verification found ${missing.length} missing: ${missing.map((m: any) => m.name).join(", ")}`);
            companyData = mergeLeaders(companyData, missing);
          }
        } catch { /* ignore parse errors */ }
      }
    } catch (e) {
      console.error("Verify call error:", (e as Error).message);
    }

    // Final sanitization: remove invalid names, dedupe, separate board vs exec
    companyData = sanitizeCompanyData(companyData);
    console.log(`Final: ${companyData.executives?.length || 0} executives, ${companyData.boardMembers?.length || 0} board members`);

    return new Response(
      JSON.stringify({ success: true, companyData, scoringResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    clearTimeout(timeoutId);
    if ((e as Error).name === "AbortError") {
      console.error("AI call timed out at 45s");
      return new Response(JSON.stringify({ error: "Analysis took too long. Please try again." }),
        { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    throw e;
  }
}
