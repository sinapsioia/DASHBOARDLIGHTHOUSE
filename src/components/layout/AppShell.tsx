import { Anchor, Gauge, LogOut, Scissors, Settings, UserRoundPlus, Users } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

const navigation = [
  { to: '/', label: 'Resumen', icon: Gauge, end: true },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/cortes', label: 'Cortes', icon: Scissors },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
];

const pageNames: Record<string, string> = {
  '/': 'Resumen',
  '/clientes': 'Clientes',
  '/cortes': 'Cortes',
  '/configuracion': 'Configuración',
};

function NavigationLink({ item, compact = false }: { item: typeof navigation[number]; compact?: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => compact
        ? `h-14 min-w-0 flex-1 flex flex-col items-center justify-center gap-1 text-[10px] ${isActive ? 'text-lh-gold' : 'text-lh-muted'}`
        : `h-10 px-3 rounded-md flex items-center gap-3 text-sm transition-colors ${isActive ? 'bg-lh-gold/10 text-lh-gold' : 'text-lh-muted hover:bg-lh-border/40 hover:text-white'}`}
    >
      <Icon className={compact ? 'w-5 h-5' : 'w-4 h-4'} />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

export function AppShell() {
  const { profile, user, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-lh-bg text-white">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 border-r border-lh-border bg-[#101010] flex-col z-30">
        <div className="h-16 px-5 border-b border-lh-border flex items-center gap-3">
          <div className="w-9 h-9 bg-lh-gold rounded-md flex items-center justify-center">
            <Anchor className="w-4 h-4 text-lh-bg" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">The Lighthouse</p>
            <p className="text-[11px] text-lh-muted">Panel operativo</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-5 space-y-1">
          {navigation.map((item) => <NavigationLink key={item.to} item={item} />)}
        </nav>
        <div className="p-3 border-t border-lh-border">
          <div className="px-3 py-2 min-w-0">
            <p className="text-sm font-medium truncate">{profile?.full_name || user?.email}</p>
            <p className="text-xs text-lh-muted capitalize">{profile?.role}</p>
          </div>
          <button onClick={signOut} className="w-full h-9 px-3 flex items-center gap-3 text-sm text-lh-muted hover:text-white hover:bg-lh-border/40 rounded-md">
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="lg:pl-60 min-h-screen pb-16 lg:pb-0">
        <header className="h-16 sticky top-0 z-20 bg-lh-bg/95 backdrop-blur border-b border-lh-border px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="lg:hidden w-8 h-8 bg-lh-gold rounded-md flex items-center justify-center">
              <Anchor className="w-4 h-4 text-lh-bg" />
            </div>
            <p className="font-semibold truncate">{pageNames[location.pathname] || 'The Lighthouse'}</p>
          </div>
          <NavLink to="/cortes?new=1" className="h-9 px-3 bg-lh-gold text-lh-bg rounded-md text-sm font-semibold flex items-center gap-2">
            <UserRoundPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Registrar corte</span>
          </NavLink>
        </header>
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto">
          <Outlet />
        </main>
      </div>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 h-16 bg-[#101010] border-t border-lh-border z-30 flex">
        {navigation.map((item) => <NavigationLink key={item.to} item={item} compact />)}
      </nav>
    </div>
  );
}
