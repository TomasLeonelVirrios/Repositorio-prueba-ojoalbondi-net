-- =====================================================================
-- Migración 009 — Límite al bucket de fotos de los reclamos
-- Para bases con la migración 008. Una base nueva ya lo incluye en instalacion_completa.sql.
-- Antes, cualquier usuario conectado podía subir archivos de cualquier tipo y tamaño a su carpeta.
-- Ahora el bucket acepta solo image/jpeg de hasta 5 MB (es lo que sube la app).
-- Se puede volver a correr sin romper nada.
-- =====================================================================
begin;

update storage.buckets
   set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg']
 where id = 'fotos-reclamos';

commit;
