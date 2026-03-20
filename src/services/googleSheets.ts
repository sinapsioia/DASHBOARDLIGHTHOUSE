import axios from 'axios';
import { Transaction } from '../types';

const SPREADSHEET_ID = '1rnnmx1ndo8HEUT4K6S8JpXWq5EtIAHk_RAmGOYsE01o';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const CACHE_DURATION = 30000; // 30 seconds

// Derive category from Lighthouse service name
function categoriaFromServicio(servicio: string): string {
  const s = servicio.toLowerCase();
  if (s.includes('combo') || s.includes('portobello') || s.includes('trinidad') || s.includes('point sur') || s.includes('ponta verde')) return 'Combo';
  if (s.includes('mascarilla')) return 'Mascarilla';
  if (s.includes('barba')) return 'Barba';
  if (s.includes('corte')) return 'Corte';
  return 'Otro';
}

function parseDate(raw: string): string {
  if (!raw) return '';
  // ISO format: 2026-02-08T20:00:00.000Z → 2026-02-08
  if (raw.includes('T')) return raw.split('T')[0];
  // DD/MM/YYYY
  if (raw.includes('/')) {
    const [d, m, y] = raw.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return raw;
}

class GoogleSheetsService {
  private cache: Transaction[] | null = null;
  private cacheTime: number = 0;
  private apiKey: string = '';

  setApiKey(key: string) {
    this.apiKey = key;
  }

  private async fetchRange(range: string): Promise<string[][]> {
    const url = `${SHEETS_API}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?key=${this.apiKey}`;
    const res = await axios.get(url);
    return res.data.values || [];
  }

  async fetchData(forceRefresh = false): Promise<Transaction[]> {
    if (!forceRefresh && this.cache && Date.now() - this.cacheTime < CACHE_DURATION) {
      return this.cache;
    }

    if (!this.apiKey) {
      return this.getMockData();
    }

    try {
      const [citasRows, gastosRows] = await Promise.all([
        this.fetchRange('Sheet1!A:Z'),
        this.fetchRange('Gastos!A:Z'),
      ]);

      const transactions: Transaction[] = [];

      // --- Citas → Ingresos ---
      if (citasRows.length > 1) {
        const headers = citasRows[0].map(h => h.trim().toLowerCase());
        const idx = (name: string) => headers.indexOf(name.toLowerCase());

        const iEstado   = idx('estado');
        const iBarbero  = idx('barbero');
        const iServicio = idx('servicio');
        const iPrecio   = idx('precio');
        const iFechaISO = idx('fecha_inicio_iso');
        const iTimestamp = idx('timestamp');
        const iNombre   = idx('nombre_completo');

        for (let i = 1; i < citasRows.length; i++) {
          const row = citasRows[i];
          const estado = (row[iEstado] || '').toLowerCase().trim();
          if (estado !== 'confirmada') continue;

          const monto = parseFloat((row[iPrecio] || '0').replace(/[^0-9.]/g, ''));
          if (!monto) continue;

          const fechaRaw = row[iFechaISO] || row[iTimestamp] || '';
          const fecha = parseDate(fechaRaw);
          if (!fecha) continue;

          const servicio = row[iServicio] || '';
          transactions.push({
            fecha,
            tipo: 'Ingreso',
            barbero: row[iBarbero] || '',
            monto,
            categoria: categoriaFromServicio(servicio),
            descripcion: row[iNombre] || '',
            servicio,
          });
        }
      }

      // --- Gastos tab ---
      if (gastosRows.length > 1) {
        const headers = gastosRows[0].map(h => h.trim().toLowerCase());
        const idx = (name: string) => headers.indexOf(name.toLowerCase());

        const iFecha    = idx('fecha');
        const iMonto    = idx('monto');
        const iCategoria = idx('categoría') !== -1 ? idx('categoría') : idx('categoria');
        const iDesc     = idx('descripción') !== -1 ? idx('descripción') : idx('descripcion');

        for (let i = 1; i < gastosRows.length; i++) {
          const row = gastosRows[i];
          const fechaRaw = row[iFecha] || '';
          const fecha = parseDate(fechaRaw);
          if (!fecha) continue;

          const monto = parseFloat((row[iMonto] || '0').replace(/[^0-9.]/g, ''));
          if (!monto) continue;

          transactions.push({
            fecha,
            tipo: 'Gasto',
            barbero: '',
            monto,
            categoria: row[iCategoria] || 'Otros',
            descripcion: row[iDesc] || '',
            servicio: '',
          });
        }
      }

      // Sort by date descending
      transactions.sort((a, b) => b.fecha.localeCompare(a.fecha));

      this.cache = transactions;
      this.cacheTime = Date.now();
      return transactions;

    } catch (err) {
      console.error('Error fetching sheets data:', err);
      if (this.cache) return this.cache;
      throw err;
    }
  }

  clearCache() {
    this.cache = null;
    this.cacheTime = 0;
  }

  getMockData(): Transaction[] {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    return [
      { fecha: today, tipo: 'Ingreso', barbero: 'Jeisson', monto: 65000, categoria: 'Combo', descripcion: 'Cliente demo', servicio: 'Combo Faro Portobello (Ritual)' },
      { fecha: today, tipo: 'Ingreso', barbero: 'Camilo', monto: 45000, categoria: 'Corte', descripcion: 'Cliente demo', servicio: 'Corte Faro de Alejandría' },
      { fecha: today, tipo: 'Ingreso', barbero: 'Alejandro', monto: 55000, categoria: 'Combo', descripcion: 'Cliente demo', servicio: 'Combo Faro Trinidad (Sencillo)' },
      { fecha: today, tipo: 'Gasto', barbero: '', monto: 45000, categoria: 'Insumos', descripcion: 'Cuchillas y productos demo', servicio: '' },
      { fecha: yesterday, tipo: 'Ingreso', barbero: 'Luis', monto: 90000, categoria: 'Combo', descripcion: 'Cliente demo', servicio: 'Combo Faro Point Sur' },
      { fecha: yesterday, tipo: 'Ingreso', barbero: 'Jeisson', monto: 65000, categoria: 'Combo', descripcion: 'Cliente demo', servicio: 'Combo Faro Portobello (Ritual)' },
      { fecha: yesterday, tipo: 'Gasto', barbero: '', monto: 120000, categoria: 'Servicios', descripcion: 'Servicios demo', servicio: '' },
    ];
  }
}

export const sheetsService = new GoogleSheetsService();
