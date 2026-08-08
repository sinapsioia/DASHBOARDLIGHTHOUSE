-- Cree primero el usuario desde Authentication > Users en Supabase.
-- Reemplace el correo y ejecute este bloque una sola vez.
do $$
declare
  owner_email text := 'REEMPLAZAR_CORREO_DEL_DUENO';
  owner_id uuid;
begin
  select id into owner_id from auth.users where lower(email) = lower(owner_email);
  if owner_id is null then
    raise exception 'No existe un usuario con el correo %', owner_email;
  end if;
  insert into public.profiles (user_id, full_name, role, active)
  values (owner_id, coalesce((select raw_user_meta_data ->> 'full_name' from auth.users where id = owner_id), ''), 'owner', true)
  on conflict (user_id) do update set role = 'owner', active = true, updated_at = now();
end;
$$;
