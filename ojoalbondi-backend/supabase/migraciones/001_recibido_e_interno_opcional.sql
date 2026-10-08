-- =====================================================================
-- Migración 001 — Registro de cambio N° 8
-- Solo para bases que ya tenían el esquema anterior (con el estado "Publicado").
-- En una base nueva alcanza con correr schema.sql, que ya incluye estos cambios.
-- Se puede correr más de una vez sin romper nada.
-- =====================================================================
begin;

-- 1) "Publicado" pasa a llamarse "Recibido" (Registro de requerimiento N° 11)
alter table public.reportes drop constraint if exists reportes_estado_check;
update public.reportes set estado = 'Recibido' where estado = 'Publicado';
alter table public.reportes alter column estado set default 'Recibido';
alter table public.reportes add constraint reportes_estado_check
  check (estado in ('Recibido', 'En revisión', 'Atendido', 'Anulado'));

drop policy if exists "reportes propios: crear" on public.reportes;
create policy "reportes propios: crear" on public.reportes
  for insert with check (auth.uid() = usuario_id and estado = 'Recibido');

-- 2) Interno o patente obligatorio salvo con motivo robo (Registro de requerimiento N° 8)
alter table public.reportes alter column interno_patente drop not null;
alter table public.reportes drop constraint if exists reportes_interno_obligatorio;
alter table public.reportes add constraint reportes_interno_obligatorio
  check (motivo = 'robo' or nullif(trim(interno_patente), '') is not null);

commit;

-- Verificación: debería devolver 0
-- select count(*) from public.reportes where estado = 'Publicado';
