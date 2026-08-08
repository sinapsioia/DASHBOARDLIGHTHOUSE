interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}

export const inputClass = 'w-full h-10 bg-lh-bg border border-lh-border rounded-md px-3 text-sm text-white outline-none focus:border-lh-gold disabled:opacity-50';
export const textareaClass = 'w-full min-h-20 bg-lh-bg border border-lh-border rounded-md px-3 py-2 text-sm text-white outline-none focus:border-lh-gold resize-y';

export function Field({ label, required, hint, children }: FieldProps) {
  return (
    <label className="block min-w-0">
      <span className="flex items-center gap-1 text-xs font-medium text-lh-muted mb-2">
        {label}{required && <span className="text-lh-gold">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-lh-muted mt-1.5">{hint}</span>}
    </label>
  );
}

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return <p className="text-sm text-red-400" role="alert">{message}</p>;
}

export function FormActions({
  loading,
  submitLabel,
  onCancel,
}: {
  loading: boolean;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex justify-end gap-3 pt-5 border-t border-lh-border">
      <button type="button" onClick={onCancel} className="h-10 px-4 text-sm text-lh-muted hover:text-white">Cancelar</button>
      <button type="submit" disabled={loading} className="h-10 px-4 bg-lh-gold text-lh-bg font-semibold text-sm rounded-md disabled:opacity-60">
        {loading ? 'Guardando...' : submitLabel}
      </button>
    </div>
  );
}
