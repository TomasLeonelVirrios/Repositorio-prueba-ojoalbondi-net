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
