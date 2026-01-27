import { useState, useEffect } from 'react';
import { Users, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';

interface Professional {
  id: number;
  name: string;
  email: string;
  specialty?: string;
  color?: string;
  role: string;
}

interface ProfessionalFilterProps {
  value: number | null;
  onChange: (value: number | null) => void;
  className?: string;
}

const colorMap: Record<string, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
  cyan: 'bg-cyan-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
};

export function ProfessionalFilter({ value, onChange, className }: ProfessionalFilterProps) {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProfessionals();
  }, []);

  async function loadProfessionals() {
    setIsLoading(true);
    const res = await api.getProfessionals();
    if (res.success && res.data) {
      setProfessionals(res.data);
    }
    setIsLoading(false);
  }

  const handleChange = (val: string) => {
    if (val === 'all') {
      onChange(null);
    } else {
      onChange(parseInt(val));
    }
  };

  const selectedProf = professionals.find(p => p.id === value);

  return (
    <Select 
      value={value?.toString() || 'all'} 
      onValueChange={handleChange}
      disabled={isLoading}
    >
      <SelectTrigger className={cn('w-[200px]', className)}>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <div className="flex items-center gap-2">
            {selectedProf ? (
              <>
                <div className={cn('h-3 w-3 rounded-full', colorMap[selectedProf.color || 'blue'])} />
                <span className="truncate">{selectedProf.name}</span>
              </>
            ) : (
              <>
                <Users className="h-4 w-4" />
                <span>Todos os Profissionais</span>
              </>
            )}
          </div>
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Todos os Profissionais</span>
          </div>
        </SelectItem>
        {professionals.map((prof) => (
          <SelectItem key={prof.id} value={prof.id.toString()}>
            <div className="flex items-center gap-2">
              <div className={cn('h-3 w-3 rounded-full', colorMap[prof.color || 'blue'])} />
              <span>{prof.name}</span>
              {prof.specialty && (
                <span className="text-xs text-muted-foreground">({prof.specialty})</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { colorMap };
