import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-xs uppercase text-lh-gold font-medium mb-1">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="text-sm text-lh-muted mt-1 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Cargando...' }: { label?: string }) {
  return (
    <div className="h-44 flex items-center justify-center gap-2 text-sm text-lh-muted">
      <LoaderCircle className="w-4 h-4 animate-spin" /> {label}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-h-44 flex flex-col items-center justify-center text-center p-6">
      <Inbox className="w-6 h-6 text-lh-muted mb-3" />
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-lh-muted mt-1 max-w-sm">{description}</p>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="flex gap-2 items-start border border-red-800/60 bg-red-950/30 text-red-300 rounded-md p-3 text-sm">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      {message}
    </div>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  if (!message) return null;
  return <div className="border border-emerald-800/60 bg-emerald-950/30 text-emerald-300 rounded-md p-3 text-sm">{message}</div>;
}
