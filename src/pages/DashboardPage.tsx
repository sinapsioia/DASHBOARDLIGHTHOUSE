import { useEffect, useMemo, useState } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { AdvancedFilters } from '../components/AdvancedFilters';
import { BarberIncomeChart } from '../components/BarberIncomeChart';
import { DailyTrendChart } from '../components/DailyTrendChart';
import { DayOfWeekChart } from '../components/DayOfWeekChart';
import { ExpenseDistributionChart } from '../components/ExpenseDistributionChart';
import { StatsCards } from '../components/StatsCards';
import { TopServicesChart } from '../components/TopServicesChart';
import { TransactionTable } from '../components/TransactionTable';
import { PageHeader } from '../components/ui/PageElements';
import { useGoogleSheets } from '../hooks/useGoogleSheets';
import { listBarbers } from '../services/lighthouseDb';
import type { FilterOptions } from '../types';
import type { Barber } from '../types/domain';
import {
  applyFilters,
  calcBarberStats,
  calcCategoryExpenses,
  calcDailySummaries,
  calcDayOfWeekStats,
  calcTopServices,
  formatCOP,
  getTodaySummary,
  getUniqueBarberos,
} from '../utils/calculations';

function ChartSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-lh-border rounded-md p-4">
      <h2 className="text-sm font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}

function csvValue(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function lookupKey(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function resolveBarberName(value: string, catalog: Barber[]) {
  const key = lookupKey(value);
  if (!key) return value;
  const match = catalog.find((barber) => [barber.name, ...barber.aliases].some((name) => lookupKey(name) === key));
  return match?.name || value;
}

export function DashboardPage() {
  const { transactions, loading, error, lastUpdated, refresh } = useGoogleSheets();
  const [filters, setFilters] = useState<FilterOptions>({});
  const [barberCatalog, setBarberCatalog] = useState<Barber[]>([]);

  useEffect(() => {
    listBarbers().then(setBarberCatalog).catch(() => undefined);
  }, []);

  const normalizedTransactions = useMemo(() => transactions.map((item) => ({
    ...item,
    barbero: resolveBarberName(item.barbero, barberCatalog),
  })), [transactions, barberCatalog]);
  const catalogBarbers = useMemo(() => barberCatalog.map((item) => item.name), [barberCatalog]);
  const filtered = useMemo(() => applyFilters(normalizedTransactions, filters), [normalizedTransactions, filters]);
  const today = useMemo(() => getTodaySummary(normalizedTransactions), [normalizedTransactions]);
  const totals = useMemo(() => {
    const ingresos = filtered.filter((item) => item.tipo === 'Ingreso').reduce((sum, item) => sum + item.monto, 0);
    const gastos = filtered.filter((item) => item.tipo === 'Gasto').reduce((sum, item) => sum + item.monto, 0);
    return { ingresos, gastos, neto: ingresos - gastos, servicios: filtered.filter((item) => item.tipo === 'Ingreso').length };
  }, [filtered]);
  const dailySummaries = useMemo(() => calcDailySummaries(filtered), [filtered]);
  const barberStats = useMemo(() => calcBarberStats(filtered, catalogBarbers), [filtered, catalogBarbers]);
  const categoryExpenses = useMemo(() => calcCategoryExpenses(filtered), [filtered]);
  const dowStats = useMemo(() => calcDayOfWeekStats(filtered), [filtered]);
  const topServices = useMemo(() => calcTopServices(filtered), [filtered]);
  const barbers = useMemo(() => getUniqueBarberos(normalizedTransactions, catalogBarbers), [normalizedTransactions, catalogBarbers]);

  const exportCSV = () => {
    const header = ['Fecha registro', 'Tipo', 'Estado', 'Barbero', 'Cliente', 'Cédula', 'Email', 'Teléfono', 'Fecha nacimiento', 'Dirección', 'Fecha cita', 'Hora cita', 'Servicio', 'Categoría', 'Monto', 'Monto COP', 'Descripción'];
    const rows = normalizedTransactions.map((item) => [item.fecha, item.tipo, item.estado || '', item.barbero, item.clienteNombre || item.descripcion, item.cedula || '', item.email || '', item.telefono || '', item.fechaNacimiento || '', item.direccion || '', item.fechaCita || '', item.horaCita || '', item.servicio, item.categoria, item.monto, formatCOP(item.monto), item.descripcion].map(csvValue).join(','));
    const blob = new Blob([`\uFEFF${header.join(',')}\n${rows.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `lighthouse-base-datos-${new Date().toISOString().split('T')[0]}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finanzas"
        title="Resumen"
        description={lastUpdated ? `Actualizado a las ${lastUpdated.toLocaleTimeString('es-CO')}` : 'Indicadores actuales de Lighthouse.'}
        actions={(
          <>
            <button onClick={exportCSV} disabled={!normalizedTransactions.length} className="h-10 px-3 border border-lh-border rounded-md text-sm flex items-center gap-2 text-lh-muted hover:text-white disabled:opacity-50"><Database className="w-4 h-4" /> Descargar base</button>
            <button onClick={() => refresh(true)} disabled={loading} className="w-10 h-10 bg-lh-gold text-lh-bg rounded-md flex items-center justify-center disabled:opacity-50" aria-label="Actualizar"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          </>
        )}
      />
      {error && <div className="border border-red-800/60 bg-red-950/30 rounded-md p-3 text-red-300 text-sm">{error}</div>}

      <section><p className="text-xs text-lh-muted uppercase mb-3">Hoy</p><StatsCards {...today} label="Hoy" /></section>
      <AdvancedFilters filters={filters} barberos={barbers} onFiltersChange={setFilters} />
      <section><p className="text-xs text-lh-muted uppercase mb-3">Total seleccionado</p><StatsCards {...totals} label="Total" /></section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartSection title="Ingresos por barbero">{loading ? <div className="h-48 flex items-center justify-center text-lh-muted">Cargando...</div> : <BarberIncomeChart data={barberStats} />}</ChartSection>
        <ChartSection title="Tendencia diaria">{loading ? <div className="h-48 flex items-center justify-center text-lh-muted">Cargando...</div> : <DailyTrendChart data={dailySummaries} />}</ChartSection>
        <ChartSection title="Servicios más populares"><TopServicesChart data={topServices} /></ChartSection>
        <ChartSection title="Distribución de gastos"><ExpenseDistributionChart data={categoryExpenses} /></ChartSection>
      </div>
      <ChartSection title="Ingresos por día de la semana"><DayOfWeekChart data={dowStats} /></ChartSection>
      <ChartSection title="Resumen por barbero">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-lh-border border border-lh-border rounded-md overflow-hidden">
          {barberStats.map((barber) => <div key={barber.barbero} className="bg-lh-bg p-4"><p className="text-lh-gold font-semibold">{formatCOP(barber.total)}</p><p className="text-sm mt-1">{barber.barbero}</p><p className="text-xs text-lh-muted mt-1">{barber.servicios} servicios · {formatCOP(barber.promedio)} prom.</p></div>)}
        </div>
      </ChartSection>
      <ChartSection title={`Últimas transacciones (${filtered.length})`}>{loading ? <div className="h-24 flex items-center justify-center text-lh-muted">Cargando...</div> : <TransactionTable transactions={filtered} limit={25} />}</ChartSection>
    </div>
  );
}
