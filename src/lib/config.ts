function jwtRole(key: string): string | null {
  if (!key || key.split('.').length !== 3) return null;
  try {
    const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(atob(payload));
    return typeof parsed.role === 'string' ? parsed.role : null;
  } catch {
    return null;
  }
}

const runtime = window.__LIGHTHOUSE_CONFIG__ || {};
const supabaseUrl = runtime.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL_LIGHT || '';
const supabaseKey = runtime.SUPABASE_KEY || import.meta.env.VITE_SUPABASE_KEY_LIGHT || '';
const googleApiKey = runtime.GOOGLE_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY || '';
let configurationError = runtime.CONFIG_ERROR || '';

if (supabaseKey.startsWith('sb_secret_') || jwtRole(supabaseKey) === 'service_role') {
  configurationError = 'La llave administrativa de Supabase no puede utilizarse en el navegador.';
}
if (!configurationError && (!supabaseUrl || !supabaseKey)) {
  configurationError = 'Falta configurar SUPABASE_URL_LIGHT y una llave publishable o anon en Easypanel.';
}

export const appConfig = {
  supabaseUrl,
  supabaseKey: configurationError ? '' : supabaseKey,
  googleApiKey,
  configurationError,
};
