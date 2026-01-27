import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Star } from 'lucide-react';
import type { HumorData } from '@/services/api';

interface HumorChartProps {
  data: HumorData | null;
  isLoading?: boolean;
}

export function HumorChart({ data, isLoading }: HumorChartProps) {
  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="h-32 w-32 rounded-full bg-muted animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        Sem dados disponíveis
      </div>
    );
  }

  const chartData = [
    { name: 'Google Reviews', value: data.google_reviews, color: 'hsl(var(--primary))' },
    { name: 'Avaliação Interna', value: data.internal_rating, color: 'hsl(var(--secondary))' },
  ];

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating)
            ? 'fill-warning text-warning'
            : i < rating
              ? 'fill-warning/50 text-warning'
              : 'text-muted'
        }`}
      />
    ));
  };

  return (
    <div className="space-y-4">
      {/* Average Score */}
      <div className="flex items-center justify-center gap-3 py-4">
        <div className="text-center">
          <div className="text-4xl font-bold text-foreground">{data.average.toFixed(1)}</div>
          <div className="flex items-center gap-0.5 mt-1">
            {renderStars(data.average)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{data.total_reviews} avaliações</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              paddingAngle={5}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(1)} ★`, '']}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-md)',
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => (
                <span className="text-sm text-muted-foreground">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-primary/10 p-3 text-center">
          <p className="text-xs text-muted-foreground">Google</p>
          <p className="text-lg font-semibold text-primary">{data.google_reviews.toFixed(1)} ★</p>
        </div>
        <div className="rounded-lg bg-secondary/10 p-3 text-center">
          <p className="text-xs text-muted-foreground">Interno</p>
          <p className="text-lg font-semibold text-secondary">{data.internal_rating.toFixed(1)} ★</p>
        </div>
      </div>
    </div>
  );
}
