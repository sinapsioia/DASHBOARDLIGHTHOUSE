import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { appConfig } from '../lib/config';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/domain';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  initializing: boolean;
  profileError: string;
  authorized: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profileError, setProfileError] = useState('');

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, full_name, role, active')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      setProfile(null);
      setProfileError('No fue posible cargar los permisos de esta cuenta.');
      return;
    }
    if (!data) {
      setProfile(null);
      setProfileError('Esta cuenta todavía no tiene un perfil de acceso.');
      return;
    }
    setProfile(data as Profile);
    setProfileError('');
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user.id) await loadProfile(session.user.id);
  }, [loadProfile, session?.user.id]);

  useEffect(() => {
    if (!supabase) {
      setInitializing(false);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user.id) await loadProfile(data.session.user.id);
      if (mounted) setInitializing(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setProfile(null);
      setProfileError('');
      if (nextSession?.user.id) {
        window.setTimeout(() => loadProfile(nextSession.user.id), 0);
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error(appConfig.configurationError);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Correo o contraseña incorrectos.');
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user || null,
    profile,
    initializing,
    profileError,
    authorized: Boolean(profile?.active && (profile.role === 'owner' || profile.role === 'admin')),
    signIn,
    signOut,
    refreshProfile,
  }), [session, profile, initializing, profileError, signIn, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider');
  return context;
}
