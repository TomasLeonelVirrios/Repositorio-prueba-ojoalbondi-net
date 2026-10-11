-- =====================================================================
-- Migración 003 — Datos reales, catálogo de lugares, suscripciones y optimización
-- (Registro de cambio N° 14 · Registros de requerimiento N° 26, 27 y 28)
--
-- ANTES de correrla: borrar los datos de prueba con
--   node ojoalbondi-backend/scripts/datos-prueba.mjs --borrar
-- Requiere: schema.sql y migración 002. Se puede volver a correr sin romper nada.
-- =====================================================================
begin;

-- Las cuentas de prueba usan las empresas simuladas: hay que borrarlas primero
do $$
begin
  if exists (select 1 from public.perfiles where organizacion_id in ('empA', 'empB')) then
    raise exception 'Hay cuentas asociadas a las empresas de ejemplo. Corré primero: node ojoalbondi-backend/scripts/datos-prueba.mjs --borrar';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1) EMPRESAS REALES (Registro de requerimiento N° 28)
-- ---------------------------------------------------------------------
insert into public.organizaciones (id, nombre, tipo) values
  ('tratado', 'Tratado del Pilar', 'empresa'),
  ('monterrey', 'Empresa Monterrey', 'empresa'),
  ('escondida', 'La Primera de la Escondida', 'empresa'),
  ('pilarbus', 'Pilar Bus', 'empresa'),
  ('rutabus', 'Ruta Bus', 'empresa'),
  ('central', 'La Central de Escobar', 'empresa')
on conflict (id) do update set nombre = excluded.nombre, tipo = excluded.tipo;

insert into public.organizaciones_contacto (organizacion_id, razon_social, direccion, telefono) values
  ('tratado', 'Tratado del Pilar S.R.L.', 'Ruta 25 N° 730, Pilar', '(0230) 443-1548'),
  ('monterrey', 'Empresa Monterrey S.R.L.', null, null),
  ('escondida', 'La Primera de la Escondida S.R.L.', 'Ruta Provincial 25 N° 2196, B1625 Belén de Escobar', null),
  ('pilarbus', 'Pilar Bus S.A.', 'Av. Presidente Hipólito Yrigoyen 57, José C. Paz', '(02320) 42-3260'),
  ('rutabus', 'Ruta Bus S.A.', null, null),
  ('central', 'La Central de Escobar S.A.', 'Ex Ruta 9 km 49,300', null)
on conflict (organizacion_id) do update
  set razon_social = excluded.razon_social, direccion = excluded.direccion, telefono = excluded.telefono;

-- ---------------------------------------------------------------------
-- 2) LÍNEAS (reemplaza a organizacion_lineas)
-- ---------------------------------------------------------------------
create table if not exists public.lineas (
  codigo         text primary key,
  operadora_id   text references public.organizaciones(id) on delete set null,  -- dato informativo
  observaciones  text
);
insert into public.lineas (codigo, operadora_id, observaciones) values
  ('501', 'tratado', 'Unidades color gris con celeste.'),
  ('503', 'tratado', 'Unidades Iveco blancas.'),
  ('506', 'monterrey', null),
  ('509', 'escondida', 'Unidades blancas con franjas verdes y rojas.'),
  ('510', 'pilarbus', 'Empresa del grupo Metropol.'),
  ('511', 'rutabus', null),
  ('520', 'central', 'Unidades azules con verde.')
on conflict (codigo) do update set operadora_id = excluded.operadora_id, observaciones = excluded.observaciones;

-- ---------------------------------------------------------------------
-- 3) SUSCRIPCIONES POR LÍNEA (RF-25)
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
-- Una sola suscripción activa por línea
create unique index if not exists suscripciones_una_activa on public.suscripciones (linea) where estado = 'activa';
create index if not exists suscripciones_org_idx on public.suscripciones (organizacion_id, estado);

-- Solo empresas pueden suscribirse; al activarse se registra cuándo
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
-- 4) CATÁLOGO DE LUGARES Y RAMALES (Registro de requerimiento N° 26)
-- ---------------------------------------------------------------------
create table if not exists public.lugares (
  id      int generated always as identity primary key,
  nombre  text not null unique,
  tipo    text not null check (tipo in ('localidad', 'barrio', 'zona', 'establecimiento'))
);
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

create table if not exists public.ramales (
  id           int generated always as identity primary key,
  linea        text not null references public.lineas(codigo) on update cascade on delete cascade,
  codigo       text,                       -- solo donde las fuentes numeran (R1, R2…)
  lugar_a_id   int not null references public.lugares(id),
  lugar_b_id   int not null references public.lugares(id),
  observacion  text,
  activo       boolean not null default true,
  check (lugar_a_id <> lugar_b_id)
);
create unique index if not exists ramales_unico on public.ramales (linea, lugar_a_id, lugar_b_id, coalesce(codigo, ''));
create index if not exists ramales_linea_idx on public.ramales (linea);

create table if not exists public.ramal_paso (
  ramal_id  int not null references public.ramales(id) on delete cascade,
  orden     smallint not null,
  lugar_id  int not null references public.lugares(id),
  primary key (ramal_id, orden)
);
create index if not exists ramal_paso_lugar_idx on public.ramal_paso (lugar_id);

create or replace function public._lugar(p_nombre text) returns int language sql stable as $$
  select id from public.lugares where nombre = p_nombre;
$$;

do $$
declare v int;
begin
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('501', null, public._lugar('Villa Rosa'), public._lugar('Villa Astolfi'), 'Sale de Barrio Luchetti (Villa Rosa).')
  on conflict do nothing returning id into v;
  if v is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v, 1, public._lugar('Pilar')) on conflict do nothing;
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('501', null, public._lugar('Pilar'), public._lugar('San Alejo'), null)
  on conflict do nothing returning id into v;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('501', null, public._lugar('Pilar'), public._lugar('Villa Rosa'), null)
  on conflict do nothing returning id into v;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('503', null, public._lugar('Pilar'), public._lugar('Fábrica Militar'), null)
  on conflict do nothing returning id into v;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('503', null, public._lugar('Pilar'), public._lugar('Manzone'), 'También tiene servicio nocturno.')
  on conflict do nothing returning id into v;
  if v is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v, 1, public._lugar('Pilarica')) on conflict do nothing;
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('503', null, public._lugar('Pilar'), public._lugar('San Alejo'), null)
  on conflict do nothing returning id into v;
  if v is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v, 1, public._lugar('Pilarica')) on conflict do nothing;
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v, 2, public._lugar('Manzone')) on conflict do nothing;
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('503', null, public._lugar('San Alejo'), public._lugar('Manzone'), null)
  on conflict do nothing returning id into v;
  if v is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v, 1, public._lugar('Hospital Central de Pilar')) on conflict do nothing;
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v, 2, public._lugar('Pilar')) on conflict do nothing;
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v, 3, public._lugar('Pilarica')) on conflict do nothing;
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('506', null, public._lugar('Derqui'), public._lugar('Barrio Toro'), 'Circuito: sale y vuelve a la estación Derqui.')
  on conflict do nothing returning id into v;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('506', null, public._lugar('Derqui'), public._lugar('Barrio Monterrey'), 'Circuito por Rivera Villate.')
  on conflict do nothing returning id into v;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('509', 'R1', public._lugar('Derqui'), public._lugar('Barrio San Souci'), null)
  on conflict do nothing returning id into v;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('509', 'R2', public._lugar('Derqui'), public._lugar('Barrio La Escondida'), null)
  on conflict do nothing returning id into v;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('509', 'R3', public._lugar('Derqui'), public._lugar('Barrio El Triángulo'), null)
  on conflict do nothing returning id into v;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('510', 'R1', public._lugar('Pilar'), public._lugar('Parque Industrial'), 'Por Ruta 8.')
  on conflict do nothing returning id into v;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('510', 'R2', public._lugar('Pilar'), public._lugar('Parque Industrial'), 'Por Petrel.')
  on conflict do nothing returning id into v;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('510', 'R3', public._lugar('Pilar'), public._lugar('Km 61'), null)
  on conflict do nothing returning id into v;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('510', 'R4', public._lugar('Pilar'), public._lugar('Manuel Alberti'), null)
  on conflict do nothing returning id into v;
  if v is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v, 1, public._lugar('Puente Garín')) on conflict do nothing;
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v, 2, public._lugar('Barrio Carumbé')) on conflict do nothing;
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('510', 'R5', public._lugar('Pilar'), public._lugar('Del Viso'), null)
  on conflict do nothing returning id into v;
  if v is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v, 1, public._lugar('Manuel Alberti')) on conflict do nothing;
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('510', 'R6', public._lugar('Villa Astolfi'), public._lugar('Parque Industrial'), null)
  on conflict do nothing returning id into v;
  if v is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v, 1, public._lugar('Barrio Salas')) on conflict do nothing;
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v, 2, public._lugar('Pilar')) on conflict do nothing;
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('510', 'R7', public._lugar('Km 61'), public._lugar('Fátima'), null)
  on conflict do nothing returning id into v;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('510', 'R9', public._lugar('Pilar'), public._lugar('Manuel Alberti'), null)
  on conflict do nothing returning id into v;
  if v is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v, 1, public._lugar('Villa Rosa')) on conflict do nothing;
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('511', null, public._lugar('Pilar'), public._lugar('Manzanares'), 'Solo días hábiles.')
  on conflict do nothing returning id into v;
  if v is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v, 1, public._lugar('Puente Fátima')) on conflict do nothing;
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('511', null, public._lugar('Pilar'), public._lugar('Carabassa'), 'Termina en Country El Recuerdo.')
  on conflict do nothing returning id into v;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('511', null, public._lugar('Pilar'), public._lugar('La Lomita'), 'Según la variante, por Universidad del Salvador o por Agustoni.')
  on conflict do nothing returning id into v;
  if v is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v, 1, public._lugar('Universidad del Salvador')) on conflict do nothing;
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v, 2, public._lugar('Agustoni')) on conflict do nothing;
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('511', null, public._lugar('La Lomita'), public._lugar('Golfers'), 'Algunas variantes pasan por Agustoni.')
  on conflict do nothing returning id into v;
  if v is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v, 1, public._lugar('Agustoni')) on conflict do nothing;
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('511', null, public._lugar('Pilar'), public._lugar('Pilarica'), null)
  on conflict do nothing returning id into v;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('520', 'R1', public._lugar('Pilar'), public._lugar('Derqui'), 'Por Ruta 8 y Av. Perón.')
  on conflict do nothing returning id into v;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('520', 'R2', public._lugar('Pilar'), public._lugar('Barrio Toro'), null)
  on conflict do nothing returning id into v;
  if v is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v, 1, public._lugar('Derqui')) on conflict do nothing;
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v, 2, public._lugar('Villa Luján')) on conflict do nothing;
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('520', 'R3', public._lugar('Derqui'), public._lugar('Zelaya'), null)
  on conflict do nothing returning id into v;
  if v is not null then
    insert into public.ramal_paso (ramal_id, orden, lugar_id) values (v, 1, public._lugar('Villa Rosa')) on conflict do nothing;
  end if;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('520', 'R4', public._lugar('Del Viso'), public._lugar('Altos del Pilar'), null)
  on conflict do nothing returning id into v;
  insert into public.ramales (linea, codigo, lugar_a_id, lugar_b_id, observacion)
  values ('520', 'R5', public._lugar('Del Viso'), public._lugar('Los Lagartos'), null)
  on conflict do nothing returning id into v;
end $$;

drop function public._lugar(text);

-- Opciones del campo Sentido: destinos de los ramales activos de cada línea, sin repetir
create or replace view public.sentidos_por_linea with (security_invoker = true) as
  select distinct r.linea, l.id as lugar_id, l.nombre
  from public.ramales r
  join public.lugares l on l.id in (r.lugar_a_id, r.lugar_b_id)
  where r.activo;

-- ---------------------------------------------------------------------
-- 5) PERMISOS BASADOS EN SUSCRIPCIONES (RF-18 y RF-25)
-- ---------------------------------------------------------------------
create or replace function public.mi_organizacion()
returns text language sql stable security definer set search_path = public as $$
  select organizacion_id from public.perfiles where id = auth.uid();
$$;

-- Líneas que gestiona el usuario: municipio, todas; empresa, las de sus suscripciones activas
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
-- 6) RECLAMOS: línea y sentido conectados con los catálogos
-- ---------------------------------------------------------------------
alter table public.reportes drop constraint if exists reportes_linea_check;
alter table public.reportes drop constraint if exists reportes_linea_fk;
alter table public.reportes add constraint reportes_linea_fk foreign key (linea) references public.lineas(codigo) on update cascade;

alter table public.reportes add column if not exists sentido_lugar_id int references public.lugares(id);
alter table public.reportes alter column sentido drop not null;   -- texto anterior: solo para reclamos viejos
alter table public.reportes drop constraint if exists reportes_sentido_requerido;
alter table public.reportes add constraint reportes_sentido_requerido check (sentido_lugar_id is not null) not valid;

-- El sentido elegido tiene que ser un destino de la línea del reclamo
create or replace function public.validar_sentido()
returns trigger language plpgsql as $$
begin
  if new.sentido_lugar_id is not null and not exists (
       select 1 from public.sentidos_por_linea s where s.linea = new.linea and s.lugar_id = new.sentido_lugar_id) then
    raise exception 'El sentido elegido no corresponde a la línea %', new.linea using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists reportes_validar_sentido on public.reportes;
create trigger reportes_validar_sentido before insert or update of linea, sentido_lugar_id on public.reportes
  for each row execute function public.validar_sentido();

-- Ticket correlativo por año: OB-2026-0001, OB-2026-0002…
create table if not exists public.tickets_contador (anio int primary key, ultimo int not null);
alter table public.tickets_contador enable row level security;   -- sin políticas: solo lo usa la función
create or replace function public.generar_ticket()
returns text language plpgsql volatile security definer set search_path = public as $$
declare v_anio int := extract(year from now()); v_n int; v_t text;
begin
  loop
    insert into public.tickets_contador (anio, ultimo) values (v_anio, 1)
      on conflict (anio) do update set ultimo = tickets_contador.ultimo + 1
      returning ultimo into v_n;
    v_t := 'OB-' || v_anio || '-' || lpad(v_n::text, 4, '0');
    exit when not exists (select 1 from public.reportes where ticket = v_t);  -- salta tickets viejos aleatorios
  end loop;
  return v_t;
end $$;

-- ---------------------------------------------------------------------
-- 7) VISTA DE GESTIÓN, CONTADORES Y POLÍTICAS OPTIMIZADAS
-- ---------------------------------------------------------------------
drop view if exists public.reportes_gestion;
create view public.reportes_gestion with (security_invoker = false) as
  select r.id, r.ticket, r.linea, r.interno_patente,
         coalesce(lg.nombre, r.sentido) as sentido, r.sentido_lugar_id,
         r.motivo, r.motivo_label, r.descripcion, r.fecha_hora_incidente, r.ubicacion_texto,
         r.latitud, r.longitud, r.foto_path, r.parada_id, r.estado, r.fecha_creacion,
         p.nombre as ciudadano_nombre, p.apellido as ciudadano_apellido,
         s.organizacion_id
  from public.reportes r
  join public.perfiles p on p.id = r.usuario_id
  left join public.lugares lg on lg.id = r.sentido_lugar_id
  left join public.suscripciones s on s.linea = r.linea and s.estado = 'activa'
  where r.linea in (select public.mis_lineas());
revoke all on public.reportes_gestion from anon;
grant select on public.reportes_gestion to authenticated;

-- Contadores de la bandeja en una sola consulta
create or replace function public.contar_bandeja()
returns table (estado text, cantidad bigint) language sql stable as $$
  select estado, count(*) from public.reportes_gestion group by estado;
$$;
revoke all on function public.contar_bandeja() from public, anon;
grant execute on function public.contar_bandeja() to authenticated;

-- Políticas: auth.uid() y las líneas se calculan una vez por consulta, no por fila
drop policy if exists "perfil propio: leer" on public.perfiles;
create policy "perfil propio: leer" on public.perfiles for select using ((select auth.uid()) = id);

drop policy if exists "reportes propios: leer" on public.reportes;
create policy "reportes propios: leer" on public.reportes for select using ((select auth.uid()) = usuario_id);
drop policy if exists "reportes propios: crear" on public.reportes;
create policy "reportes propios: crear" on public.reportes for insert
  with check ((select auth.uid()) = usuario_id and estado = 'Recibido' and (select public.mi_rol()) = 'ciudadano');
drop policy if exists "reportes: gestion leer" on public.reportes;
create policy "reportes: gestion leer" on public.reportes for select to authenticated
  using (linea in (select public.mis_lineas()));

drop policy if exists "fotos: subir propias" on storage.objects;
create policy "fotos: subir propias" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos-reportes' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "fotos: ver propias" on storage.objects;
create policy "fotos: ver propias" on storage.objects for select to authenticated
  using (bucket_id = 'fotos-reportes' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "fotos: ver gestion" on storage.objects;
create policy "fotos: ver gestion" on storage.objects for select to authenticated
  using (bucket_id = 'fotos-reportes' and exists (
    select 1 from public.reportes r where r.foto_path = storage.objects.name and r.linea in (select public.mis_lineas())));

-- Catálogos: los leen todos los usuarios conectados. Suscripciones: cada empresa, las suyas.
alter table public.lineas enable row level security;
alter table public.lugares enable row level security;
alter table public.ramales enable row level security;
alter table public.ramal_paso enable row level security;
alter table public.suscripciones enable row level security;
drop policy if exists "lineas: leer" on public.lineas;
create policy "lineas: leer" on public.lineas for select to authenticated using (true);
drop policy if exists "lugares: leer" on public.lugares;
create policy "lugares: leer" on public.lugares for select to authenticated using (true);
drop policy if exists "ramales: leer" on public.ramales;
create policy "ramales: leer" on public.ramales for select to authenticated using (true);
drop policy if exists "ramal_paso: leer" on public.ramal_paso;
create policy "ramal_paso: leer" on public.ramal_paso for select to authenticated using (true);
drop policy if exists "suscripciones: propias" on public.suscripciones;
create policy "suscripciones: propias" on public.suscripciones for select to authenticated
  using (organizacion_id = (select public.mi_organizacion()));

-- ---------------------------------------------------------------------
-- 8) ÍNDICES
-- ---------------------------------------------------------------------
create index if not exists reportes_linea_fecha_idx on public.reportes (linea, fecha_creacion desc);
create index if not exists reportes_estado_idx on public.reportes (estado);
create index if not exists reportes_parada_idx on public.reportes (parada_id);
create index if not exists reportes_sentido_idx on public.reportes (sentido_lugar_id);
create index if not exists reportes_foto_idx on public.reportes (foto_path) where foto_path is not null;
create index if not exists perfiles_organizacion_idx on public.perfiles (organizacion_id);

-- ---------------------------------------------------------------------
-- 9) LIMPIEZA: la asignación simulada ya no se usa
-- ---------------------------------------------------------------------
drop table if exists public.organizacion_lineas cascade;
delete from public.organizaciones where id in ('empA', 'empB');

commit;

-- ---------------------------------------------------------------------
-- ADMINISTRAR SUSCRIPCIONES (desde el SQL Editor o el editor de tablas)
--   Activar:     insert into suscripciones (linea, organizacion_id, estado) values ('501', 'tratado', 'activa');
--   Suspender:   update suscripciones set estado = 'suspendida' where linea = '501' and estado = 'activa';
--   Ver todas:   select * from suscripciones order by linea, creada_en;
-- Sin suscripción activa, los reclamos de la línea los gestiona solo el municipio.
-- ---------------------------------------------------------------------
