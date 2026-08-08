import { FormEvent, useState } from 'react';
import { Anchor, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-lh-bg text-white grid lg:grid-cols-[minmax(0,1fr)_440px]">
      <section className="hidden lg:flex border-r border-lh-border p-12 flex-col justify-between bg-[radial-gradient(circle_at_15%_15%,rgba(201,168,76,0.13),transparent_34%)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-lh-gold flex items-center justify-center rounded-md">
            <Anchor className="w-5 h-5 text-lh-bg" />
          </div>
          <div>
            <p className="font-semibold">The Lighthouse</p>
            <p className="text-xs text-lh-muted">Barber Studio</p>
          </div>
        </div>
        <div className="max-w-xl">
          <p className="text-lh-gold text-sm font-medium mb-3">Operación centralizada</p>
          <h1 className="text-4xl font-semibold leading-tight">Clientes, cortes y resultados en un solo lugar.</h1>
          <p className="text-lh-muted mt-4 max-w-lg">Acceso exclusivo para el equipo administrativo de The Lighthouse.</p>
        </div>
        <p className="text-xs text-lh-muted">Información protegida y acceso auditado</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-lh-gold flex items-center justify-center rounded-md">
              <Anchor className="w-5 h-5 text-lh-bg" />
            </div>
            <div>
              <p className="font-semibold">The Lighthouse</p>
              <p className="text-xs text-lh-muted">Barber Studio</p>
            </div>
          </div>
          <h2 className="text-2xl font-semibold">Iniciar sesión</h2>
          <p className="text-sm text-lh-muted mt-2">Ingrese con la cuenta asignada por el administrador.</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <label className="block">
              <span className="block text-sm text-lh-muted mb-2">Correo</span>
              <span className="relative block">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-lh-muted" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full h-11 bg-lh-card border border-lh-border rounded-md pl-10 pr-3 text-sm outline-none focus:border-lh-gold"
                />
              </span>
            </label>
            <label className="block">
              <span className="block text-sm text-lh-muted mb-2">Contraseña</span>
              <span className="relative block">
                <LockKeyhole className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-lh-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full h-11 bg-lh-card border border-lh-border rounded-md pl-10 pr-11 text-sm outline-none focus:border-lh-gold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-lh-muted hover:text-white"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </span>
            </label>
            {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-lh-gold text-lh-bg font-semibold rounded-md flex items-center justify-center gap-2 hover:bg-[#d8b95d] disabled:opacity-60"
            >
              {loading && <LoaderCircle className="w-4 h-4 animate-spin" />}
              Entrar
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
