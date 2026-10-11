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
