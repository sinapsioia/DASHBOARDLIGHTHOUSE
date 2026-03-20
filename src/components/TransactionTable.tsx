import { Transaction } from '../types';
import { formatCOP } from '../utils/calculations';

interface Props {
  transactions: Transaction[];
  limit?: number;
}

export function TransactionTable({ transactions, limit = 20 }: Props) {
  const rows = transactions.slice(0, limit);

  if (!rows.length) return (
    <div className="flex items-center justify-center h-24 text-lh-muted">Sin transacciones</div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-lh-border">
            <th className="text-left py-2 px-3 text-lh-muted font-medium">Fecha</th>
            <th className="text-left py-2 px-3 text-lh-muted font-medium">Tipo</th>
            <th className="text-left py-2 px-3 text-lh-muted font-medium">Barbero</th>
            <th className="text-left py-2 px-3 text-lh-muted font-medium">Servicio / Categoría</th>
            <th className="text-right py-2 px-3 text-lh-muted font-medium">Monto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <tr key={i} className="border-b border-lh-border/50 hover:bg-lh-border/20 transition-colors">
              <td className="py-2 px-3 text-lh-muted">{t.fecha}</td>
              <td className="py-2 px-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  t.tipo === 'Ingreso'
                    ? 'bg-emerald-900/40 text-emerald-400'
                    : 'bg-red-900/40 text-red-400'
                }`}>
                  {t.tipo}
                </span>
              </td>
              <td className="py-2 px-3 text-white">{t.barbero || '—'}</td>
              <td className="py-2 px-3 text-lh-muted truncate max-w-[200px]" title={t.servicio || t.categoria}>
                {t.servicio || t.categoria}
              </td>
              <td className={`py-2 px-3 text-right font-semibold ${
                t.tipo === 'Ingreso' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {t.tipo === 'Gasto' ? '-' : ''}{formatCOP(t.monto)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
