-- =====================================================================
-- Migración 007 — Arreglos de la revisión de código del 11/10/2026
-- Para bases con la migración 006. Una base nueva ya lo incluye en instalacion_completa.sql.
-- Detalle de cada punto: notes/code-review-2026-10-11.md (puntos 1, 2, 3, 8, 9, 11 y 14).
-- Se puede volver a correr sin romper nada.
-- =====================================================================
begin;

-- 1. generar_ticket() rechaza las llamadas por RPC (solo se usa desde el trigger de reclamos)
create or replace function public.generar_ticket()
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_anio   int := extract(year from now());
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

-- 2. Fecha del hecho no futura y foto en la carpeta del propio ciudadano
create or replace function public.validar_reclamo_nuevo()
returns trigger language plpgsql as $$
begin
  if new.fecha_hora_hecho > (now() at time zone 'America/Argentina/Buenos_Aires') + interval '5 minutes' then
    raise exception 'La fecha y hora del hecho no puede ser futura' using errcode = '22023';
  end if;
  if current_user in ('authenticated', 'anon') and new.foto_ruta is not null
     and split_part(new.foto_ruta, '/', 1) is distinct from auth.uid()::text then
    raise exception 'La foto no pertenece a tu cuenta' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists reclamos_validar_nuevo on public.reclamos;
create trigger reclamos_validar_nuevo before insert on public.reclamos
  for each row execute function public.validar_reclamo_nuevo();

-- 3. Funciones para las políticas del historial y de las fotos
create or replace function public.puede_ver_reclamo(p_reclamo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.reclamos r
                 where r.id = p_reclamo
                   and (r.ciudadano_id = auth.uid() or r.linea in (select public.mis_lineas())));
$$;

create or replace function public.foto_de_mis_lineas(p_ruta text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.reclamos r
                 where r.foto_ruta = p_ruta and r.linea in (select public.mis_lineas()));
$$;

-- 4. Mapa de calor: período comparado contra la hora de Argentina (y sin la línea repetida)
create or replace function public.calor_por_parada(p_motivo text default null, p_dias int default 30, p_linea text default null)
returns table (parada_id bigint, cantidad bigint) language sql stable security definer set search_path = public as $$
  with por_ciudadano as (
    select r.parada_id, r.ciudadano_id, count(*) as n
    from public.reclamos r
    where r.parada_id is not null
      and r.estado <> 'Anulado'
      and r.linea in (select public.lineas_visibles_en_mapa())
      and (p_motivo is null or r.motivo = p_motivo)
      and (p_linea is null or r.linea = p_linea)
      and (p_dias is null or r.fecha_hora_hecho >= (now() at time zone 'America/Argentina/Buenos_Aires') - make_interval(days => p_dias))
    group by r.parada_id, r.ciudadano_id
  )
  select parada_id, sum(least(n, 3))::bigint from por_ciudadano group by parada_id;
$$;

create or replace function public.reclamos_de_parada(p_parada bigint, p_motivo text default null, p_dias int default 30, p_linea text default null)
returns table (motivo_descripcion text, fecha date, linea text, total bigint)
language sql stable security definer set search_path = public as $$
  select m.descripcion, r.fecha_hora_hecho::date, r.linea, count(*) over ()
  from public.reclamos r
  join public.motivos m on m.codigo = r.motivo
  where r.parada_id = p_parada
    and r.estado <> 'Anulado'
    and r.linea in (select public.lineas_visibles_en_mapa())
    and (p_motivo is null or r.motivo = p_motivo)
    and (p_linea is null or r.linea = p_linea)
    and (p_dias is null or r.fecha_hora_hecho >= (now() at time zone 'America/Argentina/Buenos_Aires') - make_interval(days => p_dias))
  order by r.fecha_hora_hecho desc
  limit 20;
$$;

-- 5. admin_asignar_rol: la organización tiene que corresponder al rol
create or replace function public.admin_asignar_rol(p_usuario uuid, p_rol text, p_organizacion text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede cambiar roles' using errcode = '42501';
  end if;
  if p_usuario = auth.uid() and p_rol <> 'admin' then
    raise exception 'No podés quitarte el rol de administrador a vos mismo' using errcode = '22023';
  end if;
  if p_rol in ('empresa', 'municipio') and p_organizacion is null then
    raise exception 'Las cuentas de empresa o municipio necesitan una organización' using errcode = '22023';
  end if;
  -- Empresa con una organización de tipo empresa; municipio, con el municipio
  if p_rol in ('empresa', 'municipio')
     and (select tipo from public.organizaciones where id = p_organizacion) is distinct from p_rol then
    raise exception 'La organización elegida no corresponde al rol %', p_rol using errcode = '22023';
  end if;
  update public.perfiles
     set rol = p_rol,
         organizacion_id = case when p_rol in ('empresa', 'municipio') then p_organizacion else null end
   where id = p_usuario;
  if not found then
    raise exception 'La cuenta no existe' using errcode = 'P0002';
  end if;
end $$;

-- 6. Reclamos: la institución deja de leer la tabla (usa la vista); columnas que puede cargar la app
drop policy if exists "reclamos: la institución lee sus líneas" on public.reclamos;

-- Desde la app solo se pueden cargar los datos del formulario: ticket, creado_en y estado los pone la base.
-- El id se acepta para que reenviar un borrador no duplique el reclamo.
revoke insert, update, delete on public.reclamos from anon, authenticated;
grant insert (id, ciudadano_id, linea, sentido_lugar_id, motivo, interno_patente, descripcion, fecha_hora_hecho,
              ubicacion_texto, latitud, longitud, parada_id, foto_ruta) on public.reclamos to authenticated;

-- 7. Historial: política con puede_ver_reclamo() y sin exponer responsable_id
-- El historial se ve si se ve el reclamo. No se expone el id del operador (responsable_id).
drop policy if exists "historial: leer" on public.historial_estados;
create policy "historial: leer" on public.historial_estados for select to authenticated
  using ((select public.puede_ver_reclamo(historial_estados.reclamo_id)));
revoke all on public.historial_estados from anon, authenticated;
grant select (id, reclamo_id, estado_anterior, estado_nuevo, comentario, responsable_nombre, creado_en)
  on public.historial_estados to authenticated;

-- 8. Fotos: la institución usa foto_de_mis_lineas()
drop policy if exists "fotos: la institución ve las de sus líneas" on storage.objects;
create policy "fotos: la institución ve las de sus líneas" on storage.objects for select to authenticated
  using (bucket_id = 'fotos-reclamos' and public.foto_de_mis_lineas(name));

-- 9. Permisos de las funciones internas
-- Funciones internas: no se llaman por RPC sin sesión. generar_ticket() la necesita el trigger
-- (que corre como el usuario), pero rechaza cualquier llamada que no venga de un trigger.
revoke all on function public.generar_ticket() from public, anon;
revoke all on function public.mi_rol() from public, anon;
revoke all on function public.mi_organizacion() from public, anon;
revoke all on function public.mis_lineas() from public, anon;
revoke all on function public.puede_gestionar(text) from public, anon;
revoke all on function public.es_admin() from public, anon;
revoke all on function public.lineas_visibles_en_mapa() from public, anon;
revoke all on function public.puede_ver_reclamo(uuid) from public, anon;
revoke all on function public.foto_de_mis_lineas(text) from public, anon;
grant execute on function public.generar_ticket(), public.mi_rol(), public.mi_organizacion(), public.mis_lineas(), public.puede_gestionar(text),
  public.es_admin(), public.lineas_visibles_en_mapa(), public.puede_ver_reclamo(uuid), public.foto_de_mis_lineas(text)
  to authenticated;

-- 10. Funciones que quedaron de migraciones anteriores y una base nueva no tiene
drop function if exists public.registrar_recibido();
drop function if exists public._lugar(text);

commit;
