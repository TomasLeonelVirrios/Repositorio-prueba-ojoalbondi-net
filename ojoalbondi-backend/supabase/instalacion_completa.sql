-- =====================================================================
-- OjoAlBondi · INSTALACIÓN COMPLETA (base de datos nueva)
-- Generado a partir de supabase/esquema/01 a 05 (scripts/armar-instalacion.mjs).
-- No editar a mano: editar los archivos de supabase/esquema y volver a generarlo.
-- Uso: Supabase > SQL Editor > New query > pegar todo > Run.
-- Se puede volver a correr sin romper nada.
-- =====================================================================
begin;

-- =====================================================================
-- OjoAlBondi · 01 · TABLAS
-- Estructura de datos. Las funciones, vistas, permisos y datos iniciales
-- están en los archivos 02 a 05.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Organizaciones: empresas de transporte y municipio
-- ---------------------------------------------------------------------
create table if not exists public.organizaciones (
  id      text primary key,
  nombre  text not null,
  tipo    text not null check (tipo in ('empresa', 'municipio'))
);

-- Contacto de cada organización: solo uso administrativo (la app no lo lee)
create table if not exists public.organizaciones_contacto (
  organizacion_id  text primary key references public.organizaciones(id) on delete cascade,
  razon_social     text,
  direccion        text,
  telefono         text
);

-- ---------------------------------------------------------------------
-- Perfiles de usuario (uno por cuenta de Supabase Auth)
-- ---------------------------------------------------------------------
create table if not exists public.perfiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  nombre            text not null,
  apellido          text not null,
  fecha_nacimiento  date not null check (fecha_nacimiento <= current_date),
  rol               text not null default 'ciudadano'
                      constraint perfiles_rol_check check (rol in ('ciudadano', 'empresa', 'municipio', 'admin')),
  organizacion_id   text references public.organizaciones(id),
  creado_en         timestamptz not null default now(),
  -- empresa y municipio pertenecen a una organización; ciudadano y admin, no
  constraint perfiles_organizacion_segun_rol check ((rol in ('empresa', 'municipio')) = (organizacion_id is not null))
);
create index if not exists perfiles_organizacion_idx on public.perfiles (organizacion_id);

-- ---------------------------------------------------------------------
-- Catálogos: líneas, lugares, ramales y motivos
-- ---------------------------------------------------------------------
create table if not exists public.lineas (
  codigo                text primary key,                      -- '501', '503', …
  empresa_operadora_id  text references public.organizaciones(id) on delete set null,  -- dato informativo
  observaciones         text
);

create table if not exists public.lugares (
  id      int generated always as identity primary key,
  nombre  text not null unique,                                 -- nombre general: 'Pilar', 'Derqui', …
  tipo    text not null check (tipo in ('localidad', 'barrio', 'zona', 'establecimiento'))
);

create table if not exists public.ramales (
  id           int generated always as identity primary key,
  linea        text not null references public.lineas(codigo) on update cascade on delete cascade,
  codigo       text,                                            -- 'R1'… solo donde las fuentes lo numeran
  lugar_a_id   int not null references public.lugares(id),
  lugar_b_id   int not null references public.lugares(id),
  observacion  text,
  activo       boolean not null default true,
  constraint ramales_lugares_distintos check (lugar_a_id <> lugar_b_id)
);
create unique index if not exists ramales_unico on public.ramales (linea, lugar_a_id, lugar_b_id, coalesce(codigo, ''));
create index if not exists ramales_linea_idx on public.ramales (linea);

-- Lugares intermedios de cada ramal, en orden
create table if not exists public.ramal_paso (
  ramal_id  int not null references public.ramales(id) on delete cascade,
  orden     smallint not null,
  lugar_id  int not null references public.lugares(id),
  primary key (ramal_id, orden)
);
create index if not exists ramal_paso_lugar_idx on public.ramal_paso (lugar_id);

create table if not exists public.motivos (
  codigo       text primary key,                                -- 'no_freno', 'robo', …
  descripcion  text not null,
  es_grave     boolean not null default false,                  -- RF-16: se destaca en la bandeja
  orden        smallint not null
);

-- Paradas de colectivo importadas de OpenStreetMap (scripts/importar-paradas-osm.mjs)
create table if not exists public.paradas (
  id        bigint primary key,                                 -- id del nodo de OpenStreetMap
  nombre    text,
  lineas    text[] not null default '{}',
  latitud   double precision not null,
  longitud  double precision not null
);
create index if not exists paradas_lineas_idx on public.paradas using gin (lineas);

-- ---------------------------------------------------------------------
-- Suscripciones por línea (RF-25): qué empresa gestiona cada línea
-- ---------------------------------------------------------------------
create table if not exists public.suscripciones (
  id               bigint generated always as identity primary key,
  linea            text not null references public.lineas(codigo) on update cascade,
  organizacion_id  text not null references public.organizaciones(id) on delete cascade,
  estado           text not null default 'pendiente' check (estado in ('pendiente', 'activa', 'suspendida', 'rechazada')),
  creada_en        timestamptz not null default now(),
  aprobada_por     uuid references auth.users(id) on delete set null,
  aprobada_en      timestamptz,
  observacion      text
);
create unique index if not exists suscripciones_una_activa on public.suscripciones (linea) where estado = 'activa';
create index if not exists suscripciones_organizacion_idx on public.suscripciones (organizacion_id, estado);

-- ---------------------------------------------------------------------
-- Reclamos y su historial
-- ---------------------------------------------------------------------
create table if not exists public.tickets_contador (
  anio    int primary key,
  ultimo  int not null
);

create table if not exists public.reclamos (
  id                uuid primary key default gen_random_uuid(),
  ticket            text not null unique,                       -- OB-AAAA-NNNN, lo completa un trigger
  ciudadano_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  linea             text not null references public.lineas(codigo) on update cascade,
  sentido_lugar_id  int not null references public.lugares(id),
  motivo            text not null references public.motivos(codigo),
  interno_patente   text,                                       -- obligatorio salvo motivo robo
  descripcion       text,
  fecha_hora_hecho  timestamp not null,                         -- hora local de Argentina
  ubicacion_texto   text not null,
  latitud           double precision,
  longitud          double precision,
  parada_id         bigint references public.paradas(id) on delete set null,
  foto_ruta         text,                                       -- ruta dentro del bucket fotos-reclamos
  estado            text not null default 'Recibido'
                      constraint reclamos_estado_check check (estado in ('Recibido', 'En revisión', 'Atendido', 'Anulado')),
  creado_en         timestamptz not null default now(),
  constraint reclamos_interno_obligatorio check (motivo = 'robo' or nullif(trim(interno_patente), '') is not null)
);
create index if not exists reclamos_ciudadano_idx    on public.reclamos (ciudadano_id, creado_en desc);
create index if not exists reclamos_linea_fecha_idx  on public.reclamos (linea, creado_en desc);
create index if not exists reclamos_estado_idx       on public.reclamos (estado);
create index if not exists reclamos_parada_idx       on public.reclamos (parada_id);
create index if not exists reclamos_sentido_idx      on public.reclamos (sentido_lugar_id);
create index if not exists reclamos_foto_idx         on public.reclamos (foto_ruta) where foto_ruta is not null;

create table if not exists public.historial_estados (
  id                  bigint generated always as identity primary key,
  reclamo_id          uuid not null references public.reclamos(id) on delete cascade,
  estado_anterior     text,
  estado_nuevo        text not null,
  comentario          text,
  responsable_id      uuid references auth.users(id) on delete set null,
  responsable_nombre  text not null,                            -- 'Sistema', 'Ciudadano' o la organización
  creado_en           timestamptz not null default now()
);
create index if not exists historial_reclamo_idx on public.historial_estados (reclamo_id, creado_en);


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


-- =====================================================================
-- OjoAlBondi · 03 · VISTAS Y CONSULTAS
-- =====================================================================

-- Opciones del campo Sentido: destinos de los ramales activos de cada línea, sin repetir (RF-03)
create or replace view public.sentidos_por_linea with (security_invoker = true) as
  select distinct r.linea, l.id as lugar_id, l.nombre
  from public.ramales r
  join public.lugares l on l.id in (r.lugar_a_id, r.lugar_b_id)
  where r.activo;

-- Reclamos que gestiona la institución conectada (RF-11, RF-13).
-- Del ciudadano expone solo nombre y apellido (RNF-03): nunca correo, fecha de nacimiento ni su id.
drop view if exists public.reclamos_gestion;
create view public.reclamos_gestion with (security_invoker = false) as
  select r.id, r.ticket, r.linea, r.estado, r.creado_en,
         r.motivo, m.descripcion as motivo_descripcion, m.es_grave,
         r.sentido_lugar_id, ls.nombre as sentido,
         r.interno_patente, r.descripcion, r.fecha_hora_hecho, r.ubicacion_texto,
         r.latitud, r.longitud, r.parada_id, r.foto_ruta,
         p.nombre as ciudadano_nombre, p.apellido as ciudadano_apellido,
         s.organizacion_id as organizacion_gestora_id
  from public.reclamos r
  join public.motivos m   on m.codigo = r.motivo
  join public.lugares ls  on ls.id = r.sentido_lugar_id
  join public.perfiles p  on p.id = r.ciudadano_id
  left join public.suscripciones s on s.linea = r.linea and s.estado = 'activa'
  where r.linea in (select public.mis_lineas());

-- Contadores de la bandeja en una sola consulta
create or replace function public.contar_bandeja()
returns table (estado text, cantidad bigint) language sql stable as $$
  select estado, count(*) from public.reclamos_gestion group by estado;
$$;


-- =====================================================================
-- OjoAlBondi · 04 · SEGURIDAD (RLS, permisos y almacenamiento)
-- Regla general: cada uno ve solo lo que le corresponde según su rol.
-- En las políticas, auth.uid() y mis_lineas() van entre (select …) para
-- calcularse una vez por consulta y no una vez por fila.
-- =====================================================================

alter table public.organizaciones           enable row level security;
alter table public.organizaciones_contacto  enable row level security;  -- sin políticas: solo administración
alter table public.perfiles                 enable row level security;
alter table public.lineas                   enable row level security;
alter table public.lugares                  enable row level security;
alter table public.ramales                  enable row level security;
alter table public.ramal_paso               enable row level security;
alter table public.motivos                  enable row level security;
alter table public.paradas                  enable row level security;
alter table public.suscripciones            enable row level security;
alter table public.tickets_contador         enable row level security;  -- sin políticas: lo usa generar_ticket()
alter table public.reclamos                 enable row level security;
alter table public.historial_estados        enable row level security;

-- ---------------------------------------------------------------------
-- Catálogos: los leen todos los usuarios conectados
-- ---------------------------------------------------------------------
drop policy if exists "organizaciones: leer" on public.organizaciones;
create policy "organizaciones: leer" on public.organizaciones for select to authenticated using (true);
drop policy if exists "lineas: leer" on public.lineas;
create policy "lineas: leer" on public.lineas for select to authenticated using (true);
drop policy if exists "lugares: leer" on public.lugares;
create policy "lugares: leer" on public.lugares for select to authenticated using (true);
drop policy if exists "ramales: leer" on public.ramales;
create policy "ramales: leer" on public.ramales for select to authenticated using (true);
drop policy if exists "ramal_paso: leer" on public.ramal_paso;
create policy "ramal_paso: leer" on public.ramal_paso for select to authenticated using (true);
drop policy if exists "motivos: leer" on public.motivos;
create policy "motivos: leer" on public.motivos for select to authenticated using (true);
drop policy if exists "paradas: leer" on public.paradas;
create policy "paradas: leer" on public.paradas for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- Perfiles y suscripciones: cada uno, lo suyo
-- ---------------------------------------------------------------------
drop policy if exists "perfiles: leer el propio" on public.perfiles;
create policy "perfiles: leer el propio" on public.perfiles for select using ((select auth.uid()) = id);

drop policy if exists "suscripciones: leer las propias" on public.suscripciones;
create policy "suscripciones: leer las propias" on public.suscripciones for select to authenticated
  using (organizacion_id = (select public.mi_organizacion()));

-- ---------------------------------------------------------------------
-- Reclamos: el ciudadano los suyos; la institución, los de sus líneas.
-- No hay políticas de UPDATE ni DELETE: el estado cambia solo con cambiar_estado().
-- ---------------------------------------------------------------------
drop policy if exists "reclamos: el ciudadano lee los suyos" on public.reclamos;
create policy "reclamos: el ciudadano lee los suyos" on public.reclamos for select
  using ((select auth.uid()) = ciudadano_id);

drop policy if exists "reclamos: el ciudadano crea" on public.reclamos;
create policy "reclamos: el ciudadano crea" on public.reclamos for insert
  with check ((select auth.uid()) = ciudadano_id and estado = 'Recibido' and (select public.mi_rol()) = 'ciudadano');

drop policy if exists "reclamos: la institución lee sus líneas" on public.reclamos;
create policy "reclamos: la institución lee sus líneas" on public.reclamos for select to authenticated
  using (linea in (select public.mis_lineas()));

-- El historial se ve si se ve el reclamo
drop policy if exists "historial: leer" on public.historial_estados;
create policy "historial: leer" on public.historial_estados for select to authenticated
  using (exists (select 1 from public.reclamos r where r.id = historial_estados.reclamo_id));

-- ---------------------------------------------------------------------
-- Vistas y funciones expuestas a la app
-- ---------------------------------------------------------------------
revoke all on public.reclamos_gestion from anon;
grant select on public.reclamos_gestion to authenticated;
grant select on public.sentidos_por_linea to authenticated;

revoke all on function public.cambiar_estado(uuid, text, text) from public, anon;
grant execute on function public.cambiar_estado(uuid, text, text) to authenticated;
revoke all on function public.contar_bandeja() from public, anon;
grant execute on function public.contar_bandeja() to authenticated;

-- ---------------------------------------------------------------------
-- Fotos de los reclamos (bucket privado)
-- Cada ciudadano sube a su carpeta <su id>/…; la institución ve las de sus líneas.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('fotos-reclamos', 'fotos-reclamos', false)
on conflict (id) do nothing;

drop policy if exists "fotos: el ciudadano sube las suyas" on storage.objects;
create policy "fotos: el ciudadano sube las suyas" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos-reclamos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "fotos: el ciudadano ve las suyas" on storage.objects;
create policy "fotos: el ciudadano ve las suyas" on storage.objects for select to authenticated
  using (bucket_id = 'fotos-reclamos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "fotos: la institución ve las de sus líneas" on storage.objects;
create policy "fotos: la institución ve las de sus líneas" on storage.objects for select to authenticated
  using (bucket_id = 'fotos-reclamos' and exists (
    select 1 from public.reclamos r
    where r.foto_ruta = storage.objects.name and r.linea in (select public.mis_lineas())));

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


-- =====================================================================
-- OjoAlBondi · 05 · DATOS INICIALES
-- Catálogos y datos reales del relevamiento (Registro de requerimiento N° 28).
-- Se puede volver a correr: actualiza sin duplicar.
-- =====================================================================

insert into public.organizaciones (id, nombre, tipo) values
  ('muni', 'Municipio de Pilar — Transporte', 'municipio'),
  ('tratado', 'Tratado del Pilar', 'empresa'),
  ('monterrey', 'Empresa Monterrey', 'empresa'),
  ('escondida', 'La Primera de la Escondida', 'empresa'),
  ('pilarbus', 'Pilar Bus', 'empresa'),
  ('rutabus', 'Ruta Bus', 'empresa'),
  ('central', 'La Central de Escobar', 'empresa')
on conflict (id) do update set nombre = excluded.nombre, tipo = excluded.tipo;

-- Vacío = a completar cuando lo aporte la empresa
insert into public.organizaciones_contacto (organizacion_id, razon_social, direccion, telefono) values
  ('tratado', 'Tratado del Pilar S.R.L.', 'Ruta 25 N° 730, Pilar', '(0230) 443-1548'),
  ('monterrey', 'Empresa Monterrey S.R.L.', null, null),
  ('escondida', 'La Primera de la Escondida S.R.L.', 'Ruta Provincial 25 N° 2196, B1625 Belén de Escobar', null),
  ('pilarbus', 'Pilar Bus S.A.', 'Av. Presidente Hipólito Yrigoyen 57, José C. Paz', '(02320) 42-3260'),
  ('rutabus', 'Ruta Bus S.A.', null, null),
  ('central', 'La Central de Escobar S.A.', 'Ex Ruta 9 km 49,300', null)
on conflict (organizacion_id) do update
  set razon_social = excluded.razon_social, direccion = excluded.direccion, telefono = excluded.telefono;

insert into public.lineas (codigo, empresa_operadora_id, observaciones) values
  ('501', 'tratado', 'Unidades color gris con celeste.'),
  ('503', 'tratado', 'Unidades Iveco blancas.'),
  ('506', 'monterrey', null),
  ('509', 'escondida', 'Unidades blancas con franjas verdes y rojas.'),
  ('510', 'pilarbus', 'Empresa del grupo Metropol.'),
  ('511', 'rutabus', null),
  ('520', 'central', 'Unidades azules con verde.')
on conflict (codigo) do update set empresa_operadora_id = excluded.empresa_operadora_id, observaciones = excluded.observaciones;

insert into public.motivos (codigo, descripcion, es_grave, orden) values
  ('no_freno', 'Hice señas y el colectivo no frenó', false, 1),
  ('demora', 'Demora/poca frecuencia', false, 2),
  ('exceso', 'Exceso de pasajeros/colectivo lleno', false, 3),
  ('mal_estado', 'Mal estado de la unidad', false, 4),
  ('ventilacion', 'Falta de ventilación o aire acondicionado', false, 5),
  ('conductor', 'Mala actitud del conductor/falta de respeto', false, 6),
  ('pago', 'Problema con el pago del boleto/SUBE', false, 7),
  ('robo', 'Robo, hurto o agresión en la parada del colectivo', true, 8)
on conflict (codigo) do update set descripcion = excluded.descripcion, es_grave = excluded.es_grave, orden = excluded.orden;

-- Destinos (aparecen en el campo Sentido) y lugares solo de paso
insert into public.lugares (nombre, tipo) values
  ('Pilar', 'localidad'),
  ('Villa Rosa', 'localidad'),
  ('Villa Astolfi', 'localidad'),
  ('San Alejo', 'barrio'),
  ('Fábrica Militar', 'establecimiento'),
  ('Manzone', 'barrio'),
  ('Derqui', 'localidad'),
  ('Barrio Toro', 'barrio'),
  ('Barrio Monterrey', 'barrio'),
  ('Barrio San Souci', 'barrio'),
  ('Barrio La Escondida', 'barrio'),
  ('Barrio El Triángulo', 'barrio'),
  ('Parque Industrial', 'zona'),
  ('Km 61', 'zona'),
  ('Manuel Alberti', 'localidad'),
  ('Del Viso', 'localidad'),
  ('Fátima', 'localidad'),
  ('Manzanares', 'localidad'),
  ('Carabassa', 'barrio'),
  ('La Lomita', 'barrio'),
  ('Golfers', 'barrio'),
  ('Pilarica', 'barrio'),
  ('Zelaya', 'localidad'),
  ('Altos del Pilar', 'barrio'),
  ('Los Lagartos', 'barrio'),
  ('Hospital Central de Pilar', 'establecimiento'),
  ('Puente Garín', 'zona'),
  ('Barrio Carumbé', 'barrio'),
  ('Barrio Salas', 'barrio'),
  ('Universidad del Salvador', 'establecimiento'),
  ('Agustoni', 'barrio'),
  ('Puente Fátima', 'zona'),
  ('Villa Luján', 'barrio')
on conflict (nombre) do update set tipo = excluded.tipo;

-- Ramales (30). pg_temp.lugar() busca el id de un lugar por su nombre.
create or replace function pg_temp.lugar(p_nombre text) returns int language sql stable as $$
  select id from public.lugares where nombre = p_nombre;
$$;

do $$
declare v_ramal int;
begin
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('501', null, pg_temp.lugar('Villa Rosa'), pg_temp.lugar('Villa Astolfi'), 'Sale de Barrio Luchetti (Villa Rosa).')
  on conflict do nothing returning id into v_ramal;
  if v_ramal is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v_ramal, 1, pg_temp.lugar('Pilar'));
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('501', null, pg_temp.lugar('Pilar'), pg_temp.lugar('San Alejo'), null)
  on conflict do nothing returning id into v_ramal;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('501', null, pg_temp.lugar('Pilar'), pg_temp.lugar('Villa Rosa'), null)
  on conflict do nothing returning id into v_ramal;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('503', null, pg_temp.lugar('Pilar'), pg_temp.lugar('Fábrica Militar'), null)
  on conflict do nothing returning id into v_ramal;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('503', null, pg_temp.lugar('Pilar'), pg_temp.lugar('Manzone'), 'También tiene servicio nocturno.')
  on conflict do nothing returning id into v_ramal;
  if v_ramal is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v_ramal, 1, pg_temp.lugar('Pilarica'));
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('503', null, pg_temp.lugar('Pilar'), pg_temp.lugar('San Alejo'), null)
  on conflict do nothing returning id into v_ramal;
  if v_ramal is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v_ramal, 1, pg_temp.lugar('Pilarica'));
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v_ramal, 2, pg_temp.lugar('Manzone'));
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('503', null, pg_temp.lugar('San Alejo'), pg_temp.lugar('Manzone'), null)
  on conflict do nothing returning id into v_ramal;
  if v_ramal is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v_ramal, 1, pg_temp.lugar('Hospital Central de Pilar'));
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v_ramal, 2, pg_temp.lugar('Pilar'));
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v_ramal, 3, pg_temp.lugar('Pilarica'));
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('506', null, pg_temp.lugar('Derqui'), pg_temp.lugar('Barrio Toro'), 'Circuito: sale y vuelve a la estación Derqui.')
  on conflict do nothing returning id into v_ramal;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('506', null, pg_temp.lugar('Derqui'), pg_temp.lugar('Barrio Monterrey'), 'Circuito por Rivera Villate.')
  on conflict do nothing returning id into v_ramal;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('509', 'R1', pg_temp.lugar('Derqui'), pg_temp.lugar('Barrio San Souci'), null)
  on conflict do nothing returning id into v_ramal;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('509', 'R2', pg_temp.lugar('Derqui'), pg_temp.lugar('Barrio La Escondida'), null)
  on conflict do nothing returning id into v_ramal;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('509', 'R3', pg_temp.lugar('Derqui'), pg_temp.lugar('Barrio El Triángulo'), null)
  on conflict do nothing returning id into v_ramal;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('510', 'R1', pg_temp.lugar('Pilar'), pg_temp.lugar('Parque Industrial'), 'Por Ruta 8.')
  on conflict do nothing returning id into v_ramal;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('510', 'R2', pg_temp.lugar('Pilar'), pg_temp.lugar('Parque Industrial'), 'Por Petrel.')
  on conflict do nothing returning id into v_ramal;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('510', 'R3', pg_temp.lugar('Pilar'), pg_temp.lugar('Km 61'), null)
  on conflict do nothing returning id into v_ramal;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('510', 'R4', pg_temp.lugar('Pilar'), pg_temp.lugar('Manuel Alberti'), null)
  on conflict do nothing returning id into v_ramal;
  if v_ramal is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v_ramal, 1, pg_temp.lugar('Puente Garín'));
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v_ramal, 2, pg_temp.lugar('Barrio Carumbé'));
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('510', 'R5', pg_temp.lugar('Pilar'), pg_temp.lugar('Del Viso'), null)
  on conflict do nothing returning id into v_ramal;
  if v_ramal is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v_ramal, 1, pg_temp.lugar('Manuel Alberti'));
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('510', 'R6', pg_temp.lugar('Villa Astolfi'), pg_temp.lugar('Parque Industrial'), null)
  on conflict do nothing returning id into v_ramal;
  if v_ramal is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v_ramal, 1, pg_temp.lugar('Barrio Salas'));
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v_ramal, 2, pg_temp.lugar('Pilar'));
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('510', 'R7', pg_temp.lugar('Km 61'), pg_temp.lugar('Fátima'), null)
  on conflict do nothing returning id into v_ramal;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('510', 'R9', pg_temp.lugar('Pilar'), pg_temp.lugar('Manuel Alberti'), null)
  on conflict do nothing returning id into v_ramal;
  if v_ramal is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v_ramal, 1, pg_temp.lugar('Villa Rosa'));
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('511', null, pg_temp.lugar('Pilar'), pg_temp.lugar('Manzanares'), 'Solo días hábiles.')
  on conflict do nothing returning id into v_ramal;
  if v_ramal is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v_ramal, 1, pg_temp.lugar('Puente Fátima'));
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('511', null, pg_temp.lugar('Pilar'), pg_temp.lugar('Carabassa'), 'Termina en Country El Recuerdo.')
  on conflict do nothing returning id into v_ramal;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('511', null, pg_temp.lugar('Pilar'), pg_temp.lugar('La Lomita'), 'Según la variante, por Universidad del Salvador o por Agustoni.')
  on conflict do nothing returning id into v_ramal;
  if v_ramal is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v_ramal, 1, pg_temp.lugar('Universidad del Salvador'));
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v_ramal, 2, pg_temp.lugar('Agustoni'));
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('511', null, pg_temp.lugar('La Lomita'), pg_temp.lugar('Golfers'), 'Algunas variantes pasan por Agustoni.')
  on conflict do nothing returning id into v_ramal;
  if v_ramal is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v_ramal, 1, pg_temp.lugar('Agustoni'));
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('511', null, pg_temp.lugar('Pilar'), pg_temp.lugar('Pilarica'), null)
  on conflict do nothing returning id into v_ramal;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('520', 'R1', pg_temp.lugar('Pilar'), pg_temp.lugar('Derqui'), 'Por Ruta 8 y Av. Perón.')
  on conflict do nothing returning id into v_ramal;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('520', 'R2', pg_temp.lugar('Pilar'), pg_temp.lugar('Barrio Toro'), null)
  on conflict do nothing returning id into v_ramal;
  if v_ramal is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v_ramal, 1, pg_temp.lugar('Derqui'));
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v_ramal, 2, pg_temp.lugar('Villa Luján'));
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('520', 'R3', pg_temp.lugar('Derqui'), pg_temp.lugar('Zelaya'), null)
  on conflict do nothing returning id into v_ramal;
  if v_ramal is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v_ramal, 1, pg_temp.lugar('Villa Rosa'));
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('520', 'R4', pg_temp.lugar('Del Viso'), pg_temp.lugar('Altos del Pilar'), null)
  on conflict do nothing returning id into v_ramal;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('520', 'R5', pg_temp.lugar('Del Viso'), pg_temp.lugar('Los Lagartos'), null)
  on conflict do nothing returning id into v_ramal;
end $$;

commit;
