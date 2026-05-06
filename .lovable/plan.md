

# Fix: Improve Executive Data Accuracy and Coverage

## Problem
The AI prompt is too restrictive — it says "use ONLY names found here" from web data. When Firecrawl returns sparse or irrelevant results (common for Indian companies), the AI returns 1-4 executives instead of 8, misses key roles (CEO, CFO), and sometimes returns subsidiary executives instead of parent company leaders.

## Root Causes
1. **Single Firecrawl query** returns generic results that may not include executive names
2. **"ONLY" constraint** prevents the AI from using its training knowledge when web data is sparse
3. **No minimum role requirements** — the prompt doesn't mandate CEO/MD and CFO as required outputs
4. **No parent vs subsidiary distinction** — AI conflates subsidiary leadership with parent company

## Plan

### 1. Run multiple targeted Firecrawl searches in parallel
Instead of one broad query, run 2-3 focused queries simultaneously:
- Query 1: `"Company Name" CEO CFO MD managing director key executives 2024 2025`
- Query 2: `"Company Name" board of directors chairman independent directors`
- Query 3: `"Company Name" annual report shareholding insider ownership`

This triples the chance of finding executive names in web results.

### 2. Relax the prompt constraint from "ONLY" to "PRIORITIZE"
Change the rule from:
> "Use ONLY names found in web data"

To:
> "PRIORITIZE names from the verified web data. If web data does not cover the top leadership (CEO/MD, CFO, COO), use your training knowledge — these are well-known public company executives."

### 3. Add mandatory role requirements to the prompt
Add explicit instruction:
> "You MUST include at minimum: the CEO or Managing Director, the CFO or Finance Head, and at least 1 other C-suite executive. If you cannot find them in web data, use your knowledge — these are public company leaders whose names are publicly available."

### 4. Add parent company distinction
Add rule:
> "Return executives of the PARENT company only. Do NOT include subsidiary-level executives unless they also hold parent company roles."

### 5. Use stronger model for better knowledge recall
Switch the main research call from `gemini-2.5-flash` to `google/gemini-2.5-pro` for more accurate knowledge-based executive identification, especially for well-known companies.

## Files Changed
- `supabase/functions/evaluate-management/index.ts` — Updated `scrapeData` to run parallel queries, relaxed prompt constraints, added mandatory role rules, switched to stronger model

## Expected Outcome
- Infosys: 6-8 parent company executives including Salil Parekh, Jayesh Sanghrajka, Nandan Nilekani on board
- HDFC Bank: 6-8 executives including Sashidhar Jagdishan (MD & CEO), Srinivasan Vaidyanathan (CFO), full board

