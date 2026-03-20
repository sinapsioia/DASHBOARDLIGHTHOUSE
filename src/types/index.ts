export interface Transaction {
  fecha: string;
  tipo: 'Ingreso' | 'Gasto';
  barbero: string;
  monto: number;
  categoria: string;
  descripcion: string;
  servicio: string;
}

export interface DailySummary {
  fecha: string;
  ingresos: number;
  gastos: number;
  neto: number;
}

export interface BarberStats {
  barbero: string;
  total: number;
  servicios: number;
  promedio: number;
}

export interface CategoryExpense {
  categoria: string;
  total: number;
  porcentaje: number;
}

export interface DayOfWeekStats {
  dia: string;
  ingresos: number;
  servicios: number;
}

export interface FilterOptions {
  fechaInicio?: string;
  fechaFin?: string;
  barbero?: string;
  tipo?: 'Ingreso' | 'Gasto' | '';
  categoria?: string;
}
