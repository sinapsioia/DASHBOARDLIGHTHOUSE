import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Plus, Search, Scissors, UserPlus, UserRound, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ClientFields, emptyClientInput } from '../components/ClientFields';
import { Field, FormActions, FormError, inputClass, textareaClass } from '../components/ui/FormControls';
import { EmptyState, ErrorBanner, LoadingState, PageHeader, SuccessBanner } from '../components/ui/PageElements';
import { Modal } from '../components/ui/Modal';
import { bogotaDateKey, bogotaDateTimeInput, displayPhone, formatDateTime } from '../lib/format';
import { findClients, listBarbers, listServices, listServiceTransactions, registerCut } from '../services/lighthouseDb';
import type { Barber, Client, ClientInput, PaymentMethod, Service, ServiceTransaction } from '../types/domain';
import { formatCOP } from '../utils/calculations';

const paymentLabels: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro',
};

export function CutsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [transactions, setTransactions] = useState<ServiceTransaction[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [tableSearch, setTableSearch] = useState('');

  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [newClientMode, setNewClientMode] = useState(false);
  const [newClient, setNewClient] = useState<ClientInput>({ ...emptyClientInput });
  const [barberId, setBarberId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [occurredAt, setOccurredAt] = useState(bogotaDateTimeInput());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [transactionData, barberData, serviceData] = await Promise.all([
        listServiceTransactions(),
        listBarbers(),
        listServices(),
      ]);
      setTransactions(transactionData);
      setBarbers(barberData);
      setServices(serviceData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar los cortes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openModal = useCallback(() => {
    setSelectedClient(null);
    setClientSearch('');
    setClientResults([]);
    setNewClientMode(false);
    setNewClient({ ...emptyClientInput });
    setBarberId('');
    setServiceId('');
    setAmount('');
    setOccurredAt(bogotaDateTimeInput());
    setPaymentMethod('cash');
    setNotes('');
    setFormError('');
    setIdempotencyKey(crypto.randomUUID());
    setModalOpen(true);
  }, []);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openModal();
      setSearchParams({}, { replace: true });
    }
  }, [openModal, searchParams, setSearchParams]);

  useEffect(() => {
    if (newClientMode || selectedClient || clientSearch.trim().length < 2) {
      setClientResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      setClientSearching(true);
      findClients(clientSearch)
        .then(setClientResults)
        .catch((err) => setFormError(err instanceof Error ? err.message : 'No fue posible buscar clientes.'))
        .finally(() => setClientSearching(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [clientSearch, newClientMode, selectedClient]);

  const selectService = (id: string) => {
    setServiceId(id);
    const selectedService = services.find((service) => service.id === id);
    if (selectedService) setAmount(String(selectedService.price));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedClient && !newClientMode) {
      setFormError('Seleccione un cliente o cree uno nuevo.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const result = await registerCut({
        clientId: selectedClient?.id,
        client: newClientMode ? newClient : undefined,
        barberId,
        serviceId,
        amount: Number(amount),
        occurredAt,
        paymentMethod,
        notes,
        idempotencyKey,
      });
      setModalOpen(false);
      setSuccess(result.client_created
        ? `Corte registrado y cliente creado${result.welcome_queued ? '; bienvenida pendiente' : ''}.`
        : 'Corte registrado correctamente.');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No fue posible registrar el corte.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const term = tableSearch.trim().toLowerCase();
    if (!term) return transactions;
    return transactions.filter((transaction) => [
      transaction.client?.full_name,
      transaction.client?.phone_e164,
      transaction.barber_name_snapshot,
      transaction.service_name_snapshot,
    ].some((value) => value?.toLowerCase().includes(term)));
  }, [tableSearch, transactions]);

  const todayTotal = useMemo(() => {
    const today = bogotaDateKey(new Date());
    return transactions
      .filter((transaction) => transaction.status === 'active' && bogotaDateKey(transaction.occurred_at) === today)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  }, [transactions]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operación"
        title="Cortes"
        description="Registre servicios realizados. Las reservas todavía no se contabilizan como ingresos."
        actions={(
          <button onClick={openModal} className="h-10 px-3 bg-lh-gold text-lh-bg rounded-md text-sm font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Registrar corte
          </button>
        )}
      />
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <div className="grid sm:grid-cols-3 border border-lh-border rounded-md divide-y sm:divide-y-0 sm:divide-x divide-lh-border">
        <div className="p-4"><p className="text-xs text-lh-muted">Ingresos de hoy</p><p className="text-xl font-semibold text-emerald-400 mt-1">{formatCOP(todayTotal)}</p></div>
        <div className="p-4"><p className="text-xs text-lh-muted">Cortes registrados</p><p className="text-xl font-semibold mt-1">{transactions.filter((item) => item.status === 'active').length}</p></div>
        <div className="p-4"><p className="text-xs text-lh-muted">Equipo activo</p><p className="text-xl font-semibold mt-1">{barbers.length}</p></div>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-lh-muted" />
        <input value={tableSearch} onChange={(event) => setTableSearch(event.target.value)} className={`${inputClass} pl-10`} placeholder="Buscar cliente, barbero o servicio" />
      </div>

      <section className="border border-lh-border rounded-md overflow-hidden">
        {loading ? <LoadingState label="Cargando cortes..." /> : filtered.length === 0 ? (
          <EmptyState title="No hay cortes registrados" description="Registre el primer servicio realizado desde esta pantalla." />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-lh-card text-lh-muted"><tr><th className="text-left px-4 py-3 font-medium">Fecha</th><th className="text-left px-4 py-3 font-medium">Cliente</th><th className="text-left px-4 py-3 font-medium">Barbero</th><th className="text-left px-4 py-3 font-medium">Servicio</th><th className="text-left px-4 py-3 font-medium">Pago</th><th className="text-right px-4 py-3 font-medium">Valor</th></tr></thead>
                <tbody>
                  {filtered.map((transaction) => (
                    <tr key={transaction.id} className="border-t border-lh-border hover:bg-lh-card/60">
                      <td className="px-4 py-3 text-lh-muted whitespace-nowrap">{formatDateTime(transaction.occurred_at)}</td>
                      <td className="px-4 py-3"><p className="font-medium">{transaction.client?.full_name}</p><p className="text-xs text-lh-muted">{displayPhone(transaction.client?.phone_e164)}</p></td>
                      <td className="px-4 py-3">{transaction.barber_name_snapshot}</td>
                      <td className="px-4 py-3"><p>{transaction.service_name_snapshot}</p><p className="text-xs text-lh-muted">{transaction.service_category_snapshot}</p></td>
                      <td className="px-4 py-3 text-lh-muted">{paymentLabels[transaction.payment_method]}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-400">{formatCOP(transaction.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-lh-border">
              {filtered.map((transaction) => (
                <div key={transaction.id} className="p-4 flex gap-3">
                  <div className="w-9 h-9 bg-lh-card rounded-md flex items-center justify-center shrink-0"><Scissors className="w-4 h-4 text-lh-gold" /></div>
                  <div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><p className="font-medium truncate">{transaction.client?.full_name}</p><p className="text-sm text-emerald-400 font-semibold">{formatCOP(transaction.amount)}</p></div><p className="text-xs text-lh-muted mt-1 truncate">{transaction.service_name_snapshot} · {transaction.barber_name_snapshot}</p><p className="text-xs text-lh-muted mt-1">{formatDateTime(transaction.occurred_at)}</p></div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <Modal open={modalOpen} title="Registrar corte" description="Cliente y servicio realizado" onClose={() => setModalOpen(false)} width="xl">
        <form onSubmit={submit} className="space-y-6">
          <section>
            <div className="flex items-center justify-between mb-3"><div><h3 className="text-sm font-semibold">1. Cliente</h3><p className="text-xs text-lh-muted mt-1">Busque primero para evitar registros duplicados.</p></div>{(selectedClient || newClientMode) && <button type="button" onClick={() => { setSelectedClient(null); setNewClientMode(false); setClientSearch(''); }} className="w-8 h-8 flex items-center justify-center text-lh-muted" aria-label="Cambiar cliente"><X className="w-4 h-4" /></button>}</div>
            {selectedClient ? (
              <div className="border border-lh-gold/50 bg-lh-gold/5 rounded-md p-3 flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-lh-gold/15 flex items-center justify-center"><Check className="w-4 h-4 text-lh-gold" /></div><div><p className="text-sm font-medium">{selectedClient.full_name}</p><p className="text-xs text-lh-muted">{displayPhone(selectedClient.phone_e164)}</p></div></div>
            ) : newClientMode ? (
              <div className="border border-lh-border rounded-md p-4"><div className="flex items-center gap-2 mb-4 text-sm font-medium"><UserPlus className="w-4 h-4 text-lh-gold" /> Cliente nuevo</div><ClientFields value={newClient} onChange={setNewClient} compact /></div>
            ) : (
              <div className="space-y-3">
                <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-lh-muted" /><input className={`${inputClass} pl-10`} value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Nombre o teléfono" /></div>
                {(clientSearching || clientResults.length > 0) && <div className="border border-lh-border rounded-md divide-y divide-lh-border max-h-52 overflow-y-auto">{clientSearching ? <p className="p-3 text-xs text-lh-muted">Buscando...</p> : clientResults.map((client) => <button key={client.id} type="button" onClick={() => setSelectedClient(client)} className="w-full p-3 text-left flex items-center gap-3 hover:bg-lh-border/30"><UserRound className="w-4 h-4 text-lh-muted" /><span><span className="block text-sm">{client.full_name}</span><span className="block text-xs text-lh-muted">{displayPhone(client.phone_e164)}</span></span></button>)}</div>}
                <button type="button" onClick={() => { setNewClientMode(true); setNewClient({ ...emptyClientInput, phone_e164: clientSearch }); }} className="h-9 px-3 border border-lh-border rounded-md text-sm flex items-center gap-2 text-lh-muted hover:text-white"><UserPlus className="w-4 h-4" /> Registrar cliente nuevo</button>
              </div>
            )}
          </section>

          <section className="border-t border-lh-border pt-6">
            <div className="mb-4"><h3 className="text-sm font-semibold">2. Servicio realizado</h3><p className="text-xs text-lh-muted mt-1">Los catálogos se administran desde Configuración.</p></div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Barbero" required><select className={inputClass} required value={barberId} onChange={(event) => setBarberId(event.target.value)}><option value="">Seleccionar</option>{barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.name}</option>)}</select></Field>
              <Field label="Servicio" required><select className={inputClass} required value={serviceId} onChange={(event) => selectService(event.target.value)}><option value="">Seleccionar</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></Field>
              <Field label="Valor" required><input className={inputClass} type="number" min="1" step="1000" required value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
              <Field label="Fecha y hora" required><input className={inputClass} type="datetime-local" required value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} /></Field>
              <Field label="Medio de pago" required><select className={inputClass} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            </div>
            <div className="mt-4"><Field label="Notas"><textarea className={textareaClass} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field></div>
          </section>
          <FormError message={formError} />
          <FormActions loading={saving} submitLabel="Registrar corte" onCancel={() => setModalOpen(false)} />
        </form>
      </Modal>
    </div>
  );
}
