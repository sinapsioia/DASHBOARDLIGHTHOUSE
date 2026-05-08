import { useState, useMemo } from 'react';
import { RefreshCw, Download, Anchor } from 'lucide-react';
import { useGoogleSheets } from './hooks/useGoogleSheets';
import { StatsCards } from './components/StatsCards';
import { BarberIncomeChart } from './components/BarberIncomeChart';
import { DailyTrendChart } from './components/DailyTrendChart';
import { DayOfWeekChart } from './components/DayOfWeekChart';
import { ExpenseDistributionChart } from './components/ExpenseDistributionChart';
import { TopServicesChart } from './components/TopServicesChart';
import { TransactionTable } from './components/TransactionTable';
import { AdvancedFilters } from './components/AdvancedFilters';
import {
  applyFilters,
  calcDailySummaries,
  calcBarberStats,
  calcCategoryExpenses,
  calcDayOfWeekStats,
  calcTopServices,
  getTodaySummary,
  getUniqueBarberos,
  formatCOP,
} from './utils/calculations';
import { FilterOptions } from './types';

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-lh-card border border-lh-border rounded-xl p-4">
      <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

export default function App() {
  const { transactions, loading, error, lastUpdated, refresh } = useGoogleSheets();
  const [filters, setFilters] = useState<FilterOptions>({});

  const filtered = useMemo(() => applyFilters(transactions, filters), [transactions, filters]);

  const today = useMemo(() => getTodaySummary(transactions), [transactions]);
  const totals = useMemo(() => ({
    ingresos: filtered.filter(t => t.tipo === 'Ingreso').reduce((s, t) => s + t.monto, 0),
    gastos: filtered.filter(t => t.tipo === 'Gasto').reduce((s, t) => s + t.monto, 0),
    neto: 0,
    servicios: filtered.filter(t => t.tipo === 'Ingreso').length,
  }), [filtered]);
  totals.neto = totals.ingresos - totals.gastos;

  const dailySummaries = useMemo(() => calcDailySummaries(filtered), [filtered]);
  const barberStats = useMemo(() => calcBarberStats(filtered), [filtered]);
  const categoryExpenses = useMemo(() => calcCategoryExpenses(filtered), [filtered]);
  const dowStats = useMemo(() => calcDayOfWeekStats(filtered), [filtered]);
  const topServices = useMemo(() => calcTopServices(filtered), [filtered]);
  const barberos = useMemo(() => getUniqueBarberos(transactions), [transactions]);

  const exportCSV = () => {
    const header = 'Fecha,Tipo,Barbero,Servicio,Categoría,Monto,Descripción';
    const rows = filtered.map(t =>
      `${t.fecha},${t.tipo},${t.barbero},"${t.servicio}",${t.categoria},${t.monto},"${t.descripcion}"`
    );
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lighthouse-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isDemoMode = !import.meta.env.VITE_GOOGLE_API_KEY;

  return (
    <div className="min-h-screen bg-lh-bg text-white">
      {/* Header */}
      <header className="border-b border-lh-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-lh-gold rounded-lg flex items-center justify-center">
              <Anchor className="w-5 h-5 text-lh-bg" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-none">The Lighthouse</h1>
              <p className="text-lh-muted text-xs">Barber Studio · Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isDemoMode && (
              <span className="bg-yellow-900/40 text-yellow-400 text-xs px-2 py-1 rounded-full border border-yellow-700/50">
                Modo demo
              </span>
            )}
            {lastUpdated && (
              <span className="text-lh-muted text-xs hidden sm:block">
                Actualizado: {lastUpdated.toLocaleTimeString('es-CO')}
              </span>
            )}
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 text-lh-muted hover:text-white text-sm px-3 py-1.5 rounded-lg border border-lh-border hover:border-lh-gold transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:block">Exportar</span>
            </button>
            <button
              onClick={() => refresh(true)}
              disabled={loading}
              className="flex items-center gap-1.5 bg-lh-gold hover:bg-lh-gold/80 text-lh-bg text-sm px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:block">Actualizar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-3 text-red-400 text-sm">{error}</div>
        )}

        {/* Hoy */}
        <div>
          <h2 className="text-lh-muted text-xs uppercase tracking-widest mb-3">Hoy</h2>
          <StatsCards {...today} label="Hoy" />
        </div>

        {/* Filtros */}
        <AdvancedFilters filters={filters} barberos={barberos} onFiltersChange={setFilters} />

        {/* Totales filtrados */}
        <div>
          <h2 className="text-lh-muted text-xs uppercase tracking-widest mb-3">
            {filters.fechaInicio || filters.fechaFin || filters.barbero || filters.tipo ? 'Filtrado' : 'Total general'}
          </h2>
          <StatsCards {...totals} label="Total" />
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Ingresos por barbero">
            {loading ? <div className="h-48 flex items-center justify-center text-lh-muted">Cargando...</div>
              : <BarberIncomeChart data={barberStats} />}
          </ChartCard>
          <ChartCard title="Tendencia diaria">
            {loading ? <div className="h-48 flex items-center justify-center text-lh-muted">Cargando...</div>
              : <DailyTrendChart data={dailySummaries} />}
          </ChartCard>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Servicios más populares">
            {loading ? <div className="h-48 flex items-center justify-center text-lh-muted">Cargando...</div>
              : <TopServicesChart data={topServices} />}
          </ChartCard>
          <ChartCard title="Distribución de gastos">
            {loading ? <div className="h-48 flex items-center justify-center text-lh-muted">Cargando...</div>
              : <ExpenseDistributionChart data={categoryExpenses} />}
          </ChartCard>
        </div>

        {/* Charts row 3 */}
        <div className="grid grid-cols-1 gap-4">
          <ChartCard title="Ingresos por día de la semana">
            {loading ? <div className="h-48 flex items-center justify-center text-lh-muted">Cargando...</div>
              : <DayOfWeekChart data={dowStats} />}
          </ChartCard>
        </div>

        {/* Resumen por barbero */}
        {barberStats.length > 0 && (
          <ChartCard title="Resumen por barbero">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {barberStats.map(b => (
                <div key={b.barbero} className="bg-lh-bg rounded-lg p-3 text-center">
                  <p className="text-lh-gold font-bold text-lg">{formatCOP(b.total)}</p>
                  <p className="text-white text-sm font-semibold mt-0.5">{b.barbero}</p>
                  <p className="text-lh-muted text-xs">{b.servicios} servicios</p>
                  <p className="text-lh-muted text-xs">{formatCOP(b.promedio)} prom.</p>
                </div>
              ))}
            </div>
          </ChartCard>
        )}

        {/* Transactions table */}
        <ChartCard title={`Últimas transacciones (${filtered.length})`}>
          {loading
            ? <div className="h-24 flex items-center justify-center text-lh-muted">Cargando...</div>
            : <TransactionTable transactions={filtered} limit={25} />}
        </ChartCard>

      </main>
    </div>
  );
}
