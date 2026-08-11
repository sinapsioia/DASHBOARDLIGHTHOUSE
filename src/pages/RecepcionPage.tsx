import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { CircleCheck, Clock, MessageSquare, Search, UserRound, UserRoundX } from 'lucide-react';
import { ClientFields, emptyClientInput } from '../components/ClientFields';
import { Field, FormActions, FormError, inputClass, textareaClass } from '../components/ui/FormControls';
import { Modal } from '../components/ui/Modal';
import { EmptyState, ErrorBanner, LoadingState, PageHeader, SuccessBanner } from '../components/ui/PageElements';
import { bogotaDateTimeInput, displayPhone, formatDateTime } from '../lib/format';
import { completeAppointment, listPendingWalkins } from '../services/lighthouseDb';
import type { ClientInput, PaymentMethod, PendingWalkin } from '../types/domain';
import { formatCOP } from '../utils/calculations';

const paymentLabels: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro',
};

const sourceLabels: Record<string, string> = {
  walk_in_bot: 'Walk-in',
  bot_booking: 'WhatsApp',
  manual: 'Manual',
  import: 'Importado',
  system: 'Sistema',
};

function SourceTag({ source }: { source: string }) {
  const esWalkin = source === 'walk_in_bot';
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${esWalkin
      ? 'border-lh-gold/40 text-lh-gold bg-lh-gold/10'
      : 'border-lh-border text-lh-muted'}`}>
      {sourceLabels[source] || source}
    </span>
  );
}

export function RecepcionPage() {
  const [pendientes, setPendientes] = useState<PendingWalkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const [seleccionada, setSeleccionada] = useState<PendingWalkin | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState('');
  const [cliente, setCliente] = useState<ClientInput>({ ...emptyClientInput });
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState<PaymentMethod>('cash');
  const [cobradoEn, setCobradoEn] = useState(bogotaDateTimeInput());
  const [notas, setNotas] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPendientes(await listPendingWalkins());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar los pendientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrir = useCallback((fila: PendingWalkin) => {
    setSeleccionada(fila);
    // El barbero deja el nombre en las notas cuando no hay cliente enlazado.
    const nombreSugerido = fila.cliente
      || (fila.notes?.match(/Cliente indicado por el barbero:\s*(.+)$/)?.[1] ?? '');
    setCliente({ ...emptyClientInput, full_name: nombreSugerido.trim() });
    setMonto(fila.precio_sugerido != null ? String(fila.precio_sugerido) : '');
    setMetodo('cash');
    setCobradoEn(bogotaDateTimeInput());
    setNotas('');
    setFormError('');
  }, []);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return pendientes;
    return pendientes.filter((f) => [f.cliente, f.barbero, f.servicio, f.notes]
      .some((v) => (v || '').toLowerCase().includes(q)));
  }, [pendientes, busqueda]);

  const sinIdentificar = useMemo(
    () => pendientes.filter((f) => !f.client_id).length,
    [pendientes],
  );

  const cerrar = async (event: FormEvent) => {
    event.preventDefault();
    if (!seleccionada) return;
    setFormError('');

    const valor = Number(monto);
    if (!Number.isFinite(valor) || valor <= 0) {
      setFormError('Indique un valor mayor que cero.');
      return;
    }
    const requiereCliente = !seleccionada.client_id;
    if (requiereCliente && (!cliente.full_name.trim() || !cliente.phone_e164.trim())) {
      setFormError('Para cerrar un walk-in sin identificar se necesitan nombre y teléfono.');
      return;
    }

    setGuardando(true);
    try {
      const r = await completeAppointment({
        appointmentId: seleccionada.appointment_id,
        client: requiereCliente ? cliente : undefined,
        amount: valor,
        paymentMethod: metodo,
        occurredAt: cobradoEn,
        notes: notas,
      });
      setSuccess(
        r.client_created
          ? `Cobro registrado y cliente creado${r.welcome_queued ? '. Se enviará el mensaje de bienvenida.' : '.'}`
          : 'Cobro registrado.',
      );
      setSeleccionada(null);
      await cargar();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No fue posible cerrar la cita.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Recepción"
        title="Pendientes por cobrar"
        description="Citas ya atendidas que aún no tienen cobro registrado. Aquí se completan los datos del cliente y se cierra el corte."
      />

      {error && <ErrorBanner message={error} />}
      {success && <SuccessBanner message={success} />}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-lh-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className={`${inputClass} pl-9`}
            placeholder="Buscar por cliente, barbero o servicio"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-lh-muted">{pendientes.length} pendientes</span>
          {sinIdentificar > 0 && (
            <span className="flex items-center gap-1.5 text-lh-gold">
              <UserRoundX className="w-4 h-4" />
              {sinIdentificar} sin identificar
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingState label="Cargando pendientes..." />
      ) : filtradas.length === 0 ? (
        <EmptyState
          title="No hay nada pendiente"
          description="Cuando el barbero registre un walk-in o se confirme una cita, aparecerá aquí para cobrar."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtradas.map((fila) => (
            <button
              key={fila.appointment_id}
              onClick={() => abrir(fila)}
              className="text-left border border-lh-border bg-lh-card rounded-md p-4 hover:border-lh-gold/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {fila.cliente ? (
                    <p className="font-medium truncate flex items-center gap-1.5">
                      <UserRound className="w-4 h-4 text-lh-muted shrink-0" />
                      {fila.cliente}
                    </p>
                  ) : (
                    <p className="font-medium truncate flex items-center gap-1.5 text-lh-gold">
                      <UserRoundX className="w-4 h-4 shrink-0" />
                      Sin identificar
                    </p>
                  )}
                  {fila.telefono && (
                    <p className="text-xs text-lh-muted mt-0.5">{displayPhone(fila.telefono)}</p>
                  )}
                </div>
                <SourceTag source={fila.source} />
              </div>

              <div className="mt-3 space-y-1 text-sm">
                <p className="text-lh-muted truncate">{fila.servicio}</p>
                <p className="text-lh-muted">💈 {fila.barbero}</p>
                <p className="text-lh-muted flex items-center gap-1.5 text-xs">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDateTime(fila.starts_at)}
                </p>
              </div>

              {!fila.cliente && fila.notes && (
                <p className="mt-2 text-xs text-lh-muted flex items-start gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{fila.notes}</span>
                </p>
              )}

              <p className="mt-3 text-lg font-semibold text-lh-gold">
                {fila.precio_sugerido != null ? formatCOP(fila.precio_sugerido) : 'Sin precio'}
              </p>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(seleccionada)}
        title="Cerrar y cobrar"
        description={seleccionada
          ? `${seleccionada.servicio} · ${seleccionada.barbero} · ${formatDateTime(seleccionada.starts_at)}`
          : ''}
        onClose={() => setSeleccionada(null)}
      >
        {seleccionada && (
          <form onSubmit={cerrar} className="space-y-5">
            {seleccionada.client_id ? (
              <div className="flex items-center gap-2 p-3 border border-lh-border rounded-md text-sm">
                <CircleCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Cliente ya identificado: <strong>{seleccionada.cliente}</strong>
                  {seleccionada.telefono && ` · ${displayPhone(seleccionada.telefono)}`}
                </span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-2 p-3 bg-lh-gold/10 border border-lh-gold/30 rounded-md text-sm">
                  <UserRoundX className="w-4 h-4 text-lh-gold shrink-0 mt-0.5" />
                  <span className="text-lh-gold">
                    Este walk-in entró sin datos. Complételos para sumarlo al historial del cliente.
                  </span>
                </div>
                <ClientFields value={cliente} onChange={setCliente} compact />
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Valor cobrado" required hint="Se sugiere el precio del servicio; ajústelo si cobró otra cosa.">
                {/* step="1": con step=1000 y min=1 el navegador solo aceptaba
                    1, 1001, 2001... y rechazaba el propio precio sugerido. */}
                <input
                  className={inputClass}
                  type="number"
                  min="1"
                  step="1"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  required
                />
              </Field>
              <Field label="Método de pago" required>
                <select className={inputClass} value={metodo} onChange={(e) => setMetodo(e.target.value as PaymentMethod)}>
                  {Object.entries(paymentLabels).map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>{etiqueta}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Fecha y hora del cobro">
              <input className={inputClass} type="datetime-local" value={cobradoEn} onChange={(e) => setCobradoEn(e.target.value)} />
            </Field>

            <Field label="Notas">
              <textarea className={textareaClass} value={notas} onChange={(e) => setNotas(e.target.value)} />
            </Field>

            {formError && <FormError message={formError} />}

            <FormActions
              onCancel={() => setSeleccionada(null)}
              submitLabel="Registrar cobro"
              loading={guardando}
            />
          </form>
        )}
      </Modal>
    </div>
  );
}
