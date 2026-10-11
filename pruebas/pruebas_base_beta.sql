-- =====================================================================
-- OjoAlBondi · Pruebas de base de datos del Plan de pruebas (casos tipo "Base de datos")
-- Correr en el SQL Editor del proyecto BETA (o en desarrollo, con los datos de prueba cargados).
-- Cada caso se ejecuta en nombre de la cuenta que dice el plan (rol authenticated + su id),
-- dentro de una subtransacción que se deshace: NO modifica ningún dato (ni el contador de tickets).
-- Al final hace ROLLBACK de todo. Comparar la columna "resultado" con "esperado".
-- Primera corrida: 11/10/2026 sobre la beta, todos los casos dieron lo esperado.
-- =====================================================================
begin;

create function pg_temp.probar(p_setup text, p_role text, p_uid uuid, p_sql text) returns text language plpgsql as $f$
declare v text; n bigint; res text;
begin
  begin
    if p_setup is not null then execute p_setup; end if;          -- preparación como administrador
    if p_role is not null then                                      -- después, en nombre de la cuenta
      perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_role)::text, true);
      execute format('set local role %I', p_role);
    end if;
    if p_sql ~* '^\s*(select|with)' or p_sql ~* 'returning' then execute p_sql into v; else execute p_sql; end if;
    get diagnostics n = row_count;
    res := 'OK · filas: ' || n || coalesce(' · valor: ' || v, '');
    raise exception using errcode = 'P0099', message = 'deshacer';
  exception
    when sqlstate 'P0099' then return res;
    when others then return 'ERROR: ' || sqlerrm;
  end;
end $f$;

create temp table ids as select
 (select id from auth.users where email = 'vecino1@prueba.ojoalbondi')   v1,
 (select id from auth.users where email = 'vecino2@prueba.ojoalbondi')   v2,
 (select id from auth.users where email = 'tratado@prueba.ojoalbondi')   tr,
 (select id from auth.users where email = 'pilarbus@prueba.ojoalbondi')  pb,
 (select id from auth.users where email = 'rutabus@prueba.ojoalbondi')   rb,
 (select id from auth.users where email = 'municipio@prueba.ojoalbondi') mu,
 (select id from auth.users where email = 'admin@prueba.ojoalbondi')     ad,
 (select id from reclamos where linea = '501' and estado = 'Recibido' limit 1)    rec501,
 (select id from reclamos where linea = '501' and estado = 'En revisión' limit 1) rev501,
 (select id from reclamos where linea = '501' and estado = 'Atendido' limit 1)    ate501,
 (select lugar_id from sentidos_por_linea where linea = '501' limit 1)            lug501;

select caso, esperado, resultado from ids, lateral (values
 ('CA-RN02-1 alta que pide rol admin en los metadatos', 'valor: ciudadano',
   pg_temp.probar($$insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'rn02@prueba-temporal.test', '{"nombre":"A","apellido":"B","fecha_nacimiento":"2000-01-01","rol":"admin"}')$$,
     null, null, $$select rol from perfiles where id = '11111111-1111-1111-1111-111111111111'$$)),
 ('CA-RF14-5 tratado: Recibido → Atendido', 'ERROR: Cambio de estado no permitido',
   pg_temp.probar(null, 'authenticated', tr, format($$select cambiar_estado(%L, 'Atendido', 'x')::text$$, rec501))),
 ('CA-RF14-5 vecino1 intenta cambiar un estado', 'ERROR: No tenés permiso',
   pg_temp.probar(null, 'authenticated', v1, format($$select cambiar_estado(%L, 'En revisión', 'x')::text$$, rec501))),
 ('(apoyo CA-RF14-1) Recibido → En revisión', 'OK',
   pg_temp.probar(null, 'authenticated', tr, format($$select cambiar_estado(%L, 'En revisión', 'x')::text$$, rec501))),
 ('(apoyo CA-RF14-2) En revisión → Recibido', 'ERROR: Cambio de estado no permitido',
   pg_temp.probar(null, 'authenticated', tr, format($$select cambiar_estado(%L, 'Recibido', 'x')::text$$, rev501))),
 ('(apoyo CA-RF14-2) En revisión → Atendido', 'OK',
   pg_temp.probar(null, 'authenticated', tr, format($$select cambiar_estado(%L, 'Atendido', 'ok')::text$$, rev501))),
 ('(apoyo CA-RF14-3) Atendido → Anulado', 'ERROR: Cambio de estado no permitido',
   pg_temp.probar(null, 'authenticated', tr, format($$select cambiar_estado(%L, 'Anulado', 'x')::text$$, ate501))),
 ('(apoyo CA-RF14-4) anular sin motivo', 'ERROR: El motivo de anulación es obligatorio.',
   pg_temp.probar(null, 'authenticated', tr, format($$select cambiar_estado(%L, 'Anulado', '')::text$$, rec501))),
 ('CA-RF25-3 antes: rutabus ve la 511 (suscripción pendiente)', 'valor: 0',
   pg_temp.probar(null, 'authenticated', rb, $$select count(*)::text from reclamos_gestion where linea = '511'$$)),
 ('CA-RF25-3 se activa la 511 → rutabus ve también los viejos', 'valor: 10 (más viejo: …)',
   pg_temp.probar($$update suscripciones set estado = 'activa' where linea = '511'$$, 'authenticated', rb,
     $$select count(*) || ' (más viejo: ' || min(creado_en)::date || ')' from reclamos_gestion where linea = '511'$$)),
 ('CA-RF25-4 segunda suscripción activa para la 501', 'ERROR: … suscripciones_una_activa',
   pg_temp.probar(null, null, null, $$insert into suscripciones (linea, organizacion_id, estado) values ('501', 'pilarbus', 'activa')$$)),
 ('CA-RF25-5 se suspende la 503 → tratado ve la 503', 'valor: 0',
   pg_temp.probar($$update suscripciones set estado = 'suspendida' where linea = '503' and estado = 'activa'$$, 'authenticated', tr,
     $$select count(*)::text from reclamos_gestion where linea = '503'$$)),
 ('CA-RF25-5 se suspende la 503 → municipio ve la 503', 'valor: 5',
   pg_temp.probar($$update suscripciones set estado = 'suspendida' where linea = '503' and estado = 'activa'$$, 'authenticated', mu,
     $$select count(*)::text from reclamos_gestion where linea = '503'$$)),
 ('CA-RF25-5 se suspende la 503 → reclamos e historial se conservan', 'valor: 5 reclamos / 8 historial',
   pg_temp.probar($$update suscripciones set estado = 'suspendida' where linea = '503' and estado = 'activa'$$, null, null,
     $$select (select count(*) from reclamos where linea = '503') || ' reclamos / ' || (select count(*) from historial_estados h join reclamos r on r.id = h.reclamo_id where r.linea = '503') || ' historial'$$)),
 ('CA-RF19-1 tratado edita el historial', 'ERROR: permission denied',
   pg_temp.probar(null, 'authenticated', tr, $$update historial_estados set comentario = 'x'$$)),
 ('CA-RF19-1 tratado borra el historial', 'ERROR: permission denied',
   pg_temp.probar(null, 'authenticated', tr, $$delete from historial_estados$$)),
 ('CA-RF19-1 administrador edita el historial', 'ERROR: El historial de estados no se puede modificar',
   pg_temp.probar(null, null, null, $$update historial_estados set comentario = 'x'$$)),
 ('CA-RNF01-1 vecino1 lee reclamos ajenos', 'valor: 0',
   pg_temp.probar(null, 'authenticated', v1, $$select count(*)::text from reclamos where ciudadano_id <> auth.uid()$$)),
 ('CA-RNF01-2 tratado lee la 510', 'valor: 0',
   pg_temp.probar(null, 'authenticated', tr, $$select count(*)::text from reclamos_gestion where linea = '510'$$)),
 ('CA-RNF01-2 tratado lee la 511 y la 520', 'valor: 0',
   pg_temp.probar(null, 'authenticated', tr, $$select count(*)::text from reclamos_gestion where linea in ('511', '520')$$)),
 ('CA-RNF01-2 pilarbus lee la 501/503', 'valor: 0',
   pg_temp.probar(null, 'authenticated', pb, $$select count(*)::text from reclamos_gestion where linea like '50%'$$)),
 ('CA-RN02-2 vecino1 se cambia el rol', 'OK · filas: 0',
   pg_temp.probar(null, 'authenticated', v1, $$update perfiles set rol = 'municipio' where id = auth.uid()$$)),
 ('CA-RNF01-3 insert con ticket y creado_en', 'ERROR: permission denied for table reclamos',
   pg_temp.probar(null, 'authenticated', v1, format($$insert into reclamos (linea, sentido_lugar_id, motivo, interno_patente, fecha_hora_hecho, ubicacion_texto, ticket, creado_en) values ('501', %s, 'demora', '123', now() at time zone 'America/Argentina/Buenos_Aires' - interval '1 hour', 'Prueba', 'URGENTE', '2020-01-01') returning ticket$$, lug501))),
 ('CA-RNF01-3 insert sin esas columnas', 'valor: OB-AAAA-NNNN · fecha de hoy',
   pg_temp.probar(null, 'authenticated', v1, format($$insert into reclamos (linea, sentido_lugar_id, motivo, interno_patente, fecha_hora_hecho, ubicacion_texto) values ('501', %s, 'demora', '123', now() at time zone 'America/Argentina/Buenos_Aires' - interval '1 hour', 'Prueba') returning ticket || ' · ' || creado_en::date$$, lug501))),
 ('(apoyo CA-RF15-2) historial de un reclamo nuevo', 'valor: 1 · Recibido · Sistema',
   pg_temp.probar(format($$insert into reclamos (id, ciudadano_id, linea, sentido_lugar_id, motivo, interno_patente, fecha_hora_hecho, ubicacion_texto) values ('22222222-2222-2222-2222-222222222222', %L, '501', %s, 'demora', '123', now() at time zone 'America/Argentina/Buenos_Aires' - interval '1 hour', 'Prueba')$$, v1, lug501), null, null,
     $$select count(*) || ' · ' || string_agg(estado_nuevo || ' · ' || responsable_nombre, '; ') from historial_estados where reclamo_id = '22222222-2222-2222-2222-222222222222'$$)),
 ('CA-RNF01-4 vecino1 llama a generar_ticket', 'ERROR: generar_ticket() solo se usa desde el trigger',
   pg_temp.probar(null, 'authenticated', v1, $$select generar_ticket(2026)$$)),
 ('CA-RNF01-4 sin sesión llama a generar_ticket', 'ERROR: permission denied for function',
   pg_temp.probar(null, 'anon', null, $$select generar_ticket(2026)$$)),
 ('CA-RNF01-5 tratado lee la tabla reclamos', 'valor: 0',
   pg_temp.probar(null, 'authenticated', tr, $$select count(*)::text from reclamos$$)),
 ('CA-RNF01-5 tratado lee reclamos_gestion', 'valor: 27 (501 + 501-503 + 503)',
   pg_temp.probar(null, 'authenticated', tr, $$select count(*)::text from reclamos_gestion$$)),
 ('CA-RNF01-5 tratado ve el historial de sus reclamos', 'valor: más de 0',
   pg_temp.probar(null, 'authenticated', tr, $$select count(*)::text from historial_estados$$)),
 ('CA-RNF01-6 fecha del hecho futura', 'ERROR: La fecha y hora del hecho no puede ser futura',
   pg_temp.probar(null, 'authenticated', v1, format($$insert into reclamos (linea, sentido_lugar_id, motivo, interno_patente, fecha_hora_hecho, ubicacion_texto) values ('501', %s, 'demora', '1', '2030-01-01 10:00', 'Prueba')$$, lug501))),
 ('CA-RNF01-6 foto de la carpeta de otro', 'ERROR: La foto no pertenece a tu cuenta',
   pg_temp.probar(null, 'authenticated', v1, format($$insert into reclamos (linea, sentido_lugar_id, motivo, interno_patente, fecha_hora_hecho, ubicacion_texto, foto_ruta) values ('501', %s, 'demora', '1', now() at time zone 'America/Argentina/Buenos_Aires' - interval '1 hour', 'Prueba', %L)$$, lug501, v2 || '/x.jpg'))),
 ('CA-RF26-3 admin: rol municipio con organización empresa', 'ERROR: La organización elegida no corresponde al rol municipio',
   pg_temp.probar(null, 'authenticated', ad, format($$select admin_asignar_rol(%L, 'municipio', 'tratado')::text$$, v1))),
 ('CA-RF26-3 una empresa usa admin_asignar_rol', 'ERROR: Solo el administrador puede cambiar roles',
   pg_temp.probar(null, 'authenticated', tr, format($$select admin_asignar_rol(%L, 'admin', null)::text$$, v1))),
 ('CA-RF01-6 alta sin fecha de nacimiento', 'ERROR: Registro: falta la fecha de nacimiento o no es válida',
   pg_temp.probar(null, null, null, $$insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'rf01@prueba-temporal.test', '{"nombre":"A","apellido":"B"}')$$)),
 ('CA-RF01-6 alta con fecha de nacimiento futura', 'ERROR: Registro: falta la fecha de nacimiento o no es válida',
   pg_temp.probar(null, null, null, $$insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'rf01@prueba-temporal.test', '{"nombre":"A","apellido":"B","fecha_nacimiento":"2099-01-01"}')$$)),
 ('(apoyo CA-RNF01-7) configuración del bucket de fotos', 'valor: false / 5242880 / image/jpeg',
   pg_temp.probar(null, null, null, $$select public || ' / ' || file_size_limit || ' / ' || array_to_string(allowed_mime_types, ',') from storage.buckets where id = 'fotos-reclamos'$$))
) t(caso, esperado, resultado);

rollback;
