import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: 'md' | 'lg' | 'xl';
}

const widths = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, title, description, onClose, children, width = 'lg' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/75 p-0 sm:p-6 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className={`w-full ${widths[width]} max-h-[94vh] bg-lh-card border border-lh-border sm:rounded-md shadow-2xl flex flex-col`}>
        <div className="h-16 px-5 border-b border-lh-border flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h2 className="font-semibold truncate">{title}</h2>
            {description && <p className="text-xs text-lh-muted mt-0.5 truncate">{description}</p>}
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-lh-muted hover:text-white" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
