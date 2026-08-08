create extension if not exists pgcrypto;

create type public.app_role as enum ('owner', 'admin', 'viewer');
create type public.record_source as enum ('manual', 'bot_booking', 'walk_in_bot', 'import', 'system');
create type public.appointment_status as enum ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
create type public.transaction_status as enum ('active', 'voided');
create type public.payment_method as enum ('cash', 'nequi', 'daviplata', 'card', 'transfer', 'other');
create type public.outbox_status as enum ('pending', 'processing', 'sent', 'failed', 'cancelled');
create type public.welcome_status as enum ('not_requested', 'pending', 'sent', 'failed', 'skipped');

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'viewer',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  aliases text[] not null default '{}',
  active boolean not null default true,
  sort_order smallint not null default 0,
  calendar_external_id text,
  telegram_chat_id text,
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  color text not null default '#C9A84C' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  aliases text[] not null default '{}',
  category text not null,
  price numeric(12, 2) not null check (price >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) >= 2),
  phone_e164 text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text,
  document_id text,
  birth_date date,
  address text,
  whatsapp_opt_in boolean not null default false,
  whatsapp_opt_in_at timestamptz,
  welcome_status public.welcome_status not null default 'not_requested',
  welcome_sent_at timestamptz,
  source public.record_source not null default 'manual',
  source_id text,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  barber_id uuid not null references public.barbers (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  barber_name_snapshot text not null default '',
  service_name_snapshot text not null default '',
  service_category_snapshot text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  status public.appointment_status not null default 'confirmed',
  quoted_price numeric(12, 2) check (quoted_price >= 0),
  calendar_event_id text,
  source public.record_source not null,
  source_id text,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_transactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  barber_id uuid not null references public.barbers (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  appointment_id uuid references public.appointments (id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method public.payment_method not null default 'cash',
  occurred_at timestamptz not null default now(),
  status public.transaction_status not null default 'active',
  source public.record_source not null default 'manual',
  source_id text,
  idempotency_key uuid not null default gen_random_uuid() unique,
  notes text,
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  void_reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'active' and voided_at is null and voided_by is null)
    or (status = 'voided' and voided_at is not null and voided_by is not null and char_length(trim(void_reason)) >= 3)
  )
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  occurred_on date not null default current_date,
  source public.record_source not null default 'manual',
  source_id text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.message_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  dedup_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  status public.outbox_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index clients_phone_e164_idx on public.clients (phone_e164);
create index clients_full_name_idx on public.clients using gin (to_tsvector('simple', full_name));
create index appointments_starts_at_idx on public.appointments (starts_at desc);
create index appointments_client_id_idx on public.appointments (client_id, starts_at desc);
create index service_transactions_occurred_at_idx on public.service_transactions (occurred_at desc);
create index service_transactions_client_id_idx on public.service_transactions (client_id, occurred_at desc);
create index service_transactions_barber_id_idx on public.service_transactions (barber_id, occurred_at desc);
create unique index clients_source_id_idx on public.clients (source, source_id) where source_id is not null;
create unique index appointments_source_id_idx on public.appointments (source, source_id) where source_id is not null;
create unique index service_transactions_source_id_idx on public.service_transactions (source, source_id) where source_id is not null;
create unique index expenses_source_id_idx on public.expenses (source, source_id) where source_id is not null;
create unique index barbers_calendar_external_id_idx on public.barbers (calendar_external_id)
  where calendar_external_id is not null;
create unique index barbers_telegram_chat_id_idx on public.barbers (telegram_chat_id)
  where telegram_chat_id is not null;
create index message_outbox_pending_idx on public.message_outbox (status, next_attempt_at)
  where status in ('pending', 'failed');

create or replace function public.normalize_phone_e164(input text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  digits text;
begin
  digits := regexp_replace(coalesce(input, ''), '[^0-9]', '', 'g');
  if digits like '00%' then
    digits := substring(digits from 3);
  end if;
  if length(digits) = 10 then
    digits := '57' || digits;
  end if;
  if length(digits) < 8 or length(digits) > 15 or digits like '0%' then
    raise exception 'El teléfono no es válido';
  end if;
  return '+' || digits;
end;
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.user_id = auth.uid() and p.active = true
$$;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() in ('owner', 'admin'), false)
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace function public.prepare_client()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.full_name := trim(new.full_name);
  new.phone_e164 := public.normalize_phone_e164(new.phone_e164);
  new.email := nullif(lower(trim(coalesce(new.email, ''))), '');
  new.document_id := nullif(trim(coalesce(new.document_id, '')), '');
  if new.whatsapp_opt_in and new.whatsapp_opt_in_at is null then
    new.whatsapp_opt_in_at := now();
  end if;
  if new.whatsapp_opt_in and new.source in ('manual', 'walk_in_bot') and new.welcome_status = 'not_requested' then
    new.welcome_status := 'pending';
  elsif not new.whatsapp_opt_in and new.welcome_status = 'pending' then
    new.welcome_status := 'skipped';
  end if;
  return new;
end;
$$;

create or replace function public.prepare_barber()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := trim(new.name);
  select coalesce(array_agg(cleaned.alias order by cleaned.alias), '{}'::text[])
  into new.aliases
  from (
    select min(trim(value)) as alias
    from unnest(coalesce(new.aliases, '{}'::text[])) as value
    where trim(value) <> '' and lower(trim(value)) <> lower(new.name)
    group by lower(trim(value))
  ) cleaned;

  if new.active and exists (
    select 1
    from public.barbers existing
    where existing.active = true
      and existing.id is distinct from new.id
      and (
        lower(existing.name) = lower(new.name)
        or exists (
          select 1 from unnest(new.aliases) alias
          where lower(alias) = lower(existing.name)
        )
        or exists (
          select 1 from unnest(existing.aliases) alias
          where lower(alias) = lower(new.name)
        )
        or exists (
          select 1
          from unnest(new.aliases) new_alias
          cross join unnest(existing.aliases) existing_alias
          where lower(new_alias) = lower(existing_alias)
        )
      )
  ) then
    raise exception 'El nombre o uno de los alias ya pertenece a otro barbero activo';
  end if;

  new.calendar_external_id := nullif(trim(coalesce(new.calendar_external_id, '')), '');
  new.telegram_chat_id := nullif(trim(coalesce(new.telegram_chat_id, '')), '');
  if nullif(trim(coalesce(new.phone_e164, '')), '') is null then
    new.phone_e164 := null;
  else
    new.phone_e164 := public.normalize_phone_e164(new.phone_e164);
  end if;
  return new;
end;
$$;

create or replace function public.prepare_service_transaction()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select name into new.barber_name_snapshot
  from public.barbers
  where id = new.barber_id;
  select name, category into new.service_name_snapshot, new.service_category_snapshot
  from public.services
  where id = new.service_id;
  if new.barber_name_snapshot is null or new.service_name_snapshot is null then
    raise exception 'El barbero o servicio no existe';
  end if;
  return new;
end;
$$;

create or replace function public.prepare_appointment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select name into new.barber_name_snapshot
  from public.barbers
  where id = new.barber_id;
  select name, category into new.service_name_snapshot, new.service_category_snapshot
  from public.services
  where id = new.service_id;
  if new.barber_name_snapshot is null or new.service_name_snapshot is null then
    raise exception 'El barbero o servicio no existe';
  end if;
  return new;
end;
$$;

create or replace function public.queue_client_welcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.welcome_status = 'pending' then
    insert into public.message_outbox (
      event_type,
      aggregate_type,
      aggregate_id,
      dedup_key,
      payload
    ) values (
      'client.welcome.requested',
      'client',
      new.id,
      'client-welcome:' || new.id::text,
      jsonb_build_object(
        'client_id', new.id,
        'full_name', new.full_name,
        'phone_e164', new.phone_e164,
        'source', new.source
      )
    ) on conflict (dedup_key) do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_id uuid;
begin
  row_id := case when tg_op = 'DELETE' then old.id else new.id end;
  insert into public.audit_log (table_name, record_id, action, old_data, new_data, actor_id)
  values (
    tg_table_name,
    row_id,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    auth.uid()
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();
create trigger barbers_touch_updated_at before update on public.barbers
for each row execute function public.touch_updated_at();
create trigger barbers_prepare before insert or update on public.barbers
for each row execute function public.prepare_barber();
create trigger services_touch_updated_at before update on public.services
for each row execute function public.touch_updated_at();
create trigger clients_prepare before insert or update on public.clients
for each row execute function public.prepare_client();
create trigger clients_touch_updated_at before update on public.clients
for each row execute function public.touch_updated_at();
create trigger clients_queue_welcome after insert on public.clients
for each row execute function public.queue_client_welcome();
create trigger appointments_touch_updated_at before update on public.appointments
for each row execute function public.touch_updated_at();
create trigger appointments_prepare before insert or update of barber_id, service_id on public.appointments
for each row execute function public.prepare_appointment();
create trigger transactions_touch_updated_at before update on public.service_transactions
for each row execute function public.touch_updated_at();
create trigger transactions_prepare before insert or update of barber_id, service_id on public.service_transactions
for each row execute function public.prepare_service_transaction();
create trigger expenses_touch_updated_at before update on public.expenses
for each row execute function public.touch_updated_at();
create trigger outbox_touch_updated_at before update on public.message_outbox
for each row execute function public.touch_updated_at();

create trigger clients_audit after insert or update or delete on public.clients
for each row execute function public.audit_row_change();
create trigger barbers_audit after insert or update or delete on public.barbers
for each row execute function public.audit_row_change();
create trigger services_audit after insert or update or delete on public.services
for each row execute function public.audit_row_change();
create trigger appointments_audit after insert or update or delete on public.appointments
for each row execute function public.audit_row_change();
create trigger transactions_audit after insert or update or delete on public.service_transactions
for each row execute function public.audit_row_change();
create trigger expenses_audit after insert or update or delete on public.expenses
for each row execute function public.audit_row_change();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.register_service_transaction(
  p_client_id uuid,
  p_client jsonb,
  p_barber_id uuid,
  p_service_id uuid,
  p_amount numeric,
  p_occurred_at timestamptz,
  p_payment_method public.payment_method,
  p_notes text,
  p_idempotency_key uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_client_id uuid;
  selected_transaction_id uuid;
  normalized_phone text;
  client_created boolean := false;
  transaction_created boolean := false;
begin
  if not public.is_app_admin() then
    raise exception 'No tiene permisos para registrar cortes';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El valor debe ser mayor que cero';
  end if;
  if not exists (select 1 from public.barbers where id = p_barber_id and active = true) then
    raise exception 'El barbero no está disponible';
  end if;
  if not exists (select 1 from public.services where id = p_service_id and active = true) then
    raise exception 'El servicio no está disponible';
  end if;

  if p_client_id is not null then
    select id into selected_client_id from public.clients where id = p_client_id;
    if selected_client_id is null then
      raise exception 'El cliente seleccionado no existe';
    end if;
  else
    normalized_phone := public.normalize_phone_e164(p_client ->> 'phone_e164');
    select id into selected_client_id from public.clients where phone_e164 = normalized_phone;
    if selected_client_id is null then
      insert into public.clients (
        full_name,
        phone_e164,
        email,
        document_id,
        birth_date,
        address,
        whatsapp_opt_in,
        source,
        notes,
        created_by
      ) values (
        trim(p_client ->> 'full_name'),
        normalized_phone,
        nullif(p_client ->> 'email', ''),
        nullif(p_client ->> 'document_id', ''),
        nullif(p_client ->> 'birth_date', '')::date,
        nullif(p_client ->> 'address', ''),
        coalesce((p_client ->> 'whatsapp_opt_in')::boolean, false),
        'manual',
        nullif(p_client ->> 'notes', ''),
        auth.uid()
      ) returning id into selected_client_id;
      client_created := true;
    end if;
  end if;

  insert into public.service_transactions (
    client_id,
    barber_id,
    service_id,
    amount,
    payment_method,
    occurred_at,
    source,
    idempotency_key,
    notes,
    created_by
  ) values (
    selected_client_id,
    p_barber_id,
    p_service_id,
    p_amount,
    coalesce(p_payment_method, 'cash'),
    coalesce(p_occurred_at, now()),
    'manual',
    p_idempotency_key,
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid()
  ) on conflict (idempotency_key) do nothing
  returning id into selected_transaction_id;

  if selected_transaction_id is null then
    select id into selected_transaction_id
    from public.service_transactions
    where idempotency_key = p_idempotency_key;
  else
    transaction_created := true;
  end if;

  return jsonb_build_object(
    'client_id', selected_client_id,
    'client_created', client_created,
    'transaction_id', selected_transaction_id,
    'transaction_created', transaction_created,
    'welcome_queued', client_created and coalesce((p_client ->> 'whatsapp_opt_in')::boolean, false)
  );
end;
$$;

create or replace function public.get_integration_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_app_admin() then
    raise exception 'No tiene permisos para consultar el catálogo de integración';
  end if;

  return jsonb_build_object(
    'barbers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'aliases', b.aliases,
        'calendar_external_id', b.calendar_external_id,
        'telegram_chat_id', b.telegram_chat_id,
        'phone_e164', b.phone_e164,
        'sort_order', b.sort_order
      ) order by b.sort_order, b.name)
      from public.barbers b
      where b.active = true
    ), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'code', s.code,
        'name', s.name,
        'aliases', s.aliases,
        'category', s.category,
        'price', s.price,
        'duration_minutes', s.duration_minutes,
        'sort_order', s.sort_order
      ) order by s.sort_order, s.name)
      from public.services s
      where s.active = true
    ), '[]'::jsonb)
  );
end;
$$;

alter table public.profiles enable row level security;
alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.service_transactions enable row level security;
alter table public.expenses enable row level security;
alter table public.message_outbox enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_read_own on public.profiles
for select to authenticated using (user_id = auth.uid() or public.is_app_admin());
create policy profiles_owner_manage on public.profiles
for all to authenticated using (public.current_app_role() = 'owner')
with check (public.current_app_role() = 'owner');

create policy catalog_read on public.barbers
for select to authenticated using (public.is_app_admin());
create policy catalog_insert on public.barbers
for insert to authenticated with check (public.is_app_admin());
create policy catalog_update on public.barbers
for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy services_read on public.services
for select to authenticated using (public.is_app_admin());
create policy services_insert on public.services
for insert to authenticated with check (public.is_app_admin());
create policy services_update on public.services
for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

create policy clients_admin_all on public.clients
for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy appointments_admin_all on public.appointments
for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy transactions_admin_all on public.service_transactions
for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy expenses_admin_all on public.expenses
for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy outbox_admin_read on public.message_outbox
for select to authenticated using (public.is_app_admin());
create policy audit_admin_read on public.audit_log
for select to authenticated using (public.is_app_admin());

grant usage on schema public to authenticated, service_role;
grant select on public.profiles, public.barbers, public.services, public.clients,
  public.appointments, public.service_transactions, public.expenses,
  public.message_outbox, public.audit_log to authenticated;
grant insert, update on public.clients, public.appointments, public.service_transactions,
  public.expenses, public.barbers, public.services to authenticated;
grant execute on function public.normalize_phone_e164(text) to authenticated, service_role;
grant execute on function public.current_app_role() to authenticated, service_role;
grant execute on function public.is_app_admin() to authenticated, service_role;
grant execute on function public.register_service_transaction(
  uuid, jsonb, uuid, uuid, numeric, timestamptz, public.payment_method, text, uuid
) to authenticated, service_role;
grant execute on function public.get_integration_catalog() to authenticated, service_role;

insert into public.barbers (name, aliases, sort_order) values
  ('Jeisson', array['Jeison', 'Jey', 'Jeyson', 'Jaison', 'Jason'], 10),
  ('Camilo', array['Juan', 'Juan Camilo'], 20),
  ('Luis', array['Lucho'], 30),
  ('Daniel', array[]::text[], 40)
on conflict (name) do update set active = true, aliases = excluded.aliases, sort_order = excluded.sort_order;

insert into public.services (code, name, category, price, duration_minutes, sort_order) values
  ('corte_alejandria', 'Corte Faro de Alejandría', 'Corte', 50000, 45, 10),
  ('barba_ribadeo', 'Barba Faro Ribadeo', 'Barba', 35000, 30, 20),
  ('barba_singapur', 'Barba Faro Singapur', 'Barba', 40000, 40, 30),
  ('mascarilla_malasia', 'Mascarilla Hidratante Faro Malasia', 'Mascarilla', 45000, 30, 40),
  ('cejas', 'Cejas', 'Cejas', 15000, 15, 50),
  ('corte_alejandria_cejas', 'Corte Faro de Alejandría + Cejas', 'Corte', 60000, 60, 60),
  ('combo_portobello', 'Combo Faro Portobello', 'Combo', 70000, 90, 70),
  ('combo_trinidad', 'Combo Faro Trinidad', 'Combo', 60000, 75, 80),
  ('combo_point_sur', 'Combo Faro Point Sur', 'Combo', 95000, 120, 90),
  ('combo_new_island', 'Combo Faro New Island', 'Combo', 115000, 120, 100),
  ('combo_ponta_verde', 'Combo Faro Ponta Verde', 'Combo', 125000, 150, 110)
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  price = excluded.price,
  duration_minutes = excluded.duration_minutes,
  active = true,
  sort_order = excluded.sort_order;
