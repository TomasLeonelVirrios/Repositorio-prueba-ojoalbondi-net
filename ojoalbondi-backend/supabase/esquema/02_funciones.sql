-- =====================================================================
-- OjoAlBondi · 02 · FUNCIONES Y TRIGGERS
-- Reglas de negocio que se validan en la base (no se pueden saltear desde fuera de la app).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Perfiles
-- ---------------------------------------------------------------------

-- Al registrarse, se crea el perfil con los datos del formulario. Siempre como ciudadano (RN-02).
create or replace function public.crear_perfil_al_registrarse()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre, apellido, fecha_nacimiento)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellido', ''),
    (new.raw_user_meta_data->>'fecha_nacimiento')::date
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.crear_perfil_al_registrarse();

-- Nadie puede cambiar su propio rol ni su organización desde la app (RN-02)
create or replace function public.proteger_rol()
returns trigger language plpgsql as $$
begin
  if (new.rol is distinct from old.rol or new.organizacion_id is distinct from old.organizacion_id)
     and current_user in ('authenticated', 'anon') then
    raise exception 'No se puede cambiar el rol ni la organización desde la app' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists perfiles_proteger_rol on public.perfiles;
create trigger perfiles_proteger_rol before update on public.perfiles
  for each row execute function public.proteger_rol();

-- ---------------------------------------------------------------------
-- Permisos (RNF-01, RF-18, RF-25)
-- ---------------------------------------------------------------------

create or replace function public.mi_rol()
returns text language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid();
$$;

create or replace function public.mi_organizacion()
returns text language sql stable security definer set search_path = public as $$
  select organizacion_id from public.perfiles where id = auth.uid();
$$;

-- Líneas que gestiona el usuario conectado:
-- municipio, todas; empresa, las de sus suscripciones activas; el resto, ninguna.
create or replace function public.mis_lineas()
returns setof text language sql stable security definer set search_path = public as $$
  select l.codigo from public.lineas l
  where exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'municipio')
     or exists (select 1 from public.perfiles p
                join public.suscripciones s on s.organizacion_id = p.organizacion_id
                where p.id = auth.uid() and p.rol = 'empresa' and s.estado = 'activa' and s.linea = l.codigo);
$$;

create or replace function public.puede_gestionar(p_linea text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_linea in (select public.mis_lineas());
$$;

-- ---------------------------------------------------------------------
-- Suscripciones (RF-25)
-- ---------------------------------------------------------------------

-- Solo las empresas se suscriben; al activarse se registra cuándo y quién la aprobó
create or replace function public.validar_suscripcion()
returns trigger language plpgsql as $$
begin
  if (select tipo from public.organizaciones where id = new.organizacion_id) <> 'empresa' then
    raise exception 'Solo las empresas tienen suscripciones (el municipio ve todas las líneas)';
  end if;
  if new.estado = 'activa' and (tg_op = 'INSERT' or old.estado is distinct from 'activa') then
    new.aprobada_en := coalesce(new.aprobada_en, now());
    new.aprobada_por := coalesce(new.aprobada_por, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists suscripciones_validar on public.suscripciones;
create trigger suscripciones_validar before insert or update on public.suscripciones
  for each row execute function public.validar_suscripcion();

-- ---------------------------------------------------------------------
-- Reclamos
-- ---------------------------------------------------------------------

-- Ticket correlativo por año: OB-2026-0001, OB-2026-0002…
create or replace function public.generar_ticket()
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_anio   int := extract(year from now());
  v_numero int;
  v_ticket text;
begin
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
  if new.ticket is null then
    new.ticket := public.generar_ticket();
  end if;
  return new;
end $$;

drop trigger if exists reclamos_asignar_ticket on public.reclamos;
create trigger reclamos_asignar_ticket before insert on public.reclamos
  for each row execute function public.asignar_ticket();

-- El sentido elegido tiene que ser un destino de los ramales activos de la línea (RF-03)
create or replace function public.validar_sentido()
returns trigger language plpgsql as $$
begin
  if not exists (
       select 1 from public.ramales r
       where r.linea = new.linea and r.activo and new.sentido_lugar_id in (r.lugar_a_id, r.lugar_b_id)) then
    raise exception 'El sentido elegido no corresponde a la línea %', new.linea using errcode = '22023';
  end if;
  return new;
end $$;

drop trigger if exists reclamos_validar_sentido on public.reclamos;
create trigger reclamos_validar_sentido before insert or update of linea, sentido_lugar_id on public.reclamos
  for each row execute function public.validar_sentido();

-- Todo reclamo nuevo arranca con la entrada "Recibido" registrada por el Sistema (RF-15)
create or replace function public.registrar_estado_inicial()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.historial_estados (reclamo_id, estado_anterior, estado_nuevo, responsable_nombre, creado_en)
  values (new.id, null, 'Recibido', 'Sistema', new.creado_en);
  return new;
end $$;

drop trigger if exists reclamos_registrar_estado_inicial on public.reclamos;
create trigger reclamos_registrar_estado_inicial after insert on public.reclamos
  for each row execute function public.registrar_estado_inicial();

-- El historial no se modifica; solo se borra en cascada al eliminar el reclamo (RF-19)
create or replace function public.historial_inmutable()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'El historial de estados no se puede modificar' using errcode = '42501';
  end if;
  if current_user in ('authenticated', 'anon') then
    raise exception 'El historial de estados no se puede borrar' using errcode = '42501';
  end if;
  return old;
end $$;

drop trigger if exists historial_inmutable on public.historial_estados;
create trigger historial_inmutable before update or delete on public.historial_estados
  for each row execute function public.historial_inmutable();

-- Única forma de cambiar el estado de un reclamo (RF-14): valida permiso, flujo y motivo de anulación
create or replace function public.cambiar_estado(p_reclamo uuid, p_nuevo text, p_comentario text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_reclamo     public.reclamos%rowtype;
  v_comentario  text := nullif(trim(coalesce(p_comentario, '')), '');
  v_responsable text;
begin
  select * into v_reclamo from public.reclamos where id = p_reclamo for update;
  if not found then
    raise exception 'El reclamo no existe' using errcode = 'P0002';
  end if;
  if not public.puede_gestionar(v_reclamo.linea) then
    raise exception 'No tenés permiso para gestionar este reclamo' using errcode = '42501';
  end if;
  if not ((v_reclamo.estado = 'Recibido'    and p_nuevo in ('En revisión', 'Anulado')) or
          (v_reclamo.estado = 'En revisión' and p_nuevo in ('Atendido', 'Anulado'))) then
    raise exception 'Cambio de estado no permitido: % → %', v_reclamo.estado, p_nuevo using errcode = '22023';
  end if;
  if p_nuevo = 'Anulado' and v_comentario is null then
    raise exception 'El motivo de anulación es obligatorio.' using errcode = '22023';
  end if;

  select o.nombre into v_responsable
  from public.perfiles p join public.organizaciones o on o.id = p.organizacion_id
  where p.id = auth.uid();

  update public.reclamos set estado = p_nuevo where id = p_reclamo;
  insert into public.historial_estados (reclamo_id, estado_anterior, estado_nuevo, comentario, responsable_id, responsable_nombre)
  values (p_reclamo, v_reclamo.estado, p_nuevo, v_comentario, auth.uid(), coalesce(v_responsable, 'Institución'));
end $$;

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
