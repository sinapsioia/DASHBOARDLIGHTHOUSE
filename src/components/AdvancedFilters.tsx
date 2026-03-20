import { FilterOptions } from '../types';

interface Props {
  filters: FilterOptions;
  barberos: string[];
  onFiltersChange: (f: FilterOptions) => void;
}

export function AdvancedFilters({ filters, barberos, onFiltersChange }: Props) {
  const update = (key: keyof FilterOptions, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="bg-lh-card border border-lh-border rounded-xl p-4">
      <h3 className="text-white font-semibold mb-3 text-sm">Filtros</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

        <div>
          <label className="text-lh-muted text-xs mb-1 block">Desde</label>
          <input
            type="date"
            value={filters.fechaInicio || ''}
            onChange={e => update('fechaInicio', e.target.value)}
            className="w-full bg-lh-bg border border-lh-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-lh-gold"
          />
        </div>

        <div>
          <label className="text-lh-muted text-xs mb-1 block">Hasta</label>
          <input
            type="date"
            value={filters.fechaFin || ''}
            onChange={e => update('fechaFin', e.target.value)}
            className="w-full bg-lh-bg border border-lh-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-lh-gold"
          />
        </div>

        <div>
          <label className="text-lh-muted text-xs mb-1 block">Barbero</label>
          <select
            value={filters.barbero || ''}
            onChange={e => update('barbero', e.target.value)}
            className="w-full bg-lh-bg border border-lh-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-lh-gold"
          >
            <option value="">Todos</option>
            {barberos.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div>
          <label className="text-lh-muted text-xs mb-1 block">Tipo</label>
          <select
            value={filters.tipo || ''}
            onChange={e => update('tipo', e.target.value)}
            className="w-full bg-lh-bg border border-lh-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-lh-gold"
          >
            <option value="">Todos</option>
            <option value="Ingreso">Ingresos</option>
            <option value="Gasto">Gastos</option>
          </select>
        </div>

      </div>

      {(filters.fechaInicio || filters.fechaFin || filters.barbero || filters.tipo) && (
        <button
          onClick={() => onFiltersChange({})}
          className="mt-3 text-lh-gold text-xs hover:underline"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
