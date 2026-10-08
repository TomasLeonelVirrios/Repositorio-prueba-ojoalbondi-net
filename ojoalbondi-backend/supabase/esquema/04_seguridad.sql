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
