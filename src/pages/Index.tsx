import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Trash2, TrendingUp, Users, Shield, BarChart3, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getSavedEvaluations, deleteEvaluation } from '@/lib/storage';
import { getScoreColor } from '@/lib/scoring';
import { AppShell } from '@/components/AppShell';
import { DIMENSION_LABELS, DIMENSION_DESCRIPTIONS, type ScoringDimension } from '@/types/evaluation';

const QUICK_SELECT = [
  { ticker: 'AAPL', name: 'Apple Inc.' },
  { ticker: 'MSFT', name: 'Microsoft Corp.' },
  { ticker: 'TSLA', name: 'Tesla Inc.' },
  { ticker: 'JPM', name: 'JPMorgan Chase' },
  { ticker: 'AMZN', name: 'Amazon.com' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.' },
];

const METHODOLOGY_ITEMS: { icon: React.ReactNode; dimension: ScoringDimension }[] = [
  { icon: <Shield className="h-5 w-5" />, dimension: 'tenure_stability' },
  { icon: <TrendingUp className="h-5 w-5" />, dimension: 'execution_track_record' },
  { icon: <BarChart3 className="h-5 w-5" />, dimension: 'capital_allocation' },
  { icon: <Users className="h-5 w-5" />, dimension: 'insider_alignment' },
  { icon: <Users className="h-5 w-5" />, dimension: 'team_cohesion' },
];

const Index = () => {
  const [companyName, setCompanyName] = useState('');
  const [ticker, setTicker] = useState('');
  const [recentEvals, setRecentEvals] = useState(getSavedEvaluations);
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = companyName.trim() || ticker.trim();
    if (!query) return;
    navigate(`/evaluate?company=${encodeURIComponent(query)}`);
  };

  const handleQuickSelect = (company: typeof QUICK_SELECT[0]) => {
    navigate(`/evaluate?company=${encodeURIComponent(company.name)}`);
  };

  const handleDelete = (id: string) => {
    deleteEvaluation(id);
    setRecentEvals(getSavedEvaluations());
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 mb-2">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Management Team Evaluator
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm">
            Enter a public company name or ticker to generate a comprehensive
            management quality assessment powered by live AI research.
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="flex gap-2 max-w-2xl mx-auto">
          <div className="flex-1 relative">
            <Input
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Company name (e.g. Apple Inc.)"
              className="h-11 bg-card"
            />
          </div>
          <Input
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            placeholder="TICKER"
            className="h-11 w-28 bg-card font-mono text-sm"
          />
          <Button type="submit" className="h-11 gap-2 px-5" disabled={!companyName.trim() && !ticker.trim()}>
            <Search className="h-4 w-4" />
            Evaluate
          </Button>
        </form>

        {/* Quick select */}
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick Select</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {QUICK_SELECT.map(company => (
                <button
                  key={company.ticker}
                  onClick={() => handleQuickSelect(company)}
                  className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm text-left hover:bg-muted/50 hover:border-primary/30 transition-colors"
                >
                  <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    {company.ticker}
                  </span>
                  <span className="truncate text-foreground/80">{company.name}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Disclaimer */}
        <p className="text-center text-xs text-muted-foreground">
          Data sourced via AI-powered live research. Confidence levels reflect data availability.
        </p>

        {/* Recent evaluations */}
        {recentEvals.length > 0 && (
          <div className="max-w-2xl mx-auto space-y-3">
            <h3 className="text-sm font-semibold">Recent Evaluations</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {recentEvals.slice(0, 6).map(ev => (
                <Card
                  key={ev.id}
                  className="group cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/evaluation/${ev.id}`)}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{ev.companyName}</p>
                      <p className="text-xs text-muted-foreground">
                        {ev.ticker} · {new Date(ev.evaluatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xl font-bold font-mono ${getScoreColor(ev.compositeScore)}`}>
                        {ev.compositeScore}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 h-7 w-7"
                        onClick={e => { e.stopPropagation(); handleDelete(ev.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Methodology */}
        <div className="max-w-2xl mx-auto space-y-3">
          <h3 className="text-sm font-semibold text-center">Scoring Methodology</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {METHODOLOGY_ITEMS.map(item => (
              <Card key={item.dimension} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                      {item.icon}
                    </div>
                    <h4 className="font-semibold text-xs">{DIMENSION_LABELS[item.dimension]}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{DIMENSION_DESCRIPTIONS[item.dimension]}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Index;
