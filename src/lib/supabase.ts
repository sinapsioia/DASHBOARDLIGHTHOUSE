import { createClient } from '@supabase/supabase-js';
import { appConfig } from './config';

export const supabase = appConfig.configurationError
  ? null
  : createClient(appConfig.supabaseUrl, appConfig.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

export function requireSupabase() {
  if (!supabase) throw new Error(appConfig.configurationError || 'Supabase no está disponible.');
  return supabase;
}
