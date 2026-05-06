import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Executive, CohesionPair, EnrichedCohesionPair, CohesionStatus } from '@/types/evaluation';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, CheckCircle2, XCircle, HelpCircle, Info } from 'lucide-react';
import { getShortExecutiveLabel, isLikelyPersonName, filterOperatingExecutives } from '@/lib/executive-sanitizer';

interface Props {
  executives: Executive[];
  cohesionPairs: CohesionPair[];
  enrichedCohesion?: EnrichedCohesionPair[];
  companyName: string;
  onEnrichmentComplete: (pairs: EnrichedCohesionPair[]) => void;
}

const statusConfig: Record<CohesionStatus, { icon: typeof CheckCircle2; label: string; color: string; bg: string }> = {
  confirmed_overlap: { icon: CheckCircle2, label: 'Prior Shared History', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  current_only_overlap: { icon: CheckCircle2, label: 'Current Co-tenure Only', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  confirmed_no_overlap: { icon: XCircle, label: 'No Overlap', color: 'text-muted-foreground', bg: 'bg-muted/50' },
  unknown: { icon: HelpCircle, label: 'Unknown', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
};

export const CohesionPanel = ({ executives, cohesionPairs, enrichedCohesion, companyName, onEnrichmentComplete }: Props) => {
  const [isEnriching, setIsEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasEnrichedData = enrichedCohesion && enrichedCohesion.length > 0;

  // Clean executives: valid person names → operating executives only → slice to 8
  const cleanExecs = useMemo(() => {
    const validNamed = executives.filter(e => isLikelyPersonName(e.name));
    const operating = filterOperatingExecutives(validNamed);
    return operating.slice(0, 8);
  }, [executives]);

  const n = cleanExecs.length;
  const expectedPairCount = n * (n - 1) / 2;

  // Build enriched pair map keyed by IDs
  const enrichedMap = useMemo(() => {
    const map = new Map<string, EnrichedCohesionPair>();
    if (hasEnrichedData) {
      const execIds = new Set(cleanExecs.map(e => e.id));
      for (const pair of enrichedCohesion!) {
        if (!execIds.has(pair.executive1Id) || !execIds.has(pair.executive2Id)) continue;
        map.set(`${pair.executive1Id}-${pair.executive2Id}`, pair);
        map.set(`${pair.executive2Id}-${pair.executive1Id}`, pair);
      }
    }
    return map;
  }, [hasEnrichedData, enrichedCohesion, cleanExecs]);

  // Build basic pair map
  const pairMap = useMemo(() => {
    const map = new Map<string, CohesionPair>();
    for (const pair of cohesionPairs) {
      map.set(`${pair.executive1Id}-${pair.executive2Id}`, pair);
      map.set(`${pair.executive2Id}-${pair.executive1Id}`, pair);
    }
    return map;
  }, [cohesionPairs]);

  // Average prior shared history from enriched data only
  const avgCohesion = useMemo(() => {
    if (hasEnrichedData) {
      const withPrior = enrichedCohesion!.filter(p => p.status === 'confirmed_overlap' && (p.priorSharedHistoryYears || 0) > 0);
      if (withPrior.length === 0) return '0';
      return (withPrior.reduce((sum, p) => sum + (p.priorSharedHistoryYears || 0), 0) / withPrior.length).toFixed(1);
    }
    if (cohesionPairs.length === 0) return '0';
    return (cohesionPairs.reduce((sum, p) => sum + p.yearsWorkedTogether, 0) / cohesionPairs.length).toFixed(1);
  }, [hasEnrichedData, enrichedCohesion, cohesionPairs]);

  // Coverage metrics anchored to expected pair count
  const coverage = useMemo(() => {
    if (!hasEnrichedData) return null;
    const priorOverlap = enrichedCohesion!.filter(p => p.status === 'confirmed_overlap').length;
    const currentOnly = enrichedCohesion!.filter(p => p.status === 'current_only_overlap').length;
    const noOverlap = enrichedCohesion!.filter(p => p.status === 'confirmed_no_overlap').length;
    const unknown = enrichedCohesion!.filter(p => p.status === 'unknown').length;
    return { expected: expectedPairCount, total: enrichedCohesion!.length, priorOverlap, currentOnly, noOverlap, unknown };
  }, [hasEnrichedData, enrichedCohesion, expectedPairCount]);

  const handleEnrich = useCallback(async () => {
    setIsEnriching(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('enrich-cohesion', {
        body: {
          companyName,
          executives: cleanExecs.map(e => ({ id: e.id, name: e.name, title: e.title, tenureYears: e.tenureYears })),
        },
      });

      if (fnError || !data?.success) {
        throw new Error(data?.error || fnError?.message || 'Enrichment failed');
      }

      // Strictly trust IDs from backend — no fuzzy name remapping
      const execIdSet = new Set(cleanExecs.map(e => e.id));
      const enriched: EnrichedCohesionPair[] = (data.pairs || [])
        .filter((p: any) => execIdSet.has(p.executive1Id) && execIdSet.has(p.executive2Id) && p.executive1Id !== p.executive2Id)
        .map((p: any) => ({
          exec1Name: p.exec1Name || '',
          exec2Name: p.exec2Name || '',
          executive1Id: p.executive1Id,
          executive2Id: p.executive2Id,
          status: p.status || 'unknown',
          yearsWorkedTogether: typeof p.yearsWorkedTogether === 'number' ? p.yearsWorkedTogether : 0,
          sharedCompanies: Array.isArray(p.sharedCompanies) ? p.sharedCompanies : [],
          overlapPeriod: p.overlapPeriod || '',
          confidence: p.confidence || 'low',
          evidenceSummary: p.evidenceSummary || '',
          sourceLabel: p.sourceLabel || '',
          isSyntheticFallback: p.isSyntheticFallback || false,
          currentCompanyOverlapYears: typeof p.currentCompanyOverlapYears === 'number' ? p.currentCompanyOverlapYears : undefined,
          priorSharedHistoryYears: typeof p.priorSharedHistoryYears === 'number' ? p.priorSharedHistoryYears : undefined,
        }));

      onEnrichmentComplete(enriched);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enrichment failed');
    } finally {
      setIsEnriching(false);
    }
  }, [companyName, cleanExecs, onEnrichmentComplete]);

  // Get cell data — in enriched mode, never fall back to basic pairs
  const getCellData = useCallback((rowExec: Executive, colExec: Executive) => {
    if (hasEnrichedData) {
      const pair = enrichedMap.get(`${rowExec.id}-${colExec.id}`);
      if (pair) return { type: 'enriched' as const, pair };
      return {
        type: 'enriched' as const,
        pair: {
          executive1Id: rowExec.id,
          executive2Id: colExec.id,
          exec1Name: rowExec.name,
          exec2Name: colExec.name,
          status: 'unknown' as CohesionStatus,
          yearsWorkedTogether: 0,
          sharedCompanies: [],
          overlapPeriod: '',
          confidence: 'low' as const,
          evidenceSummary: '',
          sourceLabel: '',
          isSyntheticFallback: true,
        } satisfies EnrichedCohesionPair,
      };
    }
    const basic = pairMap.get(`${rowExec.id}-${colExec.id}`);
    return { type: 'basic' as const, pair: basic || null };
  }, [hasEnrichedData, enrichedMap, pairMap]);

  // Helper to render overlap display — distinguish prior vs current
  const renderOverlapCell = (pair: EnrichedCohesionPair) => {
    const prior = pair.priorSharedHistoryYears || 0;
    const current = pair.currentCompanyOverlapYears || 0;
    if (pair.status === 'confirmed_overlap') {
      return (
        <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
          {prior || '✓'}
        </span>
      );
    }
    if (pair.status === 'current_only_overlap') {
      return (
        <span className="font-mono text-blue-500 dark:text-blue-400 text-[10px]">
          {current || 'co'}
        </span>
      );
    }
    return pair.status === 'unknown' ? '?' : '–';
  };

  return (
    <div className="space-y-4">
      {/* Enrich button */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Deep Cohesion Analysis</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {hasEnrichedData
                  ? 'Enriched data loaded — showing verified pairwise relationships'
                  : 'Click to research detailed pairwise working history with evidence'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasEnrichedData ? (
                <Button variant="outline" size="sm" onClick={handleEnrich} disabled={isEnriching}>
                  {isEnriching ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Search className="h-3 w-3 mr-1" />}
                  Re-enrich
                </Button>
              ) : (
                <Button size="sm" onClick={handleEnrich} disabled={isEnriching}>
                  {isEnriching ? (
                    <><Loader2 className="h-3 w-3 animate-spin mr-1" />Researching relationships…</>
                  ) : (
                    <><Search className="h-3 w-3 mr-1" />Enrich Cohesion Data</>
                  )}
                </Button>
              )}
            </div>
          </div>
          {error && <p className="text-xs text-destructive mt-2">{error}</p>}
          {isEnriching && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary/60 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
              Searching career histories & cross-referencing sources…
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coverage metrics */}
      {coverage && (
        <div className="grid grid-cols-5 gap-3">
          <Card><CardContent className="p-3 text-center">
            <div className="text-lg font-bold font-mono">{coverage.expected}</div>
            <div className="text-xs text-muted-foreground">Expected</div>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <div className="text-lg font-bold font-mono text-emerald-600">{coverage.priorOverlap}</div>
            <div className="text-xs text-muted-foreground">Prior Overlap</div>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <div className="text-lg font-bold font-mono text-blue-500">{coverage.currentOnly}</div>
            <div className="text-xs text-muted-foreground">Current Only</div>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <div className="text-lg font-bold font-mono">{coverage.noOverlap}</div>
            <div className="text-xs text-muted-foreground">No Overlap</div>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <div className="text-lg font-bold font-mono text-amber-600">{coverage.unknown}</div>
            <div className="text-xs text-muted-foreground">Unknown</div>
          </CardContent></Card>
        </div>
      )}

      {/* Matrix */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Team Cohesion Matrix</h3>
            <div className="text-xs text-muted-foreground">
              Avg prior shared history: <span className="font-mono font-semibold text-foreground">{avgCohesion} years</span>
              {hasEnrichedData && <span className="ml-1">(prior overlap only)</span>}
            </div>
          </div>
          {cleanExecs.length < 2 ? (
            <p className="text-xs text-muted-foreground">Not enough operating executives to build a cohesion matrix.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="p-1 text-left font-medium text-muted-foreground w-24" />
                    {cleanExecs.map(e => (
                      <th key={e.id} className="p-1 text-center font-medium text-muted-foreground w-16">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="truncate block w-16 cursor-help">{getShortExecutiveLabel(e.name)}</span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs font-medium">{e.name}</p>
                            <p className="text-xs text-muted-foreground">{e.title}</p>
                          </TooltipContent>
                        </Tooltip>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cleanExecs.map(rowExec => (
                    <tr key={rowExec.id}>
                      <td className="p-1 font-medium truncate max-w-[96px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">{getShortExecutiveLabel(rowExec.name)}</span>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p className="text-xs font-medium">{rowExec.name}</p>
                            <p className="text-xs text-muted-foreground">{rowExec.title}</p>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      {cleanExecs.map(colExec => {
                        if (rowExec.id === colExec.id) {
                          return <td key={colExec.id} className="p-1 text-center"><span className="block w-8 h-8 mx-auto rounded bg-muted" /></td>;
                        }

                        const cellData = getCellData(rowExec, colExec);

                        if (cellData.type === 'enriched') {
                          const ep = cellData.pair;
                          const cfg = statusConfig[ep.status];
                          const StatusIcon = cfg.icon;
                          const prior = ep.priorSharedHistoryYears || 0;
                          return (
                            <td key={colExec.id} className="p-1 text-center">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`flex items-center justify-center w-8 h-8 mx-auto rounded text-xs font-mono cursor-help ${cfg.bg} ${prior > 0 ? 'ring-1 ring-emerald-400/50' : ''}`}>
                                    {renderOverlapCell(ep)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs text-left">
                                  <div className="space-y-1">
                                    <div className={`flex items-center gap-1 font-semibold text-xs ${cfg.color}`}>
                                      <StatusIcon className="h-3 w-3" />
                                      {cfg.label}
                                    </div>
                                    {(ep.priorSharedHistoryYears || 0) > 0 && (
                                      <p className="text-xs font-medium text-emerald-600">
                                        Prior shared history: {ep.priorSharedHistoryYears}y
                                      </p>
                                    )}
                                    {(ep.currentCompanyOverlapYears || 0) > 0 && (
                                      <p className="text-xs text-muted-foreground">
                                        Current co-tenure: {ep.currentCompanyOverlapYears}y
                                      </p>
                                    )}
                                    {ep.evidenceSummary && <p className="text-xs">{ep.evidenceSummary}</p>}
                                    {ep.sharedCompanies.length > 0 && (
                                      <p className="text-xs text-muted-foreground">At: {ep.sharedCompanies.join(', ')}</p>
                                    )}
                                    {ep.overlapPeriod && (
                                      <p className="text-xs text-muted-foreground">Period: {ep.overlapPeriod}</p>
                                    )}
                                    <div className="flex items-center gap-2 pt-1">
                                      <Badge variant="outline" className="text-[10px] px-1 py-0">{ep.confidence}</Badge>
                                      {ep.sourceLabel && <span className="text-[10px] text-muted-foreground">{ep.sourceLabel}</span>}
                                      {ep.isSyntheticFallback && <span className="text-[10px] text-muted-foreground italic">No data available</span>}
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          );
                        }

                        // Basic mode
                        const basicPair = cellData.pair;
                        const years = basicPair?.yearsWorkedTogether;
                        const opacity = years ? Math.min(years / 10, 1) : 0;
                        return (
                          <td key={colExec.id} className="p-1 text-center">
                            <span
                              className="flex items-center justify-center w-8 h-8 mx-auto rounded text-xs font-mono"
                              style={{ backgroundColor: years ? `hsl(var(--primary) / ${0.1 + opacity * 0.4})` : undefined }}
                              title={basicPair ? `${years}y together at ${basicPair.sharedCompanies.join(', ')}` : 'No overlap data'}
                            >
                              {years ? years.toFixed(0) : '–'}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Strongest relationships — prioritize prior shared history */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-3">
            Strongest Working Relationships
            {hasEnrichedData && <Badge variant="outline" className="ml-2 text-[10px] font-normal">Enriched</Badge>}
          </h3>
          <div className="space-y-2">
            {hasEnrichedData ? (
              enrichedCohesion!
                .filter(p => p.status === 'confirmed_overlap' && (p.priorSharedHistoryYears || 0) > 0)
                .sort((a, b) => (b.priorSharedHistoryYears || 0) - (a.priorSharedHistoryYears || 0))
                .slice(0, 6)
                .map((pair, i) => (
                    <Tooltip key={i}>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-3 text-sm cursor-help hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-colors">
                          <span className="font-medium">{pair.exec1Name}</span>
                          <span className="text-muted-foreground">×</span>
                          <span className="font-medium">{pair.exec2Name}</span>
                          <span className="ml-auto flex items-center gap-2">
                            <Badge className="text-[10px] px-1 py-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                              {pair.priorSharedHistoryYears}y prior
                            </Badge>
                            <Badge variant="outline" className="text-[10px] px-1 py-0">{pair.confidence}</Badge>
                            {pair.sharedCompanies.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                at {pair.sharedCompanies.filter(c => c !== companyName).join(', ') || pair.sharedCompanies.join(', ')}
                              </span>
                            )}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-sm">
                        <p className="text-xs">{pair.evidenceSummary || 'No details available'}</p>
                        {pair.overlapPeriod && <p className="text-xs text-muted-foreground mt-1">Period: {pair.overlapPeriod}</p>}
                        {pair.sourceLabel && <p className="text-xs text-muted-foreground">Source: {pair.sourceLabel}</p>}
                      </TooltipContent>
                    </Tooltip>
                  ))
            ) : (
              cohesionPairs
                .sort((a, b) => b.yearsWorkedTogether - a.yearsWorkedTogether)
                .slice(0, 5)
                .map((pair, i) => {
                  const e1 = executives.find(e => e.id === pair.executive1Id);
                  const e2 = executives.find(e => e.id === pair.executive2Id);
                  return (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="font-medium">{e1?.name}</span>
                      <span className="text-muted-foreground">×</span>
                      <span className="font-medium">{e2?.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {pair.yearsWorkedTogether}y at {pair.sharedCompanies.join(', ')}
                      </span>
                    </div>
                  );
                })
            )}
            {hasEnrichedData && enrichedCohesion!.filter(p => p.status === 'confirmed_overlap').length === 0 && (
              <p className="text-xs text-muted-foreground">No confirmed overlaps found.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Unknown pairs note */}
      {coverage && coverage.unknown > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-xs font-semibold">Incomplete Data</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {coverage.unknown} of {coverage.expected} pair{coverage.expected > 1 ? 's' : ''} could not be verified.
                  Marked with "?" and excluded from strongest relationships.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
