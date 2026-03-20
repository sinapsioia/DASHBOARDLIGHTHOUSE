import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DayOfWeekStats } from '../types';
import { formatCOP } from '../utils/calculations';

interface Props {
  data: DayOfWeekStats[];
}

export function DayOfWeekChart({ data }: Props) {
  if (!data.length) return <div className="flex items-center justify-center h-48 text-lh-muted">Sin datos</div>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
        <XAxis dataKey="dia" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          formatter={(v: number, name: string) => [
            name === 'ingresos' ? formatCOP(v) : v,
            name === 'ingresos' ? 'Ingresos' : 'Servicios'
          ]}
        />
        <Bar dataKey="ingresos" fill="#C9A84C" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
