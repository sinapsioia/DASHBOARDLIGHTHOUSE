import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { appConfig } from './lib/config';
import { ConfigurationPage, LoadingPage, UnauthorizedPage } from './pages/AccessStatePage';
import { LoginPage } from './pages/LoginPage';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const ClientsPage = lazy(() => import('./pages/ClientsPage').then((module) => ({ default: module.ClientsPage })));
const CutsPage = lazy(() => import('./pages/CutsPage').then((module) => ({ default: module.CutsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));

function ProtectedApplication() {
  const { session, initializing, authorized } = useAuth();
  if (initializing) return <LoadingPage />;
  if (!session) return <LoginPage />;
  if (!authorized) return <UnauthorizedPage />;
  return (
    <Suspense fallback={<LoadingPage />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="clientes" element={<ClientsPage />} />
          <Route path="cortes" element={<CutsPage />} />
          <Route path="configuracion" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  if (appConfig.configurationError) {
    return <ConfigurationPage message={appConfig.configurationError} />;
  }
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProtectedApplication />
      </AuthProvider>
    </BrowserRouter>
  );
}
