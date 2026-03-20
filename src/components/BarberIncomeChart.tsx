import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarberStats } from '../types';
import { formatCOP } from '../utils/calculations';

const COLORS = ['#C9A84C', '#A8834A', '#7B6235', '#5C4A28'];

interface Props {
  data: BarberStats[];
}

export function BarberIncomeChart({ data }: Props) {
  if (!data.length) return <div className="flex items-center justify-center h-48 text-lh-muted">Sin datos</div>;

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
          <XAxis dataKey="barbero" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
            formatter={(v: number) => [formatCOP(v), 'Ingresos']}
          />
          <Bar dataKey="total" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {data.map((b, i) => (
          <div key={b.barbero} className="bg-lh-bg rounded-lg p-2 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{b.barbero}</p>
              <p className="text-lh-muted text-xs">{b.servicios} servicios · {formatCOP(b.promedio)} prom.</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
