import { supabase } from '@/integrations/supabase/client';
import { CompanyEvaluation, Executive, BoardMember, CohesionPair, DimensionScore, ScoringDimension, DEFAULT_WEIGHTS } from '@/types/evaluation';
import { sanitizeExecutives, isLikelyPersonName, normalizeName, findExactNameMatch } from '@/lib/executive-sanitizer';

interface AICompanyData {
  companyName: string;
  ticker: string;
  executives: Array<{
    name: string;
    title: string;
    age?: number;
    tenureYears: number;
    reportsTo?: string | null;
    priorRoles: Array<{ company: string; title: string; years: string }>;
    achievements: string[];
    financialMetrics: {
      revenueGrowth?: string;
      marginTrend?: string;
      roic?: string;
      notableMetrics?: string[];
    };
    ownershipStake?: string;
    insiderTransactions?: string;
  }>;
  boardMembers: Array<{
    name: string;
    title: string;
    background: string;
    otherBoards: string[];
    crossRelationships: string[];
    tenure: string;
  }>;
  cohesionPairs: Array<{
    exec1Name: string;
    exec2Name: string;
    yearsWorkedTogether: number;
    sharedCompanies: string[];
  }>;
}

interface AIScoringResult {
  scores: DimensionScore[];
  executiveScores: Array<{
    name: string;
    scores: Array<{ dimension: ScoringDimension; score: number; reasoning: string }>;
  }>;
  summary: string;
}

function transformToEvaluation(
  companyData: AICompanyData,
  scoringResult: AIScoringResult,
  weights: typeof DEFAULT_WEIGHTS
): CompanyEvaluation {
  // Sanitize executives: remove generic role-only names, deduplicate
  const cleanedExecs = sanitizeExecutives(companyData.executives || []);
  const cleanedBoard = sanitizeExecutives(companyData.boardMembers || []);

  const execIds = new Map<string, string>();
  cleanedExecs.forEach((e) => {
    execIds.set(e.name, crypto.randomUUID());
  });

  const executives: Executive[] = cleanedExecs.map((e) => {
    const id = execIds.get(e.name)!;
    let reportsToId: string | undefined;

    if (e.reportsTo && execIds.has(e.reportsTo)) {
      reportsToId = execIds.get(e.reportsTo);
    } else if (e.reportsTo) {
      // Use normalized matching for reportsTo
      for (const [name, eid] of execIds.entries()) {
        if (normalizeName(name) === normalizeName(e.reportsTo)) {
          reportsToId = eid;
          break;
        }
      }
    }

    // Use normalized exact-name matching for executive scores
    const execScoring = findExactNameMatch(
      e.name,
      scoringResult.executiveScores || []
    );

    const scores: DimensionScore[] = execScoring?.scores?.map((s) => ({
      dimension: s.dimension,
      score: s.score,
      reasoning: s.reasoning,
      dataPoints: [],
    })) || makeFallbackScores();

    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    const compositeScore = totalWeight > 0
      ? Math.round(scores.reduce((sum, s) => sum + s.score * (weights[s.dimension] || 20), 0) / totalWeight)
      : 0;

    return {
      id,
      name: e.name,
      title: e.title,
      age: e.age,
      tenureYears: e.tenureYears,
      reportsTo: reportsToId,
      priorRoles: e.priorRoles || [],
      achievements: e.achievements || [],
      financialMetrics: e.financialMetrics || {},
      ownershipStake: e.ownershipStake,
      insiderTransactions: e.insiderTransactions,
      scores,
      compositeScore,
    };
  });

  const boardMembers: BoardMember[] = cleanedBoard.map((b) => ({
    id: crypto.randomUUID(),
    name: b.name,
    title: b.title,
    background: b.background,
    otherBoards: b.otherBoards || [],
    crossRelationships: b.crossRelationships || [],
    tenure: b.tenure,
  }));

  const cohesionPairs: CohesionPair[] = (companyData.cohesionPairs || [])
    .map((p) => {
      // Use exact name match only — no fuzzy fallback
      const e1Id = execIds.get(p.exec1Name);
      const e2Id = execIds.get(p.exec2Name);
      if (!e1Id || !e2Id) return null;
      return {
        executive1Id: e1Id,
        executive2Id: e2Id,
        yearsWorkedTogether: p.yearsWorkedTogether,
        sharedCompanies: p.sharedCompanies,
      };
    })
    .filter(Boolean) as CohesionPair[];

  const overallScores: DimensionScore[] = scoringResult.scores || makeFallbackScores();

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const compositeScore = totalWeight > 0
    ? Math.round(overallScores.reduce((sum, s) => sum + s.score * (weights[s.dimension] || 20), 0) / totalWeight)
    : 0;

  return {
    id: crypto.randomUUID(),
    companyName: companyData.companyName,
    ticker: companyData.ticker,
    evaluatedAt: new Date().toISOString(),
    executives,
    boardMembers,
    cohesionPairs,
    overallScores,
    compositeScore,
    weights,
    aiResearchSummary: scoringResult.summary,
  };
}

// findClosestMatch removed — all cohesion mapping is now exact-name or ID-based

function makeFallbackScores(): DimensionScore[] {
  const dims: ScoringDimension[] = ['tenure_stability', 'execution_track_record', 'capital_allocation', 'insider_alignment', 'team_cohesion'];
  return dims.map(d => ({
    dimension: d,
    score: 50,
    reasoning: 'Score pending detailed analysis.',
    dataPoints: [],
  }));
}

export async function evaluateCompany(
  companyName: string,
  weights: typeof DEFAULT_WEIGHTS,
  onStatusChange: (status: string) => void
): Promise<CompanyEvaluation> {
  onStatusChange('researching_executives');

  // Simulate progress steps while the single edge function does all the work
  const progressTimer = setInterval(() => {
    // Auto-advance status to give user visibility
  }, 1000);

  let progressStep = 0;
  const stepInterval = setInterval(() => {
    progressStep++;
    if (progressStep === 1) onStatusChange('analyzing_financials');
    else if (progressStep === 2) onStatusChange('evaluating_cohesion');
    else if (progressStep === 3) onStatusChange('scoring_team');
  }, 8000);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s client timeout

    const { data, error } = await supabase.functions.invoke('evaluate-management', {
      body: { companyName },
    });

    clearTimeout(timeoutId);
    clearInterval(progressTimer);
    clearInterval(stepInterval);

    if (error) {
      console.error('Edge function error:', error);
      let message = 'Failed to send a request to the Edge Function';
      if (data?.error) {
        message = data.error;
      } else if (error.message) {
        message = error.message;
      }
      // Provide better error for timeout/network failures
      if (message.includes('Failed to send') || message.includes('fetch')) {
        message = 'The analysis timed out. This can happen with lesser-known companies. Please try again.';
      }
      throw new Error(message);
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Evaluation failed. Please try again.');
    }

    onStatusChange('scoring_team');

    const evaluation = transformToEvaluation(data.companyData, data.scoringResult, weights);

    onStatusChange('complete');
    return evaluation;
  } catch (e) {
    clearInterval(progressTimer);
    clearInterval(stepInterval);
    throw e;
  }
}
