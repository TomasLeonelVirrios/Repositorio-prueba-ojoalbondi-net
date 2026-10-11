-- =====================================================================
-- Migración 008 — Puntos restantes de la revisión de código del 11/10/2026
-- Para bases con la migración 007. Una base nueva ya lo incluye en instalacion_completa.sql.
-- Detalle: notes/code-review-2026-10-11.md (puntos 10, 12 y 13).
-- Se puede volver a correr sin romper nada.
-- =====================================================================
begin;

-- 1. Ticket: el año sale de la fecha de registro en hora de Argentina (antes, del año de now() en UTC:
--    un reclamo del 31/12 después de las 21 h recibía el ticket del año siguiente)
drop function if exists public.generar_ticket();
create or replace function public.generar_ticket(p_anio int)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_anio   int := p_anio;
  v_numero int;
  v_ticket text;
begin
  -- Solo se usa desde el trigger de reclamos: llamada por RPC gastaría números de ticket
  if pg_trigger_depth() = 0 then
    raise exception 'generar_ticket() solo se usa desde el trigger de reclamos' using errcode = '42501';
  end if;
  loop
    insert into public.tickets_contador (anio, ultimo) values (v_anio, 1)
      on conflict (anio) do update set ultimo = tickets_contador.ultimo + 1
      returning ultimo into v_numero;
    v_ticket := 'OB-' || v_anio || '-' || lpad(v_numero::text, 4, '0');
    exit when not exists (select 1 from public.reclamos where ticket = v_ticket);
  end loop;
  return v_ticket;
end $$;

create or replace function public.asignar_ticket()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.creado_en := now();
    new.ticket := public.generar_ticket(extract(year from new.creado_en at time zone 'America/Argentina/Buenos_Aires')::int);
  elsif new.ticket is null then
    new.ticket := public.generar_ticket(extract(year from new.creado_en at time zone 'America/Argentina/Buenos_Aires')::int);
  end if;
  return new;
end $$;

-- 2. Alta de perfil: nombre, apellido y fecha de nacimiento válidos, con un error que explica qué falta
create or replace function public.crear_perfil_al_registrarse()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nombre   text := nullif(trim(new.raw_user_meta_data->>'nombre'), '');
  v_apellido text := nullif(trim(new.raw_user_meta_data->>'apellido'), '');
  v_fecha    date;
begin
  begin
    v_fecha := (new.raw_user_meta_data->>'fecha_nacimiento')::date;
  exception when others then
    v_fecha := null;
  end;
  if v_nombre is null or v_apellido is null then
    raise exception 'Registro: faltan el nombre o el apellido' using errcode = '22023';
  end if;
  if v_fecha is null or v_fecha > current_date then
    raise exception 'Registro: falta la fecha de nacimiento o no es válida' using errcode = '22023';
  end if;
  insert into public.perfiles (id, nombre, apellido, fecha_nacimiento)
  values (new.id, v_nombre, v_apellido, v_fecha)
  on conflict (id) do nothing;
  return new;
end $$;

-- 3. Permisos de la nueva generar_ticket(int)
revoke all on function public.generar_ticket(int) from public, anon;
grant execute on function public.generar_ticket(int) to authenticated;

commit;
