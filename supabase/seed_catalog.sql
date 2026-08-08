-- Completa el catalogo que ya siembra la migracion con los datos de integracion.
--
-- La migracion 202607230001 crea los cuatro barberos y los once servicios, pero
-- sin Calendar ID, sin Telegram chat ID y sin alias en los servicios. Esos son
-- justamente los campos que necesitan los flujos de n8n para leer el catalogo
-- desde get_integration_catalog() en vez de tenerlo incrustado en el codigo.
--
-- Valores tomados de los flujos live al 8 de agosto de 2026:
--   - Calendar IDs: nodo "Code - Combinar y Preparar" del bot de walk-ins.
--   - Telegram chat IDs: nodos "Telegram Notificar Barbero Cita - *" del bot de WhatsApp.
--
-- IMPORTANTE: se usa UPDATE y no INSERT ... ON CONFLICT. El trigger
-- prepare_barber() valida colisiones de nombre y alias, y en un ON CONFLICT
-- PostgreSQL dispara el BEFORE INSERT antes de resolver el conflicto, con un id
-- recien generado; el barbero existente deja de excluirse por
-- "existing.id is distinct from new.id" y la fila colisiona consigo misma.
--
-- Es idempotente: puede ejecutarse las veces que haga falta.

-- ---------------------------------------------------------------- barberos --
update public.barbers set
  calendar_external_id = '2715f9380daa9059f2be61c87e4d23623241ac0ee3a70933b41f9ad3adb1f6e3@group.calendar.google.com',
  telegram_chat_id = '8230808583'
where lower(name) = 'jeisson';

update public.barbers set
  calendar_external_id = '1f15605614c800f6ddcdf1c0f2b7bb0a3b5fae08122ecbd2bfcc1a199dcc29bf@group.calendar.google.com',
  telegram_chat_id = '5546897675'
where lower(name) = 'camilo';

update public.barbers set
  calendar_external_id = '7a2cc5355ec9f62d8c8081686122ac526b06086f5bf10d76ea432384e83926f0@group.calendar.google.com',
  telegram_chat_id = '1712522952'
where lower(name) = 'luis';

-- Alejandro dejo de ser el nombre operativo. Los alias historicos se conservan
-- para que las conversaciones antiguas sigan resolviendo hacia Daniel.
update public.barbers set
  calendar_external_id = 'af3a07f2c0d880278ced15629ca63e09544efd5ba53d083ba31200ef4f5ef9b6@group.calendar.google.com',
  telegram_chat_id = '6191987603',
  aliases = array['Alejandro', 'Alejo']
where lower(name) = 'daniel';

-- --------------------------------------------------------------- servicios --
update public.services set aliases = array['corte', 'corte de cabello']  where code = 'corte_alejandria';
update public.services set aliases = array['corte y cejas']              where code = 'corte_alejandria_cejas';
update public.services set aliases = array['barba', 'barba sencilla']    where code = 'barba_ribadeo';
update public.services set aliases = array['barba premium']              where code = 'barba_singapur';
update public.services set aliases = array['perfilado de cejas']         where code = 'cejas';
update public.services set aliases = array['mascarilla']                 where code = 'mascarilla_malasia';
update public.services set aliases = array['corte y barba']              where code = 'combo_trinidad';

-- ------------------------------------------------------------ verificacion --
-- Falla en voz alta si algun barbero quedo sin datos de integracion.
do $$
declare
  faltantes text;
begin
  select string_agg(name, ', ' order by name) into faltantes
  from public.barbers
  where active = true
    and (calendar_external_id is null or telegram_chat_id is null);

  if faltantes is not null then
    raise exception 'Barberos activos sin datos de integracion: %', faltantes;
  end if;
end;
$$;

select name, sort_order, telegram_chat_id,
       left(calendar_external_id, 12) || '…' as calendar_id,
       aliases
from public.barbers
where active = true
order by sort_order, name;
