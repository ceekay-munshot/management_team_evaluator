import { CompanyEvaluation, Executive, BoardMember, CohesionPair, DimensionScore, ScoringDimension, DEFAULT_WEIGHTS } from '@/types/evaluation';

function uuid() {
  return crypto.randomUUID();
}

const EXEC_TEMPLATES = [
  { title: 'Chief Executive Officer', reportsTo: null },
  { title: 'Chief Financial Officer', reportsTo: 0 },
  { title: 'Chief Operating Officer', reportsTo: 0 },
  { title: 'Chief Technology Officer', reportsTo: 0 },
  { title: 'Chief Marketing Officer', reportsTo: 2 },
  { title: 'Chief People Officer', reportsTo: 0 },
  { title: 'EVP, Product', reportsTo: 3 },
  { title: 'EVP, Sales', reportsTo: 2 },
  { title: 'General Counsel', reportsTo: 0 },
  { title: 'SVP, Strategy', reportsTo: 0 },
];

const FIRST_NAMES = ['James', 'Sarah', 'Michael', 'Jennifer', 'Robert', 'Maria', 'David', 'Lisa', 'Richard', 'Amanda'];
const LAST_NAMES = ['Mitchell', 'Chen', 'Patel', 'Williams', 'Rodriguez', 'Thompson', 'Nakamura', 'Anderson', 'Kim', 'Foster'];

function randomScore(): number {
  return Math.floor(40 + Math.random() * 55);
}

function makeDimensionScores(): DimensionScore[] {
  const dims: ScoringDimension[] = ['tenure_stability', 'execution_track_record', 'capital_allocation', 'insider_alignment', 'team_cohesion'];
  return dims.map(dimension => ({
    dimension,
    score: randomScore(),
    reasoning: `AI-estimated score based on publicly available data analysis for this dimension.`,
    dataPoints: ['SEC filings analysis', 'Public financial reports', 'Press releases'],
  }));
}

export function generateMockEvaluation(companyName: string): CompanyEvaluation {
  const ticker = companyName.slice(0, 4).toUpperCase();
  const execIds = EXEC_TEMPLATES.map(() => uuid());

  const executives: Executive[] = EXEC_TEMPLATES.map((tmpl, i) => ({
    id: execIds[i],
    name: `${FIRST_NAMES[i]} ${LAST_NAMES[i]}`,
    title: tmpl.title,
    age: 42 + Math.floor(Math.random() * 20),
    tenureYears: Math.round((1 + Math.random() * 14) * 10) / 10,
    reportsTo: tmpl.reportsTo !== null ? execIds[tmpl.reportsTo] : undefined,
    priorRoles: [
      { company: 'Previous Corp', title: 'VP Operations', years: '2015–2019' },
      { company: 'Earlier Inc', title: 'Director', years: '2011–2015' },
    ],
    achievements: [
      'Led successful digital transformation initiative',
      'Drove 15% revenue growth in first year',
    ],
    financialMetrics: {
      revenueGrowth: `${(5 + Math.random() * 20).toFixed(1)}%`,
      marginTrend: `+${(0.5 + Math.random() * 3).toFixed(1)}pp`,
      roic: `${(8 + Math.random() * 12).toFixed(1)}%`,
    },
    ownershipStake: `${(0.01 + Math.random() * 2).toFixed(2)}%`,
    insiderTransactions: Math.random() > 0.5 ? 'Net buyer (last 12 months)' : 'No significant transactions',
    scores: makeDimensionScores(),
    compositeScore: 0, // will be recalculated
  }));

  const boardMembers: BoardMember[] = Array.from({ length: 8 }, (_, i) => ({
    id: uuid(),
    name: `Board Member ${i + 1}`,
    title: i === 0 ? 'Chairman' : 'Independent Director',
    background: `Former CEO at Industry Corp. ${20 + i} years of experience in technology and finance.`,
    otherBoards: [`Company ${String.fromCharCode(65 + i)}`, `Company ${String.fromCharCode(75 + i)}`],
    crossRelationships: i < 3 ? [`Served with ${executives[0].name} at Previous Corp`] : [],
    tenure: `${1 + Math.floor(Math.random() * 10)} years`,
  }));

  const cohesionPairs: CohesionPair[] = [];
  for (let i = 0; i < executives.length; i++) {
    for (let j = i + 1; j < executives.length; j++) {
      if (Math.random() > 0.6) {
        cohesionPairs.push({
          executive1Id: execIds[i],
          executive2Id: execIds[j],
          yearsWorkedTogether: Math.round((1 + Math.random() * 8) * 10) / 10,
          sharedCompanies: Math.random() > 0.5 ? [companyName, 'Previous Corp'] : [companyName],
        });
      }
    }
  }

  const overallScores = makeDimensionScores();

  return {
    id: uuid(),
    companyName,
    ticker,
    evaluatedAt: new Date().toISOString(),
    executives,
    boardMembers,
    cohesionPairs,
    overallScores,
    compositeScore: 0,
    weights: DEFAULT_WEIGHTS,
  };
}
