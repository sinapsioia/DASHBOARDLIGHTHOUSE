-- Prueba de humo de register_bot_appointment.
--
-- Ejecutar en el SQL Editor DESPUES de aplicar 202608080001_bot_ingestion.sql.
-- Crea un cliente y una cita de prueba, comprueba el comportamiento y borra
-- todo al final: la base queda exactamente como estaba.
--
-- Si algo falla, lanza excepcion y la transaccion se deshace.

do $$
declare
  r1 jsonb; r2 jsonb; r3 jsonb; r4 jsonb;
  v_cliente uuid;
  v_cita uuid;
  n integer;
  TEL constant text := '+573000000199';   -- numero inventado, no existe
  EV1 constant text := 'prueba-ingesta-evento-1';
  EV2 constant text := 'prueba-ingesta-evento-2';
begin
  -- Punto de partida limpio
  delete from public.appointments where calendar_event_id in (EV1, EV2);
  delete from public.message_outbox where aggregate_id in (select id from public.clients where phone_e164 = TEL);
  delete from public.clients where phone_e164 = TEL;

  -- 1. Reserva nueva, cliente nuevo, barbero por ALIAS y servicio por ALIAS
  r1 := public.register_bot_appointment(jsonb_build_object(
    'action', 'book',
    'source', 'bot_booking',
    'source_id', 'conversacion-prueba-1',
    'client', jsonb_build_object('full_name', 'Cliente Prueba Ingesta', 'phone', '3000000199'),
    'barber', 'Jeison',              -- alias historico de Jeisson
    'service', 'corte y barba',      -- alias del Combo Faro Trinidad
    'starts_at', (now() + interval '2 days')::text,
    'calendar_event_id', EV1
  ));
  raise notice '1. reserva -> %', r1;

  if not (r1 ->> 'ok')::boolean then raise exception 'La reserva no devolvio ok'; end if;
  if not (r1 ->> 'client_created')::boolean then raise exception 'Deberia haber creado el cliente'; end if;
  if not (r1 ->> 'appointment_created')::boolean then raise exception 'Deberia haber creado la cita'; end if;

  v_cliente := (r1 ->> 'client_id')::uuid;
  v_cita := (r1 ->> 'appointment_id')::uuid;

  -- El alias tiene que haber resuelto al barbero y al servicio correctos
  select count(*) into n from public.appointments a
    join public.barbers b on b.id = a.barber_id
    join public.services s on s.id = a.service_id
   where a.id = v_cita and b.name = 'Jeisson' and s.code = 'combo_trinidad';
  if n <> 1 then raise exception 'Los alias no resolvieron a Jeisson / combo_trinidad'; end if;

  -- El precio debe salir del catalogo, no del payload
  select count(*) into n from public.appointments a join public.services s on s.id = a.service_id
   where a.id = v_cita and a.quoted_price = s.price;
  if n <> 1 then raise exception 'El precio no coincide con el del catalogo'; end if;

  -- Los snapshots de nombre los rellena el trigger
  select count(*) into n from public.appointments
   where id = v_cita and barber_name_snapshot = 'Jeisson' and service_name_snapshot <> '';
  if n <> 1 then raise exception 'No se rellenaron los snapshots'; end if;

  -- La bienvenida debe quedar encolada para un cliente de WhatsApp
  select count(*) into n from public.message_outbox
   where aggregate_id = v_cliente and event_type = 'client.welcome.requested';
  if n <> 1 then raise exception 'No se encolo la bienvenida'; end if;

  -- 2. Idempotencia: el mismo calendar_event_id NO debe duplicar
  r2 := public.register_bot_appointment(jsonb_build_object(
    'source', 'bot_booking',
    'client', jsonb_build_object('full_name', 'Cliente Prueba Ingesta', 'phone', '3000000199'),
    'barber', 'Jeisson', 'service', 'combo_trinidad',
    'starts_at', (now() + interval '2 days')::text,
    'calendar_event_id', EV1
  ));
  raise notice '2. reintento -> %', r2;
  if (r2 ->> 'appointment_created')::boolean then raise exception 'Un reintento creo una cita duplicada'; end if;
  if (r2 ->> 'client_created')::boolean then raise exception 'Un reintento creo el cliente de nuevo'; end if;
  select count(*) into n from public.appointments where calendar_event_id = EV1;
  if n <> 1 then raise exception 'Hay % citas con el mismo evento', n; end if;

  -- 3. Reagendado: la anterior se cancela y nace una nueva enlazada
  r3 := public.register_bot_appointment(jsonb_build_object(
    'action', 'reschedule',
    'source', 'bot_booking',
    'client', jsonb_build_object('full_name', 'Cliente Prueba Ingesta', 'phone', '3000000199'),
    'barber', 'Camilo', 'service', 'corte',
    'starts_at', (now() + interval '3 days')::text,
    'calendar_event_id', EV2,
    'previous_calendar_event_id', EV1
  ));
  raise notice '3. reagendado -> %', r3;
  select count(*) into n from public.appointments where calendar_event_id = EV1 and status = 'cancelled';
  if n <> 1 then raise exception 'La cita anterior no quedo cancelada'; end if;
  select count(*) into n from public.appointments where calendar_event_id = EV2 and status = 'confirmed';
  if n <> 1 then raise exception 'La cita nueva no quedo confirmada'; end if;

  -- 4. Cancelacion
  r4 := public.register_bot_appointment(jsonb_build_object(
    'action', 'cancel', 'calendar_event_id', EV2
  ));
  raise notice '4. cancelacion -> %', r4;
  select count(*) into n from public.appointments where calendar_event_id = EV2 and status = 'cancelled';
  if n <> 1 then raise exception 'La cancelacion no se aplico'; end if;

  -- 5. Un barbero inexistente debe fallar en voz alta
  begin
    perform public.register_bot_appointment(jsonb_build_object(
      'client', jsonb_build_object('full_name', 'X Y', 'phone', '3000000199'),
      'barber', 'Barbero Que No Existe', 'service', 'corte',
      'starts_at', (now() + interval '1 day')::text
    ));
    raise exception 'Un barbero inexistente deberia haber fallado';
  exception when others then
    if sqlerrm like '%Barbero no reconocido%' then raise notice '5. barbero invalido rechazado correctamente';
    else raise; end if;
  end;

  -- Limpieza
  delete from public.appointments where calendar_event_id in (EV1, EV2);
  delete from public.message_outbox where aggregate_id = v_cliente;
  delete from public.clients where id = v_cliente;

  raise notice '--- TODAS LAS COMPROBACIONES PASARON, base limpia ---';
end;
$$;
