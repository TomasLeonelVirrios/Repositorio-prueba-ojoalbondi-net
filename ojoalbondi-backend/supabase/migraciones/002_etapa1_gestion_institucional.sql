-- =====================================================================
-- Migración 002 — Etapa 1: gestión institucional (Registro de cambio N° 9)
-- Implementa: RF-10, RF-11, RF-13, RF-14, RF-15, RF-18, RF-19, RNF-01, RN-02
-- Requiere haber corrido schema.sql y la migración 001.
-- Se puede volver a correr sin romper nada.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1) ORGANIZACIONES (empresas y municipio) y asignación de líneas (RF-18)
-- ---------------------------------------------------------------------
create table if not exists public.organizaciones (
  id      text primary key,
  nombre  text not null,
  tipo    text not null check (tipo in ('empresa', 'municipio'))
);

-- Datos de contacto: solo uso administrativo (Registro de requerimiento N° 24).
-- Sin políticas de lectura: ni la app ni el dashboard pueden leerlos.
create table if not exists public.organizaciones_contacto (
  organizacion_id text primary key references public.organizaciones(id) on delete cascade,
  razon_social    text,
  direccion       text,
  telefono        text
);

-- Qué empresa opera cada línea. Una línea pertenece a una sola empresa.
create table if not exists public.organizacion_lineas (
  linea           text primary key check (linea in ('501','503','506','509','510','511','520')),
  organizacion_id text not null references public.organizaciones(id) on delete cascade
);

alter table public.organizaciones          enable row level security;
alter table public.organizaciones_contacto enable row level security;
alter table public.organizacion_lineas     enable row level security;

drop policy if exists "organizaciones: leer" on public.organizaciones;
create policy "organizaciones: leer" on public.organizaciones for select to authenticated using (true);
drop policy if exists "organizacion_lineas: leer" on public.organizacion_lineas;
create policy "organizacion_lineas: leer" on public.organizacion_lineas for select to authenticated using (true);

-- DATOS SIMULADOS (decisión pendiente N° 2). Se reemplazan con el relevamiento de Dylan.
insert into public.organizaciones (id, nombre, tipo) values
  ('empA', 'Empresa de ejemplo A', 'empresa'),
  ('empB', 'Empresa de ejemplo B', 'empresa'),
  ('muni', 'Municipio de Pilar — Transporte', 'municipio')
on conflict (id) do nothing;
insert into public.organizacion_lineas (linea, organizacion_id) values
  ('501','empA'), ('503','empA'), ('506','empA'),
  ('509','empB'), ('510','empB'), ('511','empB'), ('520','empB')
on conflict (linea) do nothing;

-- ---------------------------------------------------------------------
-- 2) ROLES EN PERFILES (RN-02)
-- ---------------------------------------------------------------------
alter table public.perfiles add column if not exists organizacion_id text references public.organizaciones(id);
alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check check (rol in ('ciudadano', 'empresa', 'municipio', 'admin'));
alter table public.perfiles drop constraint if exists perfiles_organizacion_segun_rol;
alter table public.perfiles add constraint perfiles_organizacion_segun_rol
  check ((rol in ('empresa', 'municipio')) = (organizacion_id is not null));

-- El registro público siempre crea ciudadanos: el trigger de schema.sql ignora cualquier
-- rol enviado desde la app. Además, nadie puede cambiar su propio rol ni su organización:
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
-- 3) FUNCIONES DE PERMISO (RNF-01)
-- ---------------------------------------------------------------------
create or replace function public.mi_rol()
returns text language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid();
$$;

-- ¿El usuario actual gestiona reclamos de esta línea? Municipio: todas. Empresa: las suyas.
create or replace function public.puede_gestionar(p_linea text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = auth.uid()
      and (p.rol = 'municipio'
           or (p.rol = 'empresa' and exists (
                 select 1 from public.organizacion_lineas ol
                 where ol.linea = p_linea and ol.organizacion_id = p.organizacion_id)))
  );
$$;

-- ---------------------------------------------------------------------
-- 4) RECLAMOS: lectura institucional y creación solo por ciudadanos
-- ---------------------------------------------------------------------
drop policy if exists "reportes: gestion leer" on public.reportes;
create policy "reportes: gestion leer" on public.reportes
  for select to authenticated using (public.puede_gestionar(linea));

drop policy if exists "reportes propios: crear" on public.reportes;
create policy "reportes propios: crear" on public.reportes
  for insert with check (auth.uid() = usuario_id and estado = 'Recibido' and public.mi_rol() = 'ciudadano');
-- No hay políticas de UPDATE ni DELETE: el estado solo cambia con cambiar_estado() (RF-14).

-- Vista para la institución: datos del reclamo + solo nombre y apellido del ciudadano (RF-13, RNF-03).
-- No expone correo, fecha de nacimiento ni el id del usuario.
drop view if exists public.reportes_gestion;
create view public.reportes_gestion with (security_invoker = false) as
  select r.id, r.ticket, r.linea, r.interno_patente, r.sentido, r.motivo, r.motivo_label, r.descripcion,
         r.fecha_hora_incidente, r.ubicacion_texto, r.latitud, r.longitud, r.foto_path, r.parada_id,
         r.estado, r.fecha_creacion,
         p.nombre as ciudadano_nombre, p.apellido as ciudadano_apellido,
         ol.organizacion_id
  from public.reportes r
  join public.perfiles p on p.id = r.usuario_id
  left join public.organizacion_lineas ol on ol.linea = r.linea
  where public.puede_gestionar(r.linea);
revoke all on public.reportes_gestion from anon;
grant select on public.reportes_gestion to authenticated;

-- La institución puede ver la foto de los reclamos que gestiona (RF-13)
drop policy if exists "fotos: ver gestion" on storage.objects;
create policy "fotos: ver gestion" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos-reportes' and exists (
    select 1 from public.reportes r where r.foto_path = storage.objects.name and public.puede_gestionar(r.linea)));

-- ---------------------------------------------------------------------
-- 5) HISTORIAL DE ESTADOS (RF-15) — inmutable (RF-19)
-- ---------------------------------------------------------------------
create table if not exists public.historial_estados (
  id               bigint generated always as identity primary key,
  reporte_id       uuid not null references public.reportes(id) on delete cascade,
  estado_anterior  text,
  estado_nuevo     text not null,
  comentario       text,
  actor_id         uuid references auth.users(id) on delete set null,
  actor_nombre     text not null,               -- 'Sistema', 'Ciudadano' o el nombre de la organización
  creado_en        timestamptz not null default now()
);
create index if not exists historial_reporte_idx on public.historial_estados (reporte_id, creado_en);

alter table public.historial_estados enable row level security;
-- Se ve si se ve el reclamo (el dueño o la institución que lo gestiona). Nadie inserta, edita ni borra directo.
drop policy if exists "historial: leer" on public.historial_estados;
create policy "historial: leer" on public.historial_estados
  for select to authenticated
  using (exists (select 1 from public.reportes r where r.id = historial_estados.reporte_id));

create or replace function public.historial_inmutable()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'El historial de estados no se puede modificar' using errcode = '42501';
  end if;
  if current_user in ('authenticated', 'anon') then
    raise exception 'El historial de estados no se puede borrar' using errcode = '42501';
  end if;
  return old;  -- solo se borra en cascada cuando se elimina el reclamo (administración)
end $$;
drop trigger if exists historial_inmutable on public.historial_estados;
create trigger historial_inmutable before update or delete on public.historial_estados
  for each row execute function public.historial_inmutable();

-- Todo reclamo nuevo arranca con la entrada "Recibido" registrada por el Sistema
create or replace function public.registrar_recibido()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.historial_estados (reporte_id, estado_anterior, estado_nuevo, actor_nombre, creado_en)
  values (new.id, null, 'Recibido', 'Sistema', new.fecha_creacion);
  return new;
end $$;
drop trigger if exists reportes_registrar_recibido on public.reportes;
create trigger reportes_registrar_recibido after insert on public.reportes
  for each row execute function public.registrar_recibido();

-- Reclamos que ya existían: les falta su entrada inicial
insert into public.historial_estados (reporte_id, estado_anterior, estado_nuevo, actor_nombre, creado_en)
select r.id, null, 'Recibido', 'Sistema', r.fecha_creacion
from public.reportes r
where not exists (select 1 from public.historial_estados h where h.reporte_id = r.id);

-- ---------------------------------------------------------------------
-- 6) CAMBIO DE ESTADO (RF-14) — única forma de cambiarlo, valida el flujo en la base
-- ---------------------------------------------------------------------
create or replace function public.cambiar_estado(p_reporte uuid, p_nuevo text, p_comentario text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_rep  public.reportes%rowtype;
  v_org  text;
  v_com  text := nullif(trim(coalesce(p_comentario, '')), '');
begin
  select * into v_rep from public.reportes where id = p_reporte for update;
  if not found then
    raise exception 'El reclamo no existe' using errcode = 'P0002';
  end if;
  if not public.puede_gestionar(v_rep.linea) then
    raise exception 'No tenés permiso para gestionar este reclamo' using errcode = '42501';
  end if;
  if not ((v_rep.estado = 'Recibido'    and p_nuevo in ('En revisión', 'Anulado')) or
          (v_rep.estado = 'En revisión' and p_nuevo in ('Atendido', 'Anulado'))) then
    raise exception 'Cambio de estado no permitido: % → %', v_rep.estado, p_nuevo using errcode = '22023';
  end if;
  if p_nuevo = 'Anulado' and v_com is null then
    raise exception 'El motivo de anulación es obligatorio.' using errcode = '22023';
  end if;

  select o.nombre into v_org
  from public.perfiles p join public.organizaciones o on o.id = p.organizacion_id
  where p.id = auth.uid();

  update public.reportes set estado = p_nuevo where id = p_reporte;
  insert into public.historial_estados (reporte_id, estado_anterior, estado_nuevo, comentario, actor_id, actor_nombre)
  values (p_reporte, v_rep.estado, p_nuevo, v_com, auth.uid(), coalesce(v_org, 'Institución'));
end $$;
revoke all on function public.cambiar_estado(uuid, text, text) from public, anon;
grant execute on function public.cambiar_estado(uuid, text, text) to authenticated;

commit;

-- ---------------------------------------------------------------------
-- CUENTAS INSTITUCIONALES (RN-02) — las crea el Administrador:
-- 1) Supabase > Authentication > Add user (correo y contraseña).
-- 2) Asignarle rol y organización (desde el SQL Editor, que corre como administrador):
--    update public.perfiles set rol = 'empresa', organizacion_id = 'empA' where id = '<uuid del usuario>';
--    update public.perfiles set rol = 'municipio', organizacion_id = 'muni' where id = '<uuid del usuario>';
-- O usar scripts/datos-prueba.mjs, que crea cuentas de prueba de cada tipo.
-- ---------------------------------------------------------------------
