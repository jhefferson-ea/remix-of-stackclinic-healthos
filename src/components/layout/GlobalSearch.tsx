import { useState, useEffect, useRef } from 'react';
import { Search, Users, LayoutDashboard, Calendar, Bot, DollarSign, Megaphone, FolderOpen, Gift, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, type Patient } from '@/services/api';
import { cn } from '@/lib/utils';

const navigationItems = [
  { name: 'Dashboard', href: '/app', icon: LayoutDashboard },
  { name: 'Agenda', href: '/app/agenda', icon: Calendar },
  { name: 'Pacientes', href: '/app/pacientes', icon: Users },
  { name: 'Central IA', href: '/app/ia-config', icon: Bot },
  { name: 'Financeiro', href: '/app/financeiro', icon: DollarSign },
  { name: 'Marketing', href: '/app/marketing', icon: Megaphone },
  { name: 'Biblioteca', href: '/app/biblioteca', icon: FolderOpen },
  { name: 'Parceiros', href: '/app/parceiros', icon: Gift },
  { name: 'Configurações', href: '/app/config', icon: Settings },
];

interface SearchResult {
  type: 'patient' | 'page';
  id: number | string;
  name: string;
  subtitle?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Load patients on mount
  useEffect(() => {
    api.getPatients().then((res) => {
      if (res.success && res.data) {
        setPatients(res.data);
      }
    });
  }, []);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search logic
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    const lowerQuery = query.toLowerCase();

    // Search patients
    const matchedPatients: SearchResult[] = patients
      .filter((p) => p.name.toLowerCase().includes(lowerQuery) || p.phone?.includes(query))
      .slice(0, 5)
      .map((p) => ({
        type: 'patient',
        id: p.id,
        name: p.name,
        subtitle: p.phone,
        href: `/app/pacientes/${p.id}`,
        icon: Users,
      }));

    // Search pages
    const matchedPages: SearchResult[] = navigationItems
      .filter((item) => item.name.toLowerCase().includes(lowerQuery))
      .map((item) => ({
        type: 'page',
        id: item.href,
        name: item.name,
        subtitle: 'Página',
        href: item.href,
        icon: item.icon,
      }));

    setResults([...matchedPatients, ...matchedPages]);
    setSelectedIndex(0);
    setIsLoading(false);
  }, [query, patients]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.href);
    setQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 w-64">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar pacientes, telas..."
          className="bg-transparent border-none outline-none text-sm flex-1 placeholder:text-muted-foreground"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Results dropdown */}
      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Buscando...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Nenhum resultado encontrado
            </div>
          ) : (
            <ul className="py-1 max-h-80 overflow-y-auto">
              {results.map((result, index) => (
                <li key={`${result.type}-${result.id}`}>
                  <button
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      index === selectedIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted'
                    )}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div
                      className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center',
                        result.type === 'patient' ? 'bg-primary/10' : 'bg-muted'
                      )}
                    >
                      <result.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{result.name}</p>
                      {result.subtitle && (
                        <p className="text-xs text-muted-foreground">{result.subtitle}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground capitalize">
                      {result.type === 'patient' ? 'Paciente' : 'Tela'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
