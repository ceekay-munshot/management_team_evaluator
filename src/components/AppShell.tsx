import { useState, createContext, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  GitBranch,
  Users,
  Link2,
  Shield,
  SlidersHorizontal,
  AlertTriangle,
  FileText,
  Menu,
  Moon,
  Sun,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export type NavSection =
  | 'overview'
  | 'org-chart'
  | 'executives'
  | 'cohesion'
  | 'board'
  | 'scoring'
  | 'risks'
  | 'notes';

interface AppShellContextType {
  activeSection: NavSection;
  setActiveSection: (s: NavSection) => void;
  hasEvaluation: boolean;
  companyName: string;
  ticker: string;
}

const AppShellContext = createContext<AppShellContextType>({
  activeSection: 'overview',
  setActiveSection: () => {},
  hasEvaluation: false,
  companyName: '',
  ticker: '',
});

export const useAppShell = () => useContext(AppShellContext);

const NAV_ITEMS: { id: NavSection; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'org-chart', label: 'Org Chart', icon: <GitBranch className="h-4 w-4" /> },
  { id: 'executives', label: 'Executives', icon: <Users className="h-4 w-4" /> },
  { id: 'cohesion', label: 'Team Cohesion', icon: <Link2 className="h-4 w-4" /> },
  { id: 'board', label: 'Board & Governance', icon: <Shield className="h-4 w-4" /> },
  { id: 'scoring', label: 'Scoring Model', icon: <SlidersHorizontal className="h-4 w-4" /> },
  { id: 'risks', label: 'Risks & Flags', icon: <AlertTriangle className="h-4 w-4" /> },
  { id: 'notes', label: 'Notes & Exports', icon: <FileText className="h-4 w-4" /> },
];

interface AppShellProps {
  children: React.ReactNode;
  hasEvaluation?: boolean;
  companyName?: string;
  ticker?: string;
}

export const AppShell = ({ children, hasEvaluation = false, companyName = '', ticker = '' }: AppShellProps) => {
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleDark = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <AppShellContext.Provider value={{ activeSection, setActiveSection, hasEvaluation, companyName, ticker }}>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            'flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 border-r border-sidebar-border',
            sidebarOpen ? 'w-56' : 'w-0 overflow-hidden'
          )}
        >
          {/* Brand */}
          <div className="flex items-center gap-2 px-4 h-14 border-b border-sidebar-border shrink-0">
            <div className="h-7 w-7 rounded-md bg-sidebar-primary flex items-center justify-center">
              <span className="text-xs font-bold text-sidebar-primary-foreground">MT</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-sidebar-accent-foreground tracking-wide">MTE</p>
              <p className="text-[10px] text-sidebar-foreground truncate">Mgmt Evaluator</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
            {NAV_ITEMS.map(item => {
              const isActive = activeSection === item.id;
              const isDisabled = !hasEvaluation && item.id !== 'overview';
              return (
                <button
                  key={item.id}
                  disabled={isDisabled}
                  onClick={() => {
                    setActiveSection(item.id);
                    // If on home page and clicking overview, stay
                    if (item.id === 'overview' && location.pathname === '/') return;
                  }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                    isDisabled && 'opacity-30 cursor-not-allowed hover:bg-transparent'
                  )}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between h-14 px-4 border-b bg-card shrink-0">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
              <h1 className="text-base font-semibold truncate">
                {hasEvaluation ? `${companyName} — Management Evaluation` : 'Management Team Evaluator'}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {hasEvaluation && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/')}>
                  ← New Evaluation
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleDark}>
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </AppShellContext.Provider>
  );
};
