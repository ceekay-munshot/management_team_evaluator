export interface BirdnestResult {
  ticker: string;
  country: string;
  name: string;
  industry: string;
}

export async function searchCompanies(query: string): Promise<BirdnestResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const response = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: trimmed }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (payload as { error?: string } | null)?.error || `Search failed (${response.status})`;
    throw new Error(message);
  }

  const results = (payload as { results?: BirdnestResult[] } | null)?.results;
  return Array.isArray(results) ? results : [];
}
