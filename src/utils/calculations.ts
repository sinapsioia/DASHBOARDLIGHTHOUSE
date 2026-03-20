import { Transaction, DailySummary, BarberStats, CategoryExpense, DayOfWeekStats, FilterOptions } from '../types';

export function applyFilters(transactions: Transaction[], filters: FilterOptions): Transaction[] {
  return transactions.filter(t => {
    if (filters.fechaInicio && t.fecha < filters.fechaInicio) return false;
    if (filters.fechaFin && t.fecha > filters.fechaFin) return false;
    if (filters.barbero && t.barbero !== filters.barbero) return false;
    if (filters.tipo && t.tipo !== filters.tipo) return false;
    if (filters.categoria && t.categoria !== filters.categoria) return false;
    return true;
  });
}

export function calcDailySummaries(transactions: Transaction[]): DailySummary[] {
  const map = new Map<string, DailySummary>();
  for (const t of transactions) {
    if (!map.has(t.fecha)) map.set(t.fecha, { fecha: t.fecha, ingresos: 0, gastos: 0, neto: 0 });
    const day = map.get(t.fecha)!;
    if (t.tipo === 'Ingreso') day.ingresos += t.monto;
    else day.gastos += t.monto;
    day.neto = day.ingresos - day.gastos;
  }
  return Array.from(map.values()).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function calcBarberStats(transactions: Transaction[]): BarberStats[] {
  const map = new Map<string, BarberStats>();
  for (const t of transactions.filter(t => t.tipo === 'Ingreso' && t.barbero)) {
    if (!map.has(t.barbero)) map.set(t.barbero, { barbero: t.barbero, total: 0, servicios: 0, promedio: 0 });
    const b = map.get(t.barbero)!;
    b.total += t.monto;
    b.servicios += 1;
  }
  for (const b of map.values()) b.promedio = b.servicios > 0 ? b.total / b.servicios : 0;
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function calcCategoryExpenses(transactions: Transaction[]): CategoryExpense[] {
  const gastos = transactions.filter(t => t.tipo === 'Gasto');
  const total = gastos.reduce((s, t) => s + t.monto, 0);
  const map = new Map<string, number>();
  for (const t of gastos) map.set(t.categoria, (map.get(t.categoria) || 0) + t.monto);
  return Array.from(map.entries())
    .map(([categoria, monto]) => ({ categoria, total: monto, porcentaje: total > 0 ? (monto / total) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);
}

export function calcDayOfWeekStats(transactions: Transaction[]): DayOfWeekStats[] {
  const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const map = new Map<number, { ingresos: number; servicios: number }>();
  for (let i = 0; i < 7; i++) map.set(i, { ingresos: 0, servicios: 0 });

  for (const t of transactions.filter(t => t.tipo === 'Ingreso')) {
    const dow = new Date(t.fecha + 'T12:00:00').getDay();
    const d = map.get(dow)!;
    d.ingresos += t.monto;
    d.servicios += 1;
  }

  return Array.from(map.entries()).map(([idx, d]) => ({ dia: DAYS[idx], ...d }));
}

export function calcTopServices(transactions: Transaction[]): { servicio: string; total: number; count: number }[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const t of transactions.filter(t => t.tipo === 'Ingreso' && t.servicio)) {
    if (!map.has(t.servicio)) map.set(t.servicio, { total: 0, count: 0 });
    const s = map.get(t.servicio)!;
    s.total += t.monto;
    s.count += 1;
  }
  return Array.from(map.entries())
    .map(([servicio, d]) => ({ servicio, ...d }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
}

export function getTodaySummary(transactions: Transaction[]): { ingresos: number; gastos: number; neto: number; servicios: number } {
  const today = new Date().toISOString().split('T')[0];
  const todays = transactions.filter(t => t.fecha === today);
  const ingresos = todays.filter(t => t.tipo === 'Ingreso').reduce((s, t) => s + t.monto, 0);
  const gastos = todays.filter(t => t.tipo === 'Gasto').reduce((s, t) => s + t.monto, 0);
  return { ingresos, gastos, neto: ingresos - gastos, servicios: todays.filter(t => t.tipo === 'Ingreso').length };
}

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
}

export function getUniqueBarberos(transactions: Transaction[]): string[] {
  const set = new Set(transactions.filter(t => t.tipo === 'Ingreso' && t.barbero).map(t => t.barbero));
  return Array.from(set).sort();
}

export function getUniqueCategorias(transactions: Transaction[], tipo?: 'Ingreso' | 'Gasto'): string[] {
  const filtered = tipo ? transactions.filter(t => t.tipo === tipo) : transactions;
  const set = new Set(filtered.map(t => t.categoria).filter(Boolean));
  return Array.from(set).sort();
}
