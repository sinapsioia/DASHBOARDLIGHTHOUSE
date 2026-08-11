-- Permitir walk-ins sin cliente identificado.
--
-- El bot de walk-ins recibe mensajes de una linea ("Agenda a Jhonatan Gomez, a
-- las 12:30 con luis, para un servicio de 55.000"): trae nombre, barbero,
-- servicio, precio y hora, pero no telefono. Y el telefono es justo la llave que
-- une un corte con un cliente.
--
-- Exigirlo bloquearia al operador en plena atencion, que es lo contrario de como
-- debe comportarse el walk-in. Asi que la cita puede registrarse sin cliente,
-- pero SOLO cuando viene del bot de walk-ins: una reserva por WhatsApp siempre
-- tiene telefono y debe seguir exigiendolo.
--
-- El circuito real del walk-in es: el barbero lo registra por Telegram, hace el
-- corte, y despues el cliente pasa por recepcion, que completa los datos y cobra.
-- Por eso una cita sin cliente no es un hueco sino una COLA DE TRABAJO: la vista
-- walkins_pendientes la expone y complete_appointment la cierra, creando en ese
-- momento el cliente y la transaccion.

alter table public.appointments alter column client_id drop not null;

alter table public.appointments
  add constraint appointments_client_required
  check (client_id is not null or source = 'walk_in_bot');

comment on constraint appointments_client_required on public.appointments is
  'Solo un walk-in puede quedar sin cliente: el operador no siempre tiene el telefono.';

-- ------------------------------------------------------- RPC actualizada

create or replace function public.register_bot_appointment(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action           text := coalesce(nullif(payload ->> 'action', ''), 'book');
  v_source           public.record_source;
  v_source_id        text := nullif(payload ->> 'source_id', '');
  v_calendar_id      text := nullif(payload ->> 'calendar_event_id', '');
  v_previous_cal_id  text := nullif(payload ->> 'previous_calendar_event_id', '');
  v_client           jsonb := coalesce(payload -> 'client', '{}'::jsonb);
  v_phone_raw        text;
  v_phone            text;
  v_client_id        uuid;
  v_client_created   boolean := false;
  v_welcome_queued   boolean := false;
  v_barber_id        uuid;
  v_service_id       uuid;
  v_duration         integer;
  v_price            numeric(12, 2);
  v_starts_at        timestamptz;
  v_ends_at          timestamptz;
  v_appointment_id   uuid;
  v_created          boolean := false;
  v_previous_id      uuid;
  v_opt_in           boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_app_admin() then
    raise exception 'No tiene permisos para registrar citas de bot';
  end if;

  if v_action not in ('book', 'reschedule', 'cancel') then
    raise exception 'action debe ser book, reschedule o cancel (recibido: %)', v_action;
  end if;

  begin
    v_source := coalesce(nullif(payload ->> 'source', ''), 'bot_booking')::public.record_source;
  exception when others then
    raise exception 'source no valido: %', payload ->> 'source';
  end;

  -- ------------------------------------------------------------- cancelacion
  if v_action = 'cancel' then
    if v_calendar_id is null then
      raise exception 'Para cancelar se requiere calendar_event_id';
    end if;
    update public.appointments
       set status = 'cancelled', updated_at = now()
     where calendar_event_id = v_calendar_id
     returning id into v_appointment_id;

    return jsonb_build_object(
      'ok', v_appointment_id is not null,
      'action', 'cancel',
      'appointment_id', v_appointment_id,
      'message', case when v_appointment_id is null
                      then 'No habia ninguna cita con ese calendar_event_id'
                      else 'Cita marcada como cancelada' end
    );
  end if;

  -- ------------------------------------------------------------ validaciones
  v_barber_id := public.resolve_barber_id(payload ->> 'barber');
  if v_barber_id is null then
    raise exception 'Barbero no reconocido: %', coalesce(payload ->> 'barber', '(vacio)');
  end if;

  v_service_id := public.resolve_service_id(payload ->> 'service');
  if v_service_id is null then
    raise exception 'Servicio no reconocido: %', coalesce(payload ->> 'service', '(vacio)');
  end if;

  select s.duration_minutes, s.price into v_duration, v_price
  from public.services s where s.id = v_service_id;

  v_starts_at := (payload ->> 'starts_at')::timestamptz;
  if v_starts_at is null then
    raise exception 'starts_at es obligatorio';
  end if;
  v_ends_at := coalesce(
    (nullif(payload ->> 'ends_at', ''))::timestamptz,
    v_starts_at + make_interval(mins => v_duration)
  );

  v_price := coalesce((nullif(payload ->> 'price', ''))::numeric, v_price);

  -- ---------------------------------------------------------------- cliente
  v_phone_raw := btrim(coalesce(v_client ->> 'phone_e164', v_client ->> 'phone', ''));

  if v_phone_raw = '' then
    -- Sin telefono no hay forma de saber a quien pertenece el corte.
    if v_source <> 'walk_in_bot' then
      raise exception 'Se requiere el telefono del cliente para registrar la cita';
    end if;
    v_client_id := null;
  else
    v_phone := public.normalize_phone_e164(v_phone_raw);
    select c.id into v_client_id from public.clients c where c.phone_e164 = v_phone;

    if v_client_id is null then
      if char_length(btrim(coalesce(v_client ->> 'full_name', ''))) < 2 then
        raise exception 'Para crear un cliente nuevo se requiere client.full_name';
      end if;

      -- Quien escribe por WhatsApp inicia el contacto; el walk-in no, asi que
      -- ahi el consentimiento se deja en manos del panel.
      v_opt_in := coalesce((payload ->> 'whatsapp_opt_in')::boolean, v_source = 'bot_booking');

      insert into public.clients (
        full_name, phone_e164, email, document_id, birth_date, address,
        whatsapp_opt_in, whatsapp_opt_in_at, welcome_status, source, source_id
      ) values (
        btrim(v_client ->> 'full_name'),
        v_phone,
        nullif(v_client ->> 'email', ''),
        nullif(v_client ->> 'document_id', ''),
        (nullif(v_client ->> 'birth_date', ''))::date,
        nullif(v_client ->> 'address', ''),
        v_opt_in,
        case when v_opt_in then now() end,
        case when v_opt_in then 'pending'::public.welcome_status else 'not_requested'::public.welcome_status end,
        v_source,
        v_source_id
      )
      returning id into v_client_id;

      v_client_created := true;
      v_welcome_queued := v_opt_in;
    else
      -- Cliente conocido: se completan huecos, nunca se pisa lo que ya hay.
      update public.clients c set
        full_name    = coalesce(nullif(btrim(coalesce(v_client ->> 'full_name', '')), ''), c.full_name),
        email        = coalesce(c.email, nullif(v_client ->> 'email', '')),
        document_id  = coalesce(c.document_id, nullif(v_client ->> 'document_id', '')),
        birth_date   = coalesce(c.birth_date, (nullif(v_client ->> 'birth_date', ''))::date),
        address      = coalesce(c.address, nullif(v_client ->> 'address', '')),
        updated_at   = now()
      where c.id = v_client_id;
    end if;
  end if;

  -- ------------------------------------------------------------ reagendado
  if v_action = 'reschedule' and v_previous_cal_id is not null then
    update public.appointments
       set status = 'cancelled', updated_at = now()
     where calendar_event_id = v_previous_cal_id
     returning id into v_previous_id;
  end if;

  -- ---------------------------------------------------------------- la cita
  insert into public.appointments as a (
    client_id, barber_id, service_id, starts_at, ends_at,
    status, quoted_price, calendar_event_id, source, source_id, notes
  ) values (
    v_client_id, v_barber_id, v_service_id, v_starts_at, v_ends_at,
    'confirmed', v_price, v_calendar_id, v_source, v_source_id,
    nullif(payload ->> 'notes', '')
  )
  on conflict (calendar_event_id) where calendar_event_id is not null
  do update set
    client_id    = coalesce(excluded.client_id, a.client_id),
    barber_id    = excluded.barber_id,
    service_id   = excluded.service_id,
    starts_at    = excluded.starts_at,
    ends_at      = excluded.ends_at,
    quoted_price = excluded.quoted_price,
    -- Un reintento de n8n no debe reabrir una cita que recepcion ya cerro.
    status       = case when a.status = 'completed' then a.status else 'confirmed' end,
    notes        = coalesce(excluded.notes, a.notes),
    updated_at   = now()
  returning a.id, (a.xmax = 0) into v_appointment_id, v_created;

  return jsonb_build_object(
    'ok', true,
    'action', v_action,
    'client_id', v_client_id,
    'client_created', v_client_created,
    'client_identificado', v_client_id is not null,
    'welcome_queued', v_welcome_queued,
    'appointment_id', v_appointment_id,
    'appointment_created', v_created,
    'previous_appointment_id', v_previous_id,
    'barber_id', v_barber_id,
    'service_id', v_service_id,
    'price', v_price,
    'starts_at', v_starts_at,
    'ends_at', v_ends_at
  );
end;
$$;

revoke all on function public.register_bot_appointment(jsonb) from public, anon;
grant execute on function public.register_bot_appointment(jsonb) to service_role, authenticated;

-- ------------------------------------------------- cierre desde recepcion

-- Una cita no puede tener dos cobros activos.
create unique index if not exists service_transactions_appointment_active_key
  on public.service_transactions (appointment_id)
  where appointment_id is not null and status = 'active';

-- Cola de recepcion: citas atendidas que todavia no se han cerrado.
create or replace view public.walkins_pendientes
with (security_invoker = true) as
select
  a.id                     as appointment_id,
  a.starts_at,
  a.ends_at,
  a.barber_name_snapshot   as barbero,
  a.service_name_snapshot  as servicio,
  a.quoted_price           as precio_sugerido,
  a.client_id,
  c.full_name              as cliente,
  c.phone_e164             as telefono,
  a.source,
  a.notes,
  a.created_at
from public.appointments a
left join public.clients c on c.id = a.client_id
where a.status = 'confirmed'
  and not exists (
    select 1 from public.service_transactions t
    where t.appointment_id = a.id and t.status = 'active'
  )
order by a.starts_at desc;

comment on view public.walkins_pendientes is
  'Citas ya confirmadas que aun no tienen cobro registrado. Es la bandeja de recepcion.';

-- Cierra una cita: identifica al cliente, marca la cita como completada y
-- registra el cobro. Es el momento en que un walk-in anonimo se convierte en un
-- cliente con historial.
create or replace function public.complete_appointment(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment    public.appointments%rowtype;
  v_client         jsonb := coalesce(payload -> 'client', '{}'::jsonb);
  v_phone_raw      text;
  v_phone          text;
  v_client_id      uuid;
  v_client_created boolean := false;
  v_welcome        boolean := false;
  v_amount         numeric(12, 2);
  v_method         public.payment_method;
  v_tx_id          uuid;
  v_tx_created     boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_app_admin() then
    raise exception 'No tiene permisos para cerrar citas';
  end if;

  select * into v_appointment from public.appointments
   where id = (payload ->> 'appointment_id')::uuid;
  if v_appointment.id is null then
    raise exception 'La cita no existe';
  end if;
  if v_appointment.status = 'cancelled' then
    raise exception 'La cita esta cancelada, no se puede cobrar';
  end if;

  -- 1. Cliente: el que ya tenia, o el que trae recepcion.
  v_client_id := v_appointment.client_id;
  v_phone_raw := btrim(coalesce(v_client ->> 'phone_e164', v_client ->> 'phone', ''));

  if v_client_id is null then
    if v_phone_raw = '' then
      raise exception 'Para cerrar la cita se requiere el telefono del cliente';
    end if;
    if char_length(btrim(coalesce(v_client ->> 'full_name', ''))) < 2 then
      raise exception 'Se requiere el nombre del cliente';
    end if;

    v_phone := public.normalize_phone_e164(v_phone_raw);
    select c.id into v_client_id from public.clients c where c.phone_e164 = v_phone;

    if v_client_id is null then
      v_welcome := coalesce((payload ->> 'whatsapp_opt_in')::boolean, false);
      insert into public.clients (
        full_name, phone_e164, email, document_id, birth_date, address,
        whatsapp_opt_in, whatsapp_opt_in_at, welcome_status, source, source_id
      ) values (
        btrim(v_client ->> 'full_name'), v_phone,
        nullif(v_client ->> 'email', ''), nullif(v_client ->> 'document_id', ''),
        (nullif(v_client ->> 'birth_date', ''))::date, nullif(v_client ->> 'address', ''),
        v_welcome, case when v_welcome then now() end,
        case when v_welcome then 'pending'::public.welcome_status else 'not_requested'::public.welcome_status end,
        v_appointment.source, v_appointment.source_id
      ) returning id into v_client_id;
      v_client_created := true;
    end if;

    update public.appointments set client_id = v_client_id, updated_at = now()
     where id = v_appointment.id;
  end if;

  -- 2. Cobro. Si no se informa importe se usa el que se cotizo.
  v_amount := coalesce((nullif(payload ->> 'amount', ''))::numeric, v_appointment.quoted_price);
  if v_amount is null or v_amount <= 0 then
    raise exception 'El valor del cobro debe ser mayor que cero';
  end if;
  v_method := coalesce(nullif(payload ->> 'payment_method', ''), 'cash')::public.payment_method;

  insert into public.service_transactions (
    client_id, barber_id, service_id, appointment_id,
    amount, payment_method, occurred_at, source, source_id, notes
  ) values (
    v_client_id, v_appointment.barber_id, v_appointment.service_id, v_appointment.id,
    v_amount, v_method,
    coalesce((nullif(payload ->> 'occurred_at', ''))::timestamptz, v_appointment.starts_at),
    v_appointment.source, v_appointment.source_id,
    nullif(payload ->> 'notes', '')
  )
  on conflict (appointment_id) where appointment_id is not null and status = 'active'
  do nothing
  returning id into v_tx_id;

  if v_tx_id is null then
    select id into v_tx_id from public.service_transactions
     where appointment_id = v_appointment.id and status = 'active';
  else
    v_tx_created := true;
  end if;

  update public.appointments set status = 'completed', updated_at = now()
   where id = v_appointment.id;

  return jsonb_build_object(
    'ok', true,
    'appointment_id', v_appointment.id,
    'client_id', v_client_id,
    'client_created', v_client_created,
    'welcome_queued', v_welcome and v_client_created,
    'transaction_id', v_tx_id,
    'transaction_created', v_tx_created,
    'amount', v_amount,
    'payment_method', v_method
  );
end;
$$;

comment on function public.complete_appointment(jsonb) is
  'Cierre de recepcion: identifica al cliente, marca la cita como completada y registra el cobro. Idempotente por cita.';

revoke all on function public.complete_appointment(jsonb) from public, anon;
grant execute on function public.complete_appointment(jsonb) to service_role, authenticated;
