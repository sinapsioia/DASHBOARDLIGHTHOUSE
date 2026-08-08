import axios from 'axios';
import { Transaction } from '../types';

const SPREADSHEET_ID = '1rnnmx1ndo8HEUT4K6S8JpXWq5EtIAHk_RAmGOYsE01o';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const CACHE_DURATION = 30000; // 30 seconds
const BOGOTA_TIME_ZONE = 'America/Bogota';

// Derive category from Lighthouse service name
function categoriaFromServicio(servicio: string): string {
  const s = servicio.toLowerCase();
  if (s.includes('combo') || s.includes('portobello') || s.includes('trinidad') || s.includes('point sur') || s.includes('ponta verde')) return 'Combo';
  if (s.includes('mascarilla')) return 'Mascarilla';
  if (s.includes('barba')) return 'Barba';
  if (s.includes('corte')) return 'Corte';
  return 'Otro';
}

function isIncomeStatus(raw: string): boolean {
  const status = String(raw || '').trim().toLowerCase();
  return ['confirmada', 'confirmado', 'walk-in', 'walkin', 'walk in'].includes(status);
}

function formatDateInBogota(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function parseDate(raw: string): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (value.includes('T')) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : formatDateInBogota(date);
  }
  // DD/MM/YYYY
  if (value.includes('/')) {
    const [d, m, y] = value.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return value;
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
        const idxAny = (...names: string[]) => names.map((name) => idx(name)).find((index) => index !== -1) ?? -1;
        const cell = (row: string[], index: number) => index >= 0 ? (row[index] || '') : '';

        const iEstado   = idx('estado');
        const iBarbero  = idx('barbero');
        const iServicio = idx('servicio');
        const iPrecio   = idx('precio');
        const iFechaCita = idx('fecha_cita');
        const iFechaISO = idx('fecha_inicio_iso');
        const iTimestamp = idx('timestamp');
        const iNombre   = idx('nombre_completo');
        const iCedula = idxAny('cedula', 'cédula');
        const iEmail = idxAny('email', 'correo', 'correo_electronico', 'correo electrónico');
        const iTelefono = idxAny('telefono', 'teléfono', 'celular');
        const iFechaNacimiento = idxAny('fecha_nacimiento', 'fecha de nacimiento', 'fecha_nac');
        const iDireccion = idxAny('direccion', 'dirección');
        const iHora = idx('hora');

        for (let i = 1; i < citasRows.length; i++) {
          const row = citasRows[i];
          const estado = cell(row, iEstado);
          if (!isIncomeStatus(estado)) continue;

          const monto = parseFloat((cell(row, iPrecio) || '0').replace(/[^0-9.]/g, ''));
          if (!monto) continue;

          const fechaRaw = cell(row, iFechaCita) || cell(row, iFechaISO) || cell(row, iTimestamp);
          const fecha = parseDate(fechaRaw);
          if (!fecha) continue;

          const servicio = cell(row, iServicio);
          const nombre = cell(row, iNombre);
          transactions.push({
            fecha,
            tipo: 'Ingreso',
            barbero: cell(row, iBarbero),
            monto,
            categoria: categoriaFromServicio(servicio),
            descripcion: nombre,
            servicio,
            clienteNombre: nombre,
            cedula: cell(row, iCedula),
            email: cell(row, iEmail),
            telefono: cell(row, iTelefono),
            fechaNacimiento: parseDate(cell(row, iFechaNacimiento)),
            direccion: cell(row, iDireccion),
            fechaCita: parseDate(cell(row, iFechaCita)) || fecha,
            horaCita: cell(row, iHora),
            estado,
          });
        }
      }

      // --- Gastos tab ---
      if (gastosRows.length > 1) {
        const headers = gastosRows[0].map(h => h.trim().toLowerCase());
        const idx = (name: string) => headers.indexOf(name.toLowerCase());
        const cell = (row: string[], index: number) => index >= 0 ? (row[index] || '') : '';

        const iFecha    = idx('fecha');
        const iMonto    = idx('monto');
        const iCategoria = idx('categoría') !== -1 ? idx('categoría') : idx('categoria');
        const iDesc     = idx('descripción') !== -1 ? idx('descripción') : idx('descripcion');

        for (let i = 1; i < gastosRows.length; i++) {
          const row = gastosRows[i];
          const fechaRaw = cell(row, iFecha);
          const fecha = parseDate(fechaRaw);
          if (!fecha) continue;

          const monto = parseFloat((cell(row, iMonto) || '0').replace(/[^0-9.]/g, ''));
          if (!monto) continue;

          transactions.push({
            fecha,
            tipo: 'Gasto',
            barbero: '',
            monto,
            categoria: cell(row, iCategoria) || 'Otros',
            descripcion: cell(row, iDesc),
            servicio: '',
            estado: '',
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
    const today = formatDateInBogota(new Date());
    const yesterday = formatDateInBogota(new Date(Date.now() - 86400000));
    return [
      { fecha: today, tipo: 'Ingreso', barbero: 'Jeisson', monto: 65000, categoria: 'Combo', descripcion: 'Cliente demo', servicio: 'Combo Faro Portobello (Ritual)' },
      { fecha: today, tipo: 'Ingreso', barbero: 'Camilo', monto: 45000, categoria: 'Corte', descripcion: 'Cliente demo', servicio: 'Corte Faro de Alejandría' },
      { fecha: today, tipo: 'Ingreso', barbero: 'Daniel', monto: 55000, categoria: 'Combo', descripcion: 'Cliente demo', servicio: 'Combo Faro Trinidad', clienteNombre: 'Cliente demo', telefono: '3000000002', fechaCita: today, horaCita: '12:00', estado: 'walk-in' },
      { fecha: today, tipo: 'Gasto', barbero: '', monto: 45000, categoria: 'Insumos', descripcion: 'Cuchillas y productos demo', servicio: '' },
      { fecha: yesterday, tipo: 'Ingreso', barbero: 'Luis', monto: 90000, categoria: 'Combo', descripcion: 'Cliente demo', servicio: 'Combo Faro Point Sur' },
      { fecha: yesterday, tipo: 'Ingreso', barbero: 'Jeisson', monto: 65000, categoria: 'Combo', descripcion: 'Cliente demo', servicio: 'Combo Faro Portobello (Ritual)' },
      { fecha: yesterday, tipo: 'Gasto', barbero: '', monto: 120000, categoria: 'Servicios', descripcion: 'Servicios demo', servicio: '' },
    ];
  }
}

export const sheetsService = new GoogleSheetsService();
