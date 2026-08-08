export function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10) digits = `57${digits}`;
  if (digits.length < 8 || digits.length > 15 || digits.startsWith('0')) {
    throw new Error('Ingrese un teléfono válido, por ejemplo 3222317169.');
  }
  return `+${digits}`;
}

export function displayPhone(value: string | null | undefined): string {
  if (!value) return 'Sin teléfono';
  if (/^\+57\d{10}$/.test(value)) {
    return `+57 ${value.slice(3, 6)} ${value.slice(6, 9)} ${value.slice(9)}`;
  }
  return value;
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(value));
}

export function bogotaDateKey(value: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Bogota',
  }).format(typeof value === 'string' ? new Date(value) : value);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

export function bogotaDateTimeInput(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Bogota',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

export function bogotaLocalDateTimeToIso(value: string): string {
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const parsed = new Date(`${withSeconds}-05:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error('La fecha y hora del corte no son válidas.');
  return parsed.toISOString();
}

export function safeSearchTerm(value: string): string {
  return value.replace(/[,%()]/g, ' ').trim();
}
