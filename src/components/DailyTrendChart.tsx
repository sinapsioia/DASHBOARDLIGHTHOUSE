import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DailySummary } from '../types';
import { formatCOP } from '../utils/calculations';

interface Props {
  data: DailySummary[];
}

export function DailyTrendChart({ data }: Props) {
  const last30 = [...data].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-30);

  if (!last30.length) return <div className="flex items-center justify-center h-48 text-lh-muted">Sin datos</div>;

  const formatted = last30.map(d => ({
    ...d,
    fechaLabel: d.fecha.slice(5), // MM-DD
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={formatted} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
        <XAxis dataKey="fechaLabel" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          formatter={(v: number, name: string) => [formatCOP(v), name === 'ingresos' ? 'Ingresos' : 'Gastos']}
        />
        <Legend formatter={v => v === 'ingresos' ? 'Ingresos' : 'Gastos'} />
        <Line type="monotone" dataKey="ingresos" stroke="#C9A84C" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="gastos" stroke="#ef4444" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
