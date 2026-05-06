import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { searchCompanies, type BirdnestResult } from '@/lib/birdnest';

interface CompanySearchProps {
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (result: BirdnestResult) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export function CompanySearch({
  value,
  onValueChange,
  onSelect,
  placeholder = 'Company name (e.g. Reliance)',
  className,
  inputClassName,
}: CompanySearchProps) {
  const [results, setResults] = useState<BirdnestResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 1) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const reqId = ++requestIdRef.current;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const data = await searchCompanies(trimmed);
        if (requestIdRef.current !== reqId) return;
        setResults(data);
        setError(null);
        setActiveIdx(-1);
      } catch (e) {
        if (requestIdRef.current !== reqId) return;
        setResults([]);
        setError((e as Error).message || 'Search failed');
      } finally {
        if (requestIdRef.current === reqId) setLoading(false);
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (r: BirdnestResult) => {
    onSelect(r);
    setOpen(false);
    setActiveIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(results[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showDropdown =
    open && value.trim().length > 0 && (loading || error || results.length > 0 || value.trim().length >= 1);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Input
        value={value}
        onChange={e => {
          onValueChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={cn('h-11 bg-card', inputClassName)}
      />

      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border border-border bg-popover shadow-lg overflow-hidden">
          <div className="max-h-72 overflow-y-auto py-1">
            {results.length === 0 && !loading && !error && (
              <div className="px-3 py-3 text-xs text-muted-foreground">No matches found.</div>
            )}
            {error && !loading && (
              <div className="px-3 py-3 text-xs text-destructive">{error}</div>
            )}
            {results.map((r, idx) => (
              <button
                key={`${r.ticker}-${idx}`}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => handleSelect(r)}
                onMouseEnter={() => setActiveIdx(idx)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors',
                  idx === activeIdx ? 'bg-muted' : 'hover:bg-muted/60',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.industry || r.country}</p>
                </div>
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded shrink-0">
                  {r.ticker}
                  {r.country && <span className="text-primary/60"> · {r.country}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
