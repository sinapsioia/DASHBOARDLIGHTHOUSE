import { requireSupabase } from '../lib/supabase';
import { bogotaLocalDateTimeToIso, normalizePhone, safeSearchTerm } from '../lib/format';
import type {
  Barber,
  Client,
  ClientInput,
  CompleteAppointmentInput,
  CompleteAppointmentResult,
  PendingWalkin,
  RegisterCutInput,
  RegisterCutResult,
  Service,
  ServiceTransaction,
} from '../types/domain';

function messageForError(error: { code?: string; message?: string } | null, fallback: string) {
  if (!error) return fallback;
  if (error.code === '23505') return 'Ya existe un registro con esos datos.';
  if (error.code === '42501') return 'No tiene permisos para realizar esta acción.';
  return error.message || fallback;
}

async function currentUserId() {
  const client = requireSupabase();
  const { data } = await client.auth.getUser();
  if (!data.user) throw new Error('La sesión expiró. Inicie sesión nuevamente.');
  return data.user.id;
}

export async function listClients(search = '', limit = 100): Promise<Client[]> {
  const client = requireSupabase();
  let query = client.from('clients').select('*').order('created_at', { ascending: false }).limit(limit);
  const term = safeSearchTerm(search);
  if (term) {
    query = query.or(`full_name.ilike.%${term}%,phone_e164.ilike.%${term}%,email.ilike.%${term}%`);
  }
  const { data, error } = await query;
  if (error) throw new Error(messageForError(error, 'No fue posible cargar los clientes.'));
  return (data || []) as Client[];
}

export async function findClients(search: string): Promise<Client[]> {
  if (search.trim().length < 2) return [];
  return listClients(search, 12);
}

export async function createClient(input: ClientInput): Promise<Client> {
  const client = requireSupabase();
  const createdBy = await currentUserId();
  const { data, error } = await client
    .from('clients')
    .insert({
      ...input,
      phone_e164: normalizePhone(input.phone_e164),
      email: input.email?.trim() || null,
      document_id: input.document_id?.trim() || null,
      birth_date: input.birth_date || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
      source: 'manual',
      created_by: createdBy,
    })
    .select('*')
    .single();
  if (error) throw new Error(messageForError(error, 'No fue posible crear el cliente.'));
  return data as Client;
}

export async function updateClient(id: string, input: ClientInput): Promise<Client> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('clients')
    .update({
      ...input,
      phone_e164: normalizePhone(input.phone_e164),
      email: input.email?.trim() || null,
      document_id: input.document_id?.trim() || null,
      birth_date: input.birth_date || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(messageForError(error, 'No fue posible actualizar el cliente.'));
  return data as Client;
}

export async function listBarbers(includeInactive = false): Promise<Barber[]> {
  const client = requireSupabase();
  let query = client.from('barbers').select('*').order('sort_order').order('name');
  if (!includeInactive) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw new Error(messageForError(error, 'No fue posible cargar los barberos.'));
  return (data || []) as Barber[];
}

export async function saveBarber(input: Partial<Barber> & Pick<Barber, 'name'>): Promise<Barber> {
  const client = requireSupabase();
  const payload = {
    name: input.name.trim(),
    aliases: input.aliases || [],
    active: input.active ?? true,
    sort_order: Number(input.sort_order || 0),
    calendar_external_id: input.calendar_external_id?.trim() || null,
    telegram_chat_id: input.telegram_chat_id?.trim() || null,
    phone_e164: input.phone_e164 ? normalizePhone(input.phone_e164) : null,
    color: input.color || '#C9A84C',
  };
  const query = input.id
    ? client.from('barbers').update(payload).eq('id', input.id)
    : client.from('barbers').insert(payload);
  const { data, error } = await query.select('*').single();
  if (error) throw new Error(messageForError(error, 'No fue posible guardar el barbero.'));
  return data as Barber;
}

export async function listServices(includeInactive = false): Promise<Service[]> {
  const client = requireSupabase();
  let query = client.from('services').select('*').order('sort_order').order('name');
  if (!includeInactive) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw new Error(messageForError(error, 'No fue posible cargar los servicios.'));
  return (data || []).map((item) => ({ ...item, price: Number(item.price) })) as Service[];
}

export async function saveService(input: Partial<Service> & Pick<Service, 'code' | 'name' | 'category'>): Promise<Service> {
  const client = requireSupabase();
  const payload = {
    code: input.code.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    name: input.name.trim(),
    aliases: input.aliases || [],
    category: input.category.trim(),
    price: Number(input.price || 0),
    duration_minutes: Number(input.duration_minutes || 0),
    active: input.active ?? true,
    sort_order: Number(input.sort_order || 0),
  };
  const query = input.id
    ? client.from('services').update(payload).eq('id', input.id)
    : client.from('services').insert(payload);
  const { data, error } = await query.select('*').single();
  if (error) throw new Error(messageForError(error, 'No fue posible guardar el servicio.'));
  return { ...data, price: Number(data.price) } as Service;
}

const transactionSelection = `
  *,
  client:clients(id, full_name, phone_e164),
  barber:barbers(id, name, color),
  service:services(id, name, category)
`;

export async function listServiceTransactions(limit = 150): Promise<ServiceTransaction[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('service_transactions')
    .select(transactionSelection)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(messageForError(error, 'No fue posible cargar los cortes.'));
  return (data || []).map((item) => ({ ...item, amount: Number(item.amount) })) as unknown as ServiceTransaction[];
}

export async function listClientTransactions(clientId: string): Promise<ServiceTransaction[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('service_transactions')
    .select(transactionSelection)
    .eq('client_id', clientId)
    .order('occurred_at', { ascending: false });
  if (error) throw new Error(messageForError(error, 'No fue posible cargar el historial.'));
  return (data || []).map((item) => ({ ...item, amount: Number(item.amount) })) as unknown as ServiceTransaction[];
}

export async function registerCut(input: RegisterCutInput): Promise<RegisterCutResult> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('register_service_transaction', {
    p_client_id: input.clientId || null,
    p_client: input.client || {},
    p_barber_id: input.barberId,
    p_service_id: input.serviceId,
    p_amount: input.amount,
    p_occurred_at: bogotaLocalDateTimeToIso(input.occurredAt),
    p_payment_method: input.paymentMethod,
    p_notes: input.notes?.trim() || null,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(messageForError(error, 'No fue posible registrar el corte.'));
  return data as RegisterCutResult;
}

/**
 * Bandeja de recepcion: citas confirmadas que todavia no tienen cobro.
 * Incluye los walk-ins que el barbero registro sin identificar al cliente.
 */
export async function listPendingWalkins(): Promise<PendingWalkin[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('walkins_pendientes')
    .select('*')
    .order('starts_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(messageForError(error, 'No fue posible cargar los pendientes por cobrar.'));
  return (data || []) as PendingWalkin[];
}

/** Cierre de recepcion: identifica al cliente, completa la cita y cobra. */
export async function completeAppointment(input: CompleteAppointmentInput): Promise<CompleteAppointmentResult> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('complete_appointment', {
    payload: {
      appointment_id: input.appointmentId,
      client: input.client
        ? {
            full_name: input.client.full_name,
            phone: normalizePhone(input.client.phone_e164),
            email: input.client.email || null,
            document_id: input.client.document_id || null,
            birth_date: input.client.birth_date || null,
            address: input.client.address || null,
          }
        : undefined,
      whatsapp_opt_in: input.client?.whatsapp_opt_in ?? false,
      amount: input.amount,
      payment_method: input.paymentMethod,
      occurred_at: input.occurredAt ? bogotaLocalDateTimeToIso(input.occurredAt) : undefined,
      notes: input.notes?.trim() || null,
    },
  });
  if (error) throw new Error(messageForError(error, 'No fue posible cerrar la cita.'));
  return data as CompleteAppointmentResult;
}
