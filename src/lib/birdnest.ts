import { supabase } from '@/integrations/supabase/client';

export interface BirdnestResult {
  ticker: string;
  country: string;
  name: string;
  industry: string;
}

export async function searchCompanies(query: string): Promise<BirdnestResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase.functions.invoke('birdnest-search', {
    body: { query: trimmed },
  });

  if (error) {
    throw new Error(error.message || 'Search failed');
  }

  const results = (data as { results?: BirdnestResult[] })?.results;
  return Array.isArray(results) ? results : [];
}
