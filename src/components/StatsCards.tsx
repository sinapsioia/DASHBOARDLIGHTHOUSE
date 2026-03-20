import { TrendingUp, TrendingDown, DollarSign, Scissors } from 'lucide-react';
import { formatCOP } from '../utils/calculations';

interface Props {
  ingresos: number;
  gastos: number;
  neto: number;
  servicios: number;
  label?: string;
}

export function StatsCards({ ingresos, gastos, neto, servicios, label = 'Total' }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-lh-card border border-lh-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-lh-muted text-sm">{label} Ingresos</span>
          <TrendingUp className="w-4 h-4 text-emerald-400" />
        </div>
        <p className="text-xl font-bold text-emerald-400">{formatCOP(ingresos)}</p>
      </div>

      <div className="bg-lh-card border border-lh-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-lh-muted text-sm">{label} Gastos</span>
          <TrendingDown className="w-4 h-4 text-red-400" />
        </div>
        <p className="text-xl font-bold text-red-400">{formatCOP(gastos)}</p>
      </div>

      <div className="bg-lh-card border border-lh-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-lh-muted text-sm">{label} Neto</span>
          <DollarSign className={`w-4 h-4 ${neto >= 0 ? 'text-lh-gold' : 'text-red-400'}`} />
        </div>
        <p className={`text-xl font-bold ${neto >= 0 ? 'text-lh-gold' : 'text-red-400'}`}>{formatCOP(neto)}</p>
      </div>

      <div className="bg-lh-card border border-lh-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-lh-muted text-sm">{label} Servicios</span>
          <Scissors className="w-4 h-4 text-lh-gold" />
        </div>
        <p className="text-xl font-bold text-white">{servicios}</p>
      </div>
    </div>
  );
}
