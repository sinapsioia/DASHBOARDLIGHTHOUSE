-- El source_id de una cita debe ser unico.
--
-- La migracion inicial creo un indice unico sobre (source, source_id) en
-- appointments, clients y service_transactions. Los flujos de n8n enviaban como
-- source_id el identificador de la CONVERSACION ("chatwoot:3") o del CHAT de
-- Telegram ("telegram:5546897675"), que se repite en cada cita: la primera
-- entraba y la segunda fallaba con
-- "duplicate key value violates unique constraint appointments_source_id_idx".
--
-- Aparecio al reagendar por WhatsApp. En el bot de walk-ins todavia no habia
-- saltado solo porque las dos citas registradas venian de chats distintos;
-- habria fallado en el segundo walk-in del mismo operador.
--
-- Se corrige en la RPC y no en los flujos, para que cualquier futuro llamador
-- quede protegido sin tener que conocer esta regla:
--   - la cita combina el id de conversacion con el evento de Calendar, que si
--     es unico;
--   - el cliente deja de llevar source_id, porque su identidad es el telefono y
--     dos clientes del mismo chat chocarian entre si.

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
  v_appt_source_id   text;
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

  -- (source, source_id) tiene indice unico. El id de conversacion o de chat se
  -- repite en cada cita, asi que por si solo choca a la segunda. Se combina con
  -- el evento de Calendar, que si es unico por cita.
  v_appt_source_id := case
    when v_calendar_id is null then v_source_id
    when v_source_id is null then v_calendar_id
    else v_source_id || ':' || v_calendar_id
  end;

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
        whatsapp_opt_in, whatsapp_opt_in_at, welcome_status, source
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
        v_source
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
    'confirmed', v_price, v_calendar_id, v_source, v_appt_source_id,
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
