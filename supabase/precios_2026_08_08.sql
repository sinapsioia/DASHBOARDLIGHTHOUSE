-- Subida general de 5.000 COP en la lista de precios, 8 de agosto de 2026.
--
-- Solo cambia el CATALOGO, es decir el precio que se cobrara de aqui en
-- adelante. NO toca `service_transactions`: los cortes ya registrados conservan
-- el importe que realmente se cobro, que es lo que debe seguir viendose en los
-- informes historicos.
--
-- Se escribe servicio por servicio y no como "price + 5000" a proposito: asi es
-- explicito cuanto queda cada uno y reejecutarlo no vuelve a sumar.

update public.services set price = 50000,  updated_at = now() where code = 'corte_alejandria';
update public.services set price = 35000,  updated_at = now() where code = 'barba_ribadeo';
update public.services set price = 40000,  updated_at = now() where code = 'barba_singapur';
update public.services set price = 45000,  updated_at = now() where code = 'mascarilla_malasia';
update public.services set price = 15000,  updated_at = now() where code = 'cejas';
update public.services set price = 60000,  updated_at = now() where code = 'corte_alejandria_cejas';
update public.services set price = 70000,  updated_at = now() where code = 'combo_portobello';
update public.services set price = 60000,  updated_at = now() where code = 'combo_trinidad';
update public.services set price = 95000,  updated_at = now() where code = 'combo_point_sur';
update public.services set price = 115000, updated_at = now() where code = 'combo_new_island';
update public.services set price = 125000, updated_at = now() where code = 'combo_ponta_verde';

-- Falla en voz alta si algun servicio quedo con un precio distinto al previsto.
do $$
declare
  malos text;
begin
  select string_agg(code || '=' || price::text, ', ' order by code) into malos
  from public.services
  where (code, price) not in (
    ('corte_alejandria', 50000), ('barba_ribadeo', 35000), ('barba_singapur', 40000),
    ('mascarilla_malasia', 45000), ('cejas', 15000), ('corte_alejandria_cejas', 60000),
    ('combo_portobello', 70000), ('combo_trinidad', 60000), ('combo_point_sur', 95000),
    ('combo_new_island', 115000), ('combo_ponta_verde', 125000)
  );

  if malos is not null then
    raise exception 'Servicios con precio inesperado: %', malos;
  end if;
end;
$$;

select code, name, price, duration_minutes
from public.services
where active
order by sort_order;
