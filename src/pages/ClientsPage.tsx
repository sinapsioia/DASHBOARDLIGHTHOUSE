import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Download, Edit3, MessageCircle, Plus, Search, UserRound } from 'lucide-react';
import { ClientFields, emptyClientInput } from '../components/ClientFields';
import { Field, FormActions, FormError, inputClass } from '../components/ui/FormControls';
import { EmptyState, ErrorBanner, LoadingState, PageHeader, SuccessBanner } from '../components/ui/PageElements';
import { Modal } from '../components/ui/Modal';
import { displayPhone, formatDate, formatDateTime } from '../lib/format';
import { formatCOP } from '../utils/calculations';
import { createClient, listClients, listClientTransactions, updateClient } from '../services/lighthouseDb';
import type { Client, ClientInput, ServiceTransaction } from '../types/domain';

function toInput(client: Client): ClientInput {
  return {
    full_name: client.full_name,
    phone_e164: client.phone_e164,
    email: client.email || '',
    document_id: client.document_id || '',
    birth_date: client.birth_date || '',
    address: client.address || '',
    whatsapp_opt_in: client.whatsapp_opt_in,
    notes: client.notes || '',
  };
}

function WelcomeLabel({ client }: { client: Client }) {
  const styles = {
    pending: 'text-amber-300 bg-amber-950/40',
    sent: 'text-emerald-300 bg-emerald-950/40',
    failed: 'text-red-300 bg-red-950/40',
    skipped: 'text-lh-muted bg-lh-border/30',
    not_requested: 'text-lh-muted bg-lh-border/30',
  };
  const labels = {
    pending: 'Bienvenida pendiente',
    sent: 'Bienvenida enviada',
    failed: 'Bienvenida fallida',
    skipped: 'Sin autorización',
    not_requested: 'No solicitada',
  };
  return <span className={`inline-flex px-2 py-1 rounded text-xs ${styles[client.welcome_status]}`}>{labels[client.welcome_status]}</span>;
}

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientInput>(emptyClientInput);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [selected, setSelected] = useState<Client | null>(null);
  const [history, setHistory] = useState<ServiceTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async (term = '') => {
    setLoading(true);
    setError('');
    try {
      setClients(await listClients(term));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar los clientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => load(search), 250);
    return () => window.clearTimeout(timer);
  }, [load, search]);

  useEffect(() => {
    if (!selected) {
      setHistory([]);
      return;
    }
    setHistoryLoading(true);
    listClientTransactions(selected.id)
      .then(setHistory)
      .catch((err) => setError(err instanceof Error ? err.message : 'No fue posible cargar el historial.'))
      .finally(() => setHistoryLoading(false));
  }, [selected]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyClientInput });
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditing(client);
    setForm(toInput(client));
    setFormError('');
    setFormOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const saved = editing ? await updateClient(editing.id, form) : await createClient(form);
      setFormOpen(false);
      setSuccess(editing ? 'Cliente actualizado correctamente.' : `Cliente creado${saved.welcome_status === 'pending' ? ' y bienvenida encolada' : ''}.`);
      await load(search);
      if (selected?.id === saved.id) setSelected(saved);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No fue posible guardar el cliente.');
    } finally {
      setSaving(false);
    }
  };

  const exportClients = () => {
    const escape = (value: string | boolean | null) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['Nombre', 'Teléfono', 'Email', 'Documento', 'Fecha nacimiento', 'Dirección', 'Autoriza WhatsApp', 'Estado bienvenida', 'Origen', 'Notas', 'Fecha registro'];
    const rows = clients.map((client) => [client.full_name, client.phone_e164, client.email, client.document_id, client.birth_date, client.address, client.whatsapp_opt_in, client.welcome_status, client.source, client.notes, client.created_at].map(escape).join(','));
    const blob = new Blob([`\uFEFF${header.map(escape).join(',')}\n${rows.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `lighthouse-clientes-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Base de clientes"
        title="Clientes"
        description="Consulte datos de contacto e historial de servicios sin entrar a Google Sheets."
        actions={(
          <>
            <button onClick={exportClients} disabled={!clients.length} className="h-10 px-3 border border-lh-border rounded-md text-sm flex items-center gap-2 text-lh-muted hover:text-white disabled:opacity-50"><Download className="w-4 h-4" /> Exportar</button>
            <button onClick={openCreate} className="h-10 px-3 bg-lh-gold text-lh-bg rounded-md text-sm font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Nuevo cliente</button>
          </>
        )}
      />
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <div className="flex items-center gap-3">
        <Field label="Buscar por nombre, teléfono o correo">
          <span className="relative block w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-lh-muted" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputClass} pl-10`} placeholder="Buscar cliente" />
          </span>
        </Field>
      </div>

      <section className="border border-lh-border rounded-md overflow-hidden">
        {loading ? <LoadingState label="Cargando clientes..." /> : clients.length === 0 ? (
          <EmptyState title="No hay clientes para mostrar" description="Registre el primer cliente o cambie el término de búsqueda." />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-lh-card text-lh-muted">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Cliente</th>
                    <th className="text-left font-medium px-4 py-3">Contacto</th>
                    <th className="text-left font-medium px-4 py-3">Origen</th>
                    <th className="text-left font-medium px-4 py-3">WhatsApp</th>
                    <th className="text-left font-medium px-4 py-3">Registro</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className="border-t border-lh-border hover:bg-lh-card/60">
                      <td className="px-4 py-3">
                        <button onClick={() => setSelected(client)} className="text-left font-medium hover:text-lh-gold">{client.full_name}</button>
                        <p className="text-xs text-lh-muted mt-0.5">{client.document_id || 'Sin documento'}</p>
                      </td>
                      <td className="px-4 py-3"><p>{displayPhone(client.phone_e164)}</p><p className="text-xs text-lh-muted">{client.email || 'Sin correo'}</p></td>
                      <td className="px-4 py-3 text-lh-muted capitalize">{client.source.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3"><WelcomeLabel client={client} /></td>
                      <td className="px-4 py-3 text-lh-muted">{formatDateTime(client.created_at)}</td>
                      <td className="px-2 py-3"><button onClick={() => openEdit(client)} className="w-8 h-8 flex items-center justify-center text-lh-muted hover:text-white" aria-label="Editar cliente"><Edit3 className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-lh-border">
              {clients.map((client) => (
                <button key={client.id} onClick={() => setSelected(client)} className="w-full p-4 text-left flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-lh-card flex items-center justify-center shrink-0"><UserRound className="w-4 h-4 text-lh-gold" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{client.full_name}</p>
                    <p className="text-xs text-lh-muted mt-1">{displayPhone(client.phone_e164)}</p>
                    <div className="mt-2"><WelcomeLabel client={client} /></div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <Modal open={formOpen} title={editing ? 'Editar cliente' : 'Nuevo cliente'} onClose={() => setFormOpen(false)}>
        <form onSubmit={submit} className="space-y-5">
          <ClientFields value={form} onChange={setForm} />
          <FormError message={formError} />
          <FormActions loading={saving} submitLabel={editing ? 'Guardar cambios' : 'Crear cliente'} onCancel={() => setFormOpen(false)} />
        </form>
      </Modal>

      <Modal open={Boolean(selected)} title={selected?.full_name || 'Cliente'} description={selected ? displayPhone(selected.phone_e164) : ''} onClose={() => setSelected(null)} width="xl">
        {selected && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-lh-border border border-lh-border rounded-md overflow-hidden">
              {[
                ['Correo', selected.email || 'Sin correo'],
                ['Documento', selected.document_id || 'Sin documento'],
                ['Nacimiento', selected.birth_date ? formatDate(selected.birth_date) : 'Sin fecha'],
                ['Origen', selected.source.replace(/_/g, ' ')],
              ].map(([label, value]) => (
                <div key={label} className="bg-lh-bg p-3"><p className="text-xs text-lh-muted">{label}</p><p className="text-sm mt-1 capitalize truncate">{value}</p></div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div><h3 className="font-semibold">Historial de cortes</h3><p className="text-xs text-lh-muted mt-1">Servicios efectivamente registrados.</p></div>
              <button onClick={() => { openEdit(selected); }} className="h-9 px-3 border border-lh-border rounded-md text-sm flex items-center gap-2"><Edit3 className="w-4 h-4" /> Editar</button>
            </div>
            {historyLoading ? <LoadingState /> : history.length === 0 ? (
              <EmptyState title="Sin cortes registrados" description="Las citas no se cuentan aquí hasta registrar el servicio realizado." />
            ) : (
              <div className="border border-lh-border rounded-md divide-y divide-lh-border">
                {history.map((transaction) => (
                  <div key={transaction.id} className="p-3 flex items-start justify-between gap-3">
                    <div><p className="text-sm font-medium">{transaction.service_name_snapshot}</p><p className="text-xs text-lh-muted mt-1">{transaction.barber_name_snapshot} · {formatDateTime(transaction.occurred_at)}</p></div>
                    <p className="text-sm font-semibold text-emerald-400">{formatCOP(transaction.amount)}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-lh-muted"><MessageCircle className="w-4 h-4" /><WelcomeLabel client={selected} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
