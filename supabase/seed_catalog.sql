-- Catalogo inicial de barberos y servicios de The Lighthouse Barber Studio.
--
-- Los valores provienen de los flujos live de n8n al 8 de agosto de 2026:
--   - Calendar IDs: nodo "Code - Combinar y Preparar" del bot de walk-ins.
--   - Telegram chat IDs: nodos "Telegram Notificar Barbero Cita - *" del bot de WhatsApp.
--   - Servicios, duraciones y precios: politica de agenda y prompt del agente.
--
-- Los alias replican los normalizadores que hoy viven incrustados en el codigo,
-- para que los flujos puedan leerlos desde aqui en vez de tenerlos hardcodeados.
--
-- Es idempotente: puede ejecutarse varias veces sin duplicar ni perder cambios
-- hechos despues desde la pantalla de Configuracion (solo reescribe los campos
-- de integracion).

insert into public.barbers (name, aliases, calendar_external_id, telegram_chat_id, sort_order, color, active)
values
  ('Jeisson',
   array['jeison', 'jeyson', 'jaison', 'jason', 'jey', 'jei', 'jai', 'jay', 'yei'],
   '2715f9380daa9059f2be61c87e4d23623241ac0ee3a70933b41f9ad3adb1f6e3@group.calendar.google.com',
   '8230808583', 1, '#C9A84C', true),
  ('Camilo',
   array['juan', 'juan camilo'],
   '1f15605614c800f6ddcdf1c0f2b7bb0a3b5fae08122ecbd2bfcc1a199dcc29bf@group.calendar.google.com',
   '5546897675', 2, '#4C8BC9', true),
  ('Luis',
   array['lucho'],
   '7a2cc5355ec9f62d8c8081686122ac526b06086f5bf10d76ea432384e83926f0@group.calendar.google.com',
   '1712522952', 3, '#5FA86B', true),
  -- Alejandro dejo de ser el nombre operativo; los alias historicos se conservan
  -- para que las conversaciones antiguas sigan resolviendo hacia Daniel.
  ('Daniel',
   array['alejandro', 'alejo'],
   'af3a07f2c0d880278ced15629ca63e09544efd5ba53d083ba31200ef4f5ef9b6@group.calendar.google.com',
   '6191987603', 4, '#B5603F', true)
on conflict (name) do update set
  aliases = excluded.aliases,
  calendar_external_id = excluded.calendar_external_id,
  telegram_chat_id = excluded.telegram_chat_id,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

insert into public.services (code, name, aliases, category, price, duration_minutes, sort_order, active)
values
  ('corte_alejandria',       'Corte Faro de Alejandría',           array['corte', 'corte de cabello'], 'corte',       45000,  45,  1, true),
  ('corte_alejandria_cejas', 'Corte Faro de Alejandría + Cejas',   array['corte y cejas'],             'corte',       55000,  60,  2, true),
  ('barba_ribadeo',          'Barba Faro Ribadeo',                 array['barba', 'barba sencilla'],   'barba',       30000,  30,  3, true),
  ('barba_singapur',         'Barba Faro Singapur',                array['barba premium'],             'barba',       35000,  40,  4, true),
  ('cejas',                  'Cejas',                              array['perfilado de cejas'],        'cejas',       10000,  15,  5, true),
  ('mascarilla_malasia',     'Mascarilla Hidratante Faro Malasia', array['mascarilla'],                'tratamiento', 40000,  30,  6, true),
  ('combo_trinidad',         'Combo Faro Trinidad',                array['corte y barba'],             'combo',       55000,  75,  7, true),
  ('combo_portobello',       'Combo Faro Portobello',              array[]::text[],                    'combo',       65000,  90,  8, true),
  ('combo_point_sur',        'Combo Faro Point Sur',               array[]::text[],                    'combo',       90000, 120,  9, true),
  ('combo_new_island',       'Combo Faro New Island',              array[]::text[],                    'combo',      110000, 120, 10, true),
  ('combo_ponta_verde',      'Combo Faro Ponta Verde',             array[]::text[],                    'combo',      120000, 150, 11, true)
on conflict (code) do update set
  name = excluded.name,
  aliases = excluded.aliases,
  category = excluded.category,
  price = excluded.price,
  duration_minutes = excluded.duration_minutes,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

-- Comprobacion rapida de lo que quedo cargado.
select 'barberos' as tabla, count(*) as filas from public.barbers where active
union all
select 'servicios', count(*) from public.services where active;
