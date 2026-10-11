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
