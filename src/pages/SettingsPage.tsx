import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CalendarDays, Edit3, Plus, Scissors, Send, UserRound } from 'lucide-react';
import { Field, FormActions, FormError, inputClass } from '../components/ui/FormControls';
import { EmptyState, ErrorBanner, LoadingState, PageHeader, SuccessBanner } from '../components/ui/PageElements';
import { Modal } from '../components/ui/Modal';
import { listBarbers, listServices, saveBarber, saveService } from '../services/lighthouseDb';
import type { Barber, Service } from '../types/domain';
import { formatCOP } from '../utils/calculations';

type Tab = 'barbers' | 'services';

const emptyBarber: Partial<Barber> & Pick<Barber, 'name'> = {
  name: '', aliases: [], active: true, sort_order: 0, calendar_external_id: '', telegram_chat_id: '', phone_e164: '', color: '#C9A84C',
};

const emptyService: Partial<Service> & Pick<Service, 'code' | 'name' | 'category'> = {
  code: '', name: '', aliases: [], category: '', price: 0, duration_minutes: 45, active: true, sort_order: 0,
};

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('barbers');
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [barberOpen, setBarberOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [barberForm, setBarberForm] = useState({ ...emptyBarber });
  const [serviceForm, setServiceForm] = useState({ ...emptyService });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [barberData, serviceData] = await Promise.all([listBarbers(true), listServices(true)]);
      setBarbers(barberData);
      setServices(serviceData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar la configuración.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openBarber = (barber?: Barber) => {
    setBarberForm(barber ? { ...barber } : { ...emptyBarber, sort_order: (barbers.length + 1) * 10 });
    setFormError('');
    setBarberOpen(true);
  };

  const openService = (service?: Service) => {
    setServiceForm(service ? { ...service } : { ...emptyService, sort_order: (services.length + 1) * 10 });
    setFormError('');
    setServiceOpen(true);
  };

  const submitBarber = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await saveBarber(barberForm);
      setBarberOpen(false);
      setSuccess('Equipo actualizado. Los formularios ya utilizarán este catálogo.');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No fue posible guardar el barbero.');
    } finally {
      setSaving(false);
    }
  };

  const submitService = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await saveService(serviceForm);
      setServiceOpen(false);
      setSuccess('Servicio actualizado correctamente.');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No fue posible guardar el servicio.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administración" title="Configuración" description="Cambie el equipo y los servicios sin editar código ni desplegar una nueva versión." />
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <div className="border-b border-lh-border flex gap-6">
        <button onClick={() => setTab('barbers')} className={`h-11 text-sm border-b-2 ${tab === 'barbers' ? 'border-lh-gold text-white' : 'border-transparent text-lh-muted'}`}>Equipo</button>
        <button onClick={() => setTab('services')} className={`h-11 text-sm border-b-2 ${tab === 'services' ? 'border-lh-gold text-white' : 'border-transparent text-lh-muted'}`}>Servicios</button>
      </div>

      {loading ? <LoadingState /> : tab === 'barbers' ? (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4"><div><h2 className="font-semibold">Barberos</h2><p className="text-xs text-lh-muted mt-1">Desactive integrantes con historial; no es necesario eliminarlos.</p></div><button onClick={() => openBarber()} className="h-9 px-3 bg-lh-gold text-lh-bg rounded-md text-sm font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Agregar</button></div>
          {barbers.length === 0 ? <EmptyState title="No hay barberos" description="Agregue el primer integrante del equipo." /> : (
            <div className="border border-lh-border rounded-md divide-y divide-lh-border">
              {barbers.map((barber) => (
                <div key={barber.id} className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${barber.color}22`, color: barber.color }}><UserRound className="w-5 h-5" /></div>
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="font-medium truncate">{barber.name}</p><span className={`text-[11px] px-1.5 py-0.5 rounded ${barber.active ? 'text-emerald-300 bg-emerald-950/40' : 'text-lh-muted bg-lh-border/30'}`}>{barber.active ? 'Activo' : 'Inactivo'}</span></div><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-lh-muted mt-1"><span className={`flex items-center gap-1 ${barber.active && !barber.calendar_external_id ? 'text-amber-300' : ''}`}><CalendarDays className="w-3 h-3" /> {barber.calendar_external_id ? 'Calendar configurado' : 'Falta Calendar'}</span><span className={`flex items-center gap-1 ${barber.active && !barber.telegram_chat_id ? 'text-amber-300' : ''}`}><Send className="w-3 h-3" /> {barber.telegram_chat_id ? 'Telegram configurado' : 'Falta Telegram'}</span><span>Orden {barber.sort_order}</span></div></div>
                  <button onClick={() => openBarber(barber)} className="w-9 h-9 flex items-center justify-center text-lh-muted hover:text-white" aria-label={`Editar ${barber.name}`}><Edit3 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4"><div><h2 className="font-semibold">Servicios</h2><p className="text-xs text-lh-muted mt-1">Precio y duración se aplican como valores sugeridos al registrar cortes.</p></div><button onClick={() => openService()} className="h-9 px-3 bg-lh-gold text-lh-bg rounded-md text-sm font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Agregar</button></div>
          {services.length === 0 ? <EmptyState title="No hay servicios" description="Agregue el primer servicio del catálogo." /> : (
            <div className="border border-lh-border rounded-md divide-y divide-lh-border">
              {services.map((service) => (
                <div key={service.id} className="p-4 flex items-center gap-4"><div className="w-10 h-10 bg-lh-card rounded-md flex items-center justify-center shrink-0"><Scissors className="w-5 h-5 text-lh-gold" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="font-medium truncate">{service.name}</p><span className={`text-[11px] px-1.5 py-0.5 rounded ${service.active ? 'text-emerald-300 bg-emerald-950/40' : 'text-lh-muted bg-lh-border/30'}`}>{service.active ? 'Activo' : 'Inactivo'}</span></div><p className="text-xs text-lh-muted mt-1">{service.category} · {service.duration_minutes} min · {formatCOP(service.price)}</p></div><button onClick={() => openService(service)} className="w-9 h-9 flex items-center justify-center text-lh-muted hover:text-white" aria-label={`Editar ${service.name}`}><Edit3 className="w-4 h-4" /></button></div>
              ))}
            </div>
          )}
        </section>
      )}

      <Modal open={barberOpen} title={barberForm.id ? 'Editar barbero' : 'Agregar barbero'} description="El cambio se refleja inmediatamente en el registro de cortes" onClose={() => setBarberOpen(false)}>
        <form onSubmit={submitBarber} className="space-y-5">
          <div className="grid sm:grid-cols-[1fr_100px] gap-4"><Field label="Nombre" required><input className={inputClass} required value={barberForm.name} onChange={(event) => setBarberForm({ ...barberForm, name: event.target.value })} /></Field><Field label="Orden"><input className={inputClass} type="number" value={barberForm.sort_order || 0} onChange={(event) => setBarberForm({ ...barberForm, sort_order: Number(event.target.value) })} /></Field></div>
          <div className="grid sm:grid-cols-2 gap-4"><Field label="Teléfono"><input className={inputClass} inputMode="tel" value={barberForm.phone_e164 || ''} onChange={(event) => setBarberForm({ ...barberForm, phone_e164: event.target.value })} /></Field><Field label="Color"><input className={`${inputClass} p-1`} type="color" value={barberForm.color || '#C9A84C'} onChange={(event) => setBarberForm({ ...barberForm, color: event.target.value })} /></Field></div>
          <Field label="Alias" hint="Nombres anteriores o variaciones, separados por coma."><input className={inputClass} value={(barberForm.aliases || []).join(', ')} onChange={(event) => setBarberForm({ ...barberForm, aliases: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="Jeison, Jeyson" /></Field>
          <Field label="Google Calendar ID" hint="Será utilizado por la integración dinámica con n8n."><input className={inputClass} value={barberForm.calendar_external_id || ''} onChange={(event) => setBarberForm({ ...barberForm, calendar_external_id: event.target.value })} /></Field>
          <Field label="Telegram Chat ID" hint="Destino para notificaciones internas del barbero."><input className={inputClass} value={barberForm.telegram_chat_id || ''} onChange={(event) => setBarberForm({ ...barberForm, telegram_chat_id: event.target.value })} /></Field>
          <label className="flex items-center gap-3 p-3 border border-lh-border rounded-md"><input type="checkbox" checked={barberForm.active ?? true} onChange={(event) => setBarberForm({ ...barberForm, active: event.target.checked })} className="accent-[#C9A84C]" /><span className="text-sm">Disponible para nuevos registros</span></label>
          <FormError message={formError} /><FormActions loading={saving} submitLabel="Guardar barbero" onCancel={() => setBarberOpen(false)} />
        </form>
      </Modal>

      <Modal open={serviceOpen} title={serviceForm.id ? 'Editar servicio' : 'Agregar servicio'} onClose={() => setServiceOpen(false)}>
        <form onSubmit={submitService} className="space-y-5">
          <Field label="Nombre" required><input className={inputClass} required value={serviceForm.name} onChange={(event) => { const name = event.target.value; setServiceForm({ ...serviceForm, name, code: serviceForm.id ? serviceForm.code : name }); }} /></Field>
          <div className="grid sm:grid-cols-2 gap-4"><Field label="Código interno" required><input className={inputClass} required value={serviceForm.code} onChange={(event) => setServiceForm({ ...serviceForm, code: event.target.value })} /></Field><Field label="Categoría" required><input className={inputClass} required value={serviceForm.category} onChange={(event) => setServiceForm({ ...serviceForm, category: event.target.value })} /></Field></div>
          <Field label="Alias" hint="Variaciones utilizadas por bots o registros históricos."><input className={inputClass} value={(serviceForm.aliases || []).join(', ')} onChange={(event) => setServiceForm({ ...serviceForm, aliases: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></Field>
          <div className="grid sm:grid-cols-3 gap-4"><Field label="Precio" required><input className={inputClass} type="number" min="0" step="1000" required value={serviceForm.price || 0} onChange={(event) => setServiceForm({ ...serviceForm, price: Number(event.target.value) })} /></Field><Field label="Duración" required><input className={inputClass} type="number" min="5" step="5" required value={serviceForm.duration_minutes || 0} onChange={(event) => setServiceForm({ ...serviceForm, duration_minutes: Number(event.target.value) })} /></Field><Field label="Orden"><input className={inputClass} type="number" value={serviceForm.sort_order || 0} onChange={(event) => setServiceForm({ ...serviceForm, sort_order: Number(event.target.value) })} /></Field></div>
          <label className="flex items-center gap-3 p-3 border border-lh-border rounded-md"><input type="checkbox" checked={serviceForm.active ?? true} onChange={(event) => setServiceForm({ ...serviceForm, active: event.target.checked })} className="accent-[#C9A84C]" /><span className="text-sm">Disponible para nuevos registros</span></label>
          <FormError message={formError} /><FormActions loading={saving} submitLabel="Guardar servicio" onCancel={() => setServiceOpen(false)} />
        </form>
      </Modal>
    </div>
  );
}
