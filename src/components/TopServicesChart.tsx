import { formatCOP } from '../utils/calculations';

interface ServiceStat {
  servicio: string;
  total: number;
  count: number;
}

interface Props {
  data: ServiceStat[];
}

export function TopServicesChart({ data }: Props) {
  if (!data.length) return <div className="flex items-center justify-center h-48 text-lh-muted">Sin datos</div>;

  const maxTotal = Math.max(...data.map(d => d.total));

  return (
    <div className="space-y-3">
      {data.map((s, i) => (
        <div key={s.servicio}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-white text-sm truncate max-w-[60%]" title={s.servicio}>
              {i + 1}. {s.servicio}
            </span>
            <div className="text-right">
              <span className="text-lh-gold text-sm font-semibold">{formatCOP(s.total)}</span>
              <span className="text-lh-muted text-xs ml-2">×{s.count}</span>
            </div>
          </div>
          <div className="h-1.5 bg-lh-border rounded-full overflow-hidden">
            <div
              className="h-full bg-lh-gold rounded-full transition-all"
              style={{ width: `${(s.total / maxTotal) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
