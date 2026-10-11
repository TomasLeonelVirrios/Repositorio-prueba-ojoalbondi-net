-- =====================================================================
-- Migración 005 — Mapa de calor y administración (Registro de cambio N° 16)
-- Para bases con la migración 004. Una base nueva ya lo incluye en instalacion_completa.sql.
-- Agrega: funciones del mapa de calor (RF-17, RF-17.1), funciones y permisos del administrador (RF-26).
-- Se puede volver a correr sin romper nada.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- Mapa de calor (RF-17 y RF-17.1)
-- Devuelven solo datos agrupados: nunca reclamos individuales con datos del ciudadano.
-- Alcance: la empresa ve sus líneas (suscripción activa); ciudadano, municipio y administrador, todas.
-- No cuentan los anulados. Cada ciudadano suma como máximo 3 reclamos por parada (RN-01).
-- p_motivo y p_linea: filtro o null para todos. p_dias: período en días o null para todo el historial.
-- ---------------------------------------------------------------------
create or replace function public.lineas_visibles_en_mapa()
returns setof text language sql stable security definer set search_path = public as $$
  select codigo from public.lineas
  where coalesce(public.mi_rol(), 'ciudadano') <> 'empresa'
     or codigo in (select public.mis_lineas());
$$;

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
      and (p_linea is null or r.linea = p_linea)
      and (p_dias is null or r.fecha_hora_hecho >= now() - make_interval(days => p_dias))
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
    and (p_dias is null or r.fecha_hora_hecho >= now() - make_interval(days => p_dias))
  order by r.fecha_hora_hecho desc
  limit 20;
$$;

-- ---------------------------------------------------------------------
-- Administración (RF-26): cuentas y roles
-- ---------------------------------------------------------------------
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() = 'admin', false);
$$;

create or replace function public.admin_listar_cuentas()
returns table (id uuid, nombre text, apellido text, correo text, rol text, organizacion_id text, creado_en timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede ver las cuentas' using errcode = '42501';
  end if;
  return query
    select p.id, p.nombre, p.apellido, u.email::text, p.rol, p.organizacion_id, p.creado_en
    from public.perfiles p join auth.users u on u.id = p.id
    order by p.rol, p.apellido, p.nombre;
end $$;

-- Cambia el rol y la organización de una cuenta (RN-02: solo el administrador)
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
  update public.perfiles
     set rol = p_rol,
         organizacion_id = case when p_rol in ('empresa', 'municipio') then p_organizacion else null end
   where id = p_usuario;
end $$;


-- ---------------------------------------------------------------------
-- Mapa de calor y administración
-- ---------------------------------------------------------------------
revoke all on function public.calor_por_parada(text, int, text) from public, anon;
grant execute on function public.calor_por_parada(text, int, text) to authenticated;
revoke all on function public.reclamos_de_parada(bigint, text, int, text) from public, anon;
grant execute on function public.reclamos_de_parada(bigint, text, int, text) to authenticated;
revoke all on function public.admin_listar_cuentas() from public, anon;
grant execute on function public.admin_listar_cuentas() to authenticated;
revoke all on function public.admin_asignar_rol(uuid, text, text) from public, anon;
grant execute on function public.admin_asignar_rol(uuid, text, text) to authenticated;

-- El administrador gestiona las suscripciones desde la app (RF-25 y RF-26)
drop policy if exists "suscripciones: el administrador lee todas" on public.suscripciones;
create policy "suscripciones: el administrador lee todas" on public.suscripciones for select to authenticated
  using ((select public.es_admin()));
drop policy if exists "suscripciones: el administrador crea" on public.suscripciones;
create policy "suscripciones: el administrador crea" on public.suscripciones for insert to authenticated
  with check ((select public.es_admin()));
drop policy if exists "suscripciones: el administrador modifica" on public.suscripciones;
create policy "suscripciones: el administrador modifica" on public.suscripciones for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

commit;
