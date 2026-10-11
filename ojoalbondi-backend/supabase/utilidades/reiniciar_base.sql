-- =====================================================================
-- OjoAlBondi · REINICIAR BASE
-- ⚠️ BORRA todas las tablas, datos, funciones y políticas del proyecto. Irreversible.
-- No borra usuarios (Authentication > Users) ni fotos (Storage).
-- Después: correr supabase/instalacion_completa.sql.
-- =====================================================================
begin;
drop view if exists public.reclamos_gestion, public.sentidos_por_linea, public.reportes_gestion;
drop trigger if exists al_crear_usuario on auth.users;
drop trigger if exists on_auth_user_created on auth.users;

drop table if exists
  public.historial_estados, public.reclamos, public.reportes, public.tickets_contador, public.suscripciones,
  public.ramal_paso, public.ramales, public.lugares, public.motivos, public.lineas, public.paradas,
  public.organizacion_lineas, public.perfiles, public.organizaciones_contacto, public.organizaciones
cascade;

drop function if exists
  public.crear_perfil_al_registrarse(), public.crear_perfil_nuevo_usuario(), public.proteger_rol(),
  public.mi_rol(), public.mi_organizacion(), public.mis_lineas(), public.puede_gestionar(text),
  public.validar_suscripcion(), public.generar_ticket(), public.asignar_ticket(), public.validar_sentido(),
  public.registrar_estado_inicial(), public.registrar_recibido(), public.historial_inmutable(),
  public.cambiar_estado(uuid, text, text), public.contar_bandeja()
cascade;

drop policy if exists "fotos: el ciudadano sube las suyas" on storage.objects;
drop policy if exists "fotos: el ciudadano ve las suyas" on storage.objects;
drop policy if exists "fotos: la institución ve las de sus líneas" on storage.objects;
drop policy if exists "fotos: subir propias" on storage.objects;
drop policy if exists "fotos: ver propias" on storage.objects;
drop policy if exists "fotos: ver gestion" on storage.objects;
commit;
