export type ScoringDimension = 
  | 'tenure_stability'
  | 'execution_track_record'
  | 'capital_allocation'
  | 'insider_alignment'
  | 'team_cohesion';

export const DIMENSION_LABELS: Record<ScoringDimension, string> = {
  tenure_stability: 'Tenure & Stability',
  execution_track_record: 'Execution Track Record',
  capital_allocation: 'Capital Allocation',
  insider_alignment: 'Insider Alignment',
  team_cohesion: 'Team Cohesion',
};

export const DIMENSION_DESCRIPTIONS: Record<ScoringDimension, string> = {
  tenure_stability: 'Average tenure of top executives and management turnover rate',
  execution_track_record: 'Revenue and margin growth during their leadership tenure',
  capital_allocation: 'Investment discipline, ROIC trends, and capital deployment',
  insider_alignment: 'Ownership stakes, insider buying/selling activity',
  team_cohesion: 'How long the top team has worked together across companies',
};

export interface ScoringWeights {
  tenure_stability: number;
  execution_track_record: number;
  capital_allocation: number;
  insider_alignment: number;
  team_cohesion: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  tenure_stability: 20,
  execution_track_record: 25,
  capital_allocation: 20,
  insider_alignment: 15,
  team_cohesion: 20,
};

export interface WeightPreset {
  name: string;
  description: string;
  weights: ScoringWeights;
}

export const WEIGHT_PRESETS: WeightPreset[] = [
  {
    name: 'Balanced',
    description: 'Equal emphasis across all dimensions',
    weights: { tenure_stability: 20, execution_track_record: 20, capital_allocation: 20, insider_alignment: 20, team_cohesion: 20 },
  },
  {
    name: 'Growth Focus',
    description: 'Emphasizes execution and capital allocation',
    weights: { tenure_stability: 10, execution_track_record: 35, capital_allocation: 30, insider_alignment: 10, team_cohesion: 15 },
  },
  {
    name: 'Stability Focus',
    description: 'Emphasizes tenure, cohesion, and insider alignment',
    weights: { tenure_stability: 30, execution_track_record: 15, capital_allocation: 10, insider_alignment: 25, team_cohesion: 20 },
  },
  {
    name: 'Activist Lens',
    description: 'Heavy weight on insider alignment and capital allocation',
    weights: { tenure_stability: 10, execution_track_record: 20, capital_allocation: 30, insider_alignment: 30, team_cohesion: 10 },
  },
];

export interface DimensionScore {
  dimension: ScoringDimension;
  score: number; // 0-100
  reasoning: string;
  dataPoints: string[];
}

export interface Executive {
  id: string;
  name: string;
  title: string;
  age?: number;
  tenureYears: number;
  reportsTo?: string; // id of manager
  priorRoles: PriorRole[];
  achievements: string[];
  financialMetrics: FinancialMetrics;
  ownershipStake?: string;
  insiderTransactions?: string;
  scores: DimensionScore[];
  compositeScore: number;
  photoUrl?: string;
}

export interface PriorRole {
  company: string;
  title: string;
  years: string;
}

export interface FinancialMetrics {
  revenueGrowth?: string;
  marginTrend?: string;
  roic?: string;
  notableMetrics?: string[];
}

export interface BoardMember {
  id: string;
  name: string;
  title: string;
  background: string;
  otherBoards: string[];
  crossRelationships: string[];
  tenure: string;
}

export interface CohesionPair {
  executive1Id: string;
  executive2Id: string;
  yearsWorkedTogether: number;
  sharedCompanies: string[];
}

export type CohesionStatus = 'confirmed_overlap' | 'current_only_overlap' | 'confirmed_no_overlap' | 'unknown';
export type CohesionConfidence = 'high' | 'medium' | 'low';

export interface EnrichedCohesionPair {
  exec1Name: string;
  exec2Name: string;
  executive1Id: string;
  executive2Id: string;
  status: CohesionStatus;
  yearsWorkedTogether: number;
  sharedCompanies: string[];
  overlapPeriod: string;
  confidence: CohesionConfidence;
  evidenceSummary: string;
  sourceLabel: string;
  sourceType?: 'simplywallst' | 'official' | 'other';
  sourceUrl?: string;
  isSyntheticFallback?: boolean;
  currentCompanyOverlapYears?: number;
  priorSharedHistoryYears?: number;
}

export interface CompanyEvaluation {
  id: string;
  companyName: string;
  ticker: string;
  evaluatedAt: string;
  executives: Executive[];
  boardMembers: BoardMember[];
  cohesionPairs: CohesionPair[];
  enrichedCohesion?: EnrichedCohesionPair[];
  overallScores: DimensionScore[];
  compositeScore: number;
  weights: ScoringWeights;
  aiResearchSummary?: string;
}

export interface SavedEvaluation {
  id: string;
  companyName: string;
  ticker: string;
  evaluatedAt: string;
  compositeScore: number;
}

export type EvaluationStatus = 
  | 'idle'
  | 'researching_executives'
  | 'analyzing_financials'
  | 'evaluating_cohesion'
  | 'scoring_team'
  | 'complete'
  | 'error';
