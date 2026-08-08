import { AlertTriangle, Anchor, LoaderCircle, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export function LoadingPage() {
  return (
    <div className="min-h-screen bg-lh-bg text-white flex items-center justify-center">
      <LoaderCircle className="w-6 h-6 text-lh-gold animate-spin" />
    </div>
  );
}

export function ConfigurationPage({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-lh-bg text-white flex items-center justify-center p-6">
      <div className="max-w-lg border border-lh-border bg-lh-card rounded-md p-6">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-lh-gold" />
          <h1 className="font-semibold">Configuración pendiente</h1>
        </div>
        <p className="text-sm text-lh-muted mt-4">{message}</p>
      </div>
    </main>
  );
}

export function UnauthorizedPage() {
  const { profileError, signOut, user } = useAuth();
  return (
    <main className="min-h-screen bg-lh-bg text-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg border border-lh-border bg-lh-card rounded-md p-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-lh-gold rounded-md flex items-center justify-center">
            <Anchor className="w-4 h-4 text-lh-bg" />
          </div>
          <div>
            <h1 className="font-semibold">Acceso pendiente</h1>
            <p className="text-xs text-lh-muted">{user?.email}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-6 p-3 bg-amber-950/30 border border-amber-800/50 rounded-md">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-200">{profileError || 'Un propietario debe asignar a esta cuenta el rol de owner o admin.'}</p>
        </div>
        <button onClick={signOut} className="mt-6 flex items-center gap-2 text-sm text-lh-muted hover:text-white">
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}
