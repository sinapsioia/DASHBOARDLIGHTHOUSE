-- Ingesta de los bots hacia Supabase.
--
-- Hasta ahora los flujos de n8n solo podian LEER (get_integration_catalog).
-- register_service_transaction exige is_app_admin(), que se resuelve por
-- auth.uid(), y n8n se autentica con service_role: no habia forma de que un bot
-- escribiera. Por eso las citas vivian unicamente en Google Calendar y Sheets.
--
-- Esta migracion abre esa puerta con una sola RPC, register_bot_appointment,
-- que resuelve barbero y servicio por nombre o alias, crea el cliente si no
-- existe y registra la cita. Es idempotente por calendar_event_id, de modo que
-- un reintento de n8n no duplica nada.

-- ---------------------------------------------------------------- utilidades

create or replace function public.norm_text(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(lower(translate(
    coalesce(input, ''),
    'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
    'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
  )));
$$;

comment on function public.norm_text(text) is
  'Normaliza texto para comparar nombres y alias sin depender de tildes ni mayusculas.';

create or replace function public.resolve_barber_id(input text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select b.id
  from public.barbers b
  where b.active = true
    and (
      public.norm_text(b.name) = public.norm_text(input)
      or exists (
        select 1 from unnest(b.aliases) alias
        where public.norm_text(alias) = public.norm_text(input)
      )
    )
  order by b.sort_order, b.name
  limit 1;
$$;

create or replace function public.resolve_service_id(input text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select s.id
  from public.services s
  where s.active = true
    and (
      public.norm_text(s.code) = public.norm_text(input)
      or public.norm_text(s.name) = public.norm_text(input)
      or exists (
        select 1 from unnest(s.aliases) alias
        where public.norm_text(alias) = public.norm_text(input)
      )
    )
  order by s.sort_order, s.name
  limit 1;
$$;

-- Ancla de idempotencia: un evento de Calendar identifica una cita de forma unica.
create unique index if not exists appointments_calendar_event_id_key
  on public.appointments (calendar_event_id)
  where calendar_event_id is not null;

-- ------------------------------------------------------------------- la RPC

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
  -- Solo el backend (n8n con service_role) o un administrador del panel.
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

  -- El precio del catalogo manda, salvo que el bot informe uno distinto
  -- (por ejemplo un walk-in con precio pactado).
  v_price := coalesce((nullif(payload ->> 'price', ''))::numeric, v_price);

  -- ---------------------------------------------------------------- cliente
  v_phone := public.normalize_phone_e164(coalesce(v_client ->> 'phone_e164', v_client ->> 'phone'));
  select c.id into v_client_id from public.clients c where c.phone_e164 = v_phone;

  if v_client_id is null then
    -- clients.full_name es obligatorio y exige al menos dos caracteres.
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
      nullif(btrim(coalesce(v_client ->> 'full_name', '')), ''),
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
    -- Cliente conocido: se completan solo los huecos, nunca se pisa lo que ya hay.
    update public.clients c set
      full_name    = coalesce(nullif(btrim(coalesce(v_client ->> 'full_name', '')), ''), c.full_name),
      email        = coalesce(c.email, nullif(v_client ->> 'email', '')),
      document_id  = coalesce(c.document_id, nullif(v_client ->> 'document_id', '')),
      birth_date   = coalesce(c.birth_date, (nullif(v_client ->> 'birth_date', ''))::date),
      address      = coalesce(c.address, nullif(v_client ->> 'address', '')),
      updated_at   = now()
    where c.id = v_client_id;
  end if;

  -- ------------------------------------------------------------ reagendado
  if v_action = 'reschedule' and v_previous_cal_id is not null then
    update public.appointments
       set status = 'cancelled', updated_at = now()
     where calendar_event_id = v_previous_cal_id
     returning id into v_previous_id;
  end if;

  -- ---------------------------------------------------------------- la cita
  -- Idempotente por calendar_event_id: si n8n reintenta, actualiza en vez de duplicar.
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
    client_id    = excluded.client_id,
    barber_id    = excluded.barber_id,
    service_id   = excluded.service_id,
    starts_at    = excluded.starts_at,
    ends_at      = excluded.ends_at,
    quoted_price = excluded.quoted_price,
    status       = 'confirmed',
    notes        = coalesce(excluded.notes, a.notes),
    updated_at   = now()
  returning a.id, (a.xmax = 0) into v_appointment_id, v_created;

  return jsonb_build_object(
    'ok', true,
    'action', v_action,
    'client_id', v_client_id,
    'client_created', v_client_created,
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

comment on function public.register_bot_appointment(jsonb) is
  'Punto de entrada de los bots de n8n. Resuelve barbero y servicio por nombre o alias, crea el cliente si hace falta y registra la cita. Idempotente por calendar_event_id.';

revoke all on function public.register_bot_appointment(jsonb) from public, anon;
grant execute on function public.register_bot_appointment(jsonb) to service_role, authenticated;
