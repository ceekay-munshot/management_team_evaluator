import { CompanyEvaluation, SavedEvaluation, ScoringWeights, DEFAULT_WEIGHTS } from '@/types/evaluation';

const EVALUATIONS_KEY = 'mgmt-evaluator-evaluations';
const WEIGHTS_KEY = 'mgmt-evaluator-weights';

export function getSavedEvaluations(): SavedEvaluation[] {
  try {
    const raw = localStorage.getItem(EVALUATIONS_KEY);
    if (!raw) return [];
    const evaluations: CompanyEvaluation[] = JSON.parse(raw);
    return evaluations.map(e => ({
      id: e.id,
      companyName: e.companyName,
      ticker: e.ticker,
      evaluatedAt: e.evaluatedAt,
      compositeScore: e.compositeScore,
    })).sort((a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime());
  } catch {
    return [];
  }
}

export function getFullEvaluation(id: string): CompanyEvaluation | null {
  try {
    const raw = localStorage.getItem(EVALUATIONS_KEY);
    if (!raw) return null;
    const evaluations: CompanyEvaluation[] = JSON.parse(raw);
    return evaluations.find(e => e.id === id) ?? null;
  } catch {
    return null;
  }
}

export function saveEvaluation(evaluation: CompanyEvaluation): void {
  try {
    const raw = localStorage.getItem(EVALUATIONS_KEY);
    const evaluations: CompanyEvaluation[] = raw ? JSON.parse(raw) : [];
    const idx = evaluations.findIndex(e => e.id === evaluation.id);
    if (idx >= 0) {
      evaluations[idx] = evaluation;
    } else {
      evaluations.push(evaluation);
    }
    localStorage.setItem(EVALUATIONS_KEY, JSON.stringify(evaluations));
  } catch (e) {
    console.error('Failed to save evaluation', e);
  }
}

export function deleteEvaluation(id: string): void {
  try {
    const raw = localStorage.getItem(EVALUATIONS_KEY);
    if (!raw) return;
    const evaluations: CompanyEvaluation[] = JSON.parse(raw);
    localStorage.setItem(EVALUATIONS_KEY, JSON.stringify(evaluations.filter(e => e.id !== id)));
  } catch (e) {
    console.error('Failed to delete evaluation', e);
  }
}

export function getSavedWeights(): ScoringWeights {
  try {
    const raw = localStorage.getItem(WEIGHTS_KEY);
    if (!raw) return DEFAULT_WEIGHTS;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

export function saveWeights(weights: ScoringWeights): void {
  localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
}
