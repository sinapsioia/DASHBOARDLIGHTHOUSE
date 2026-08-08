import { Field, inputClass, textareaClass } from './ui/FormControls';
import type { ClientInput } from '../types/domain';

export const emptyClientInput: ClientInput = {
  full_name: '',
  phone_e164: '',
  email: '',
  document_id: '',
  birth_date: '',
  address: '',
  whatsapp_opt_in: false,
  notes: '',
};

export function ClientFields({ value, onChange, compact = false }: {
  value: ClientInput;
  onChange: (value: ClientInput) => void;
  compact?: boolean;
}) {
  const set = <K extends keyof ClientInput>(key: K, fieldValue: ClientInput[K]) => {
    onChange({ ...value, [key]: fieldValue });
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nombre completo" required>
          <input className={inputClass} value={value.full_name} onChange={(event) => set('full_name', event.target.value)} required />
        </Field>
        <Field label="Teléfono" required hint="Se utilizará para evitar clientes duplicados.">
          <input className={inputClass} inputMode="tel" value={value.phone_e164} onChange={(event) => set('phone_e164', event.target.value)} placeholder="322 231 7169" required />
        </Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Correo">
          <input className={inputClass} type="email" value={value.email || ''} onChange={(event) => set('email', event.target.value)} />
        </Field>
        <Field label="Documento">
          <input className={inputClass} value={value.document_id || ''} onChange={(event) => set('document_id', event.target.value)} />
        </Field>
      </div>
      {!compact && (
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Fecha de nacimiento">
            <input className={inputClass} type="date" value={value.birth_date || ''} onChange={(event) => set('birth_date', event.target.value)} />
          </Field>
          <Field label="Dirección">
            <input className={inputClass} value={value.address || ''} onChange={(event) => set('address', event.target.value)} />
          </Field>
        </div>
      )}
      <label className="flex items-start gap-3 p-3 border border-lh-border rounded-md cursor-pointer">
        <input
          type="checkbox"
          checked={value.whatsapp_opt_in}
          onChange={(event) => set('whatsapp_opt_in', event.target.checked)}
          className="mt-0.5 accent-[#C9A84C]"
        />
        <span>
          <span className="block text-sm">Autoriza mensajes por WhatsApp</span>
          <span className="block text-xs text-lh-muted mt-0.5">Deja preparado el mensaje de bienvenida para este cliente nuevo.</span>
        </span>
      </label>
      {!compact && (
        <Field label="Notas">
          <textarea className={textareaClass} value={value.notes || ''} onChange={(event) => set('notes', event.target.value)} />
        </Field>
      )}
    </div>
  );
}
