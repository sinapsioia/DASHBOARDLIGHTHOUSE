import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CategoryExpense } from '../types';
import { formatCOP } from '../utils/calculations';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#06b6d4', '#8b5cf6'];

interface Props {
  data: CategoryExpense[];
}

export function ExpenseDistributionChart({ data }: Props) {
  if (!data.length) return <div className="flex items-center justify-center h-48 text-lh-muted">Sin gastos registrados</div>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          dataKey="total"
          nameKey="categoria"
        >
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 }}
          formatter={(v: number) => [formatCOP(v), 'Total']}
        />
        <Legend formatter={(v) => v} />
      </PieChart>
    </ResponsiveContainer>
  );
}
