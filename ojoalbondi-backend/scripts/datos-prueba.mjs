// =====================================================================
// OjoAlBondi · Datos de prueba
// Crea cuentas de prueba de cada rol, suscripciones de prueba y ~100 reclamos con historial.
// Todo usa el dominio @prueba.ojoalbondi, así se identifica y se borra fácil.
//
// Uso (desde ojoalbondi-backend, con Node 18+):
//   npm install
//   PowerShell:  $env:SUPABASE_URL="https://xxx.supabase.co"; $env:SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
//   npm run datos-prueba            (cargar)
//   npm run datos-prueba:borrar     (borrar todo lo cargado)
//
// La clave secreta (service role) saltea todos los permisos: nunca va en la app, en archivos ni en git.
// Requiere la base instalada (instalacion_completa.sql o migraciones hasta la 004). Conviene cargar antes las paradas.
// =====================================================================
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const CLAVE_SECRETA = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !CLAVE_SECRETA) {
  console.error('Faltan las variables SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const supabase = createClient(URL, CLAVE_SECRETA, { auth: { persistSession: false, autoRefreshToken: false } });

const DOMINIO = '@prueba.ojoalbondi';
const CONTRASENA = 'Prueba123!';
const MARCA_SUSCRIPCION = 'Suscripción de prueba (datos-prueba.mjs)';
const CANTIDAD_RECLAMOS = 100;

// Suscripciones de prueba: la 503 queda sin suscripción a propósito (sus reclamos los ve solo el municipio, RF-25)
const SUSCRIPCIONES = [
  { linea: '501', organizacion: 'tratado' },
  { linea: '510', organizacion: 'pilarbus' },
];
const OPERADORES = [
  { correo: `tratado${DOMINIO}`, apellido: 'Tratado del Pilar', rol: 'empresa', organizacion: 'tratado' },
  { correo: `pilarbus${DOMINIO}`, apellido: 'Pilar Bus', rol: 'empresa', organizacion: 'pilarbus' },
  { correo: `municipio${DOMINIO}`, apellido: 'Municipal', rol: 'municipio', organizacion: 'muni' },
  { correo: `admin${DOMINIO}`, apellido: 'Administración', rol: 'admin', organizacion: null },
];
const VECINOS = [['Lucía', 'Gómez'], ['Martín', 'Sosa'], ['Carla', 'Díaz'], ['Jorge', 'Paz'],
                 ['Ana', 'Ríos'], ['Diego', 'Luna'], ['Sofía', 'Vera'], ['Pablo', 'Ruiz']];
// Peso relativo de cada motivo en los reclamos generados
const PESO_MOTIVO = { no_freno: 4, demora: 3, exceso: 2, conductor: 2, mal_estado: 1, ventilacion: 1, pago: 1, robo: 1 };
const COMENTARIOS = {
  'En revisión': ['Recibimos el reclamo y lo derivamos al área correspondiente.', 'Estamos revisando el recorrido y los horarios de esa franja.'],
  'Atendido': ['Se habló con el conductor y se reforzó la capacitación.', 'Se reforzó la frecuencia en la franja informada.', 'La unidad fue enviada a mantenimiento.'],
  'Anulado': ['Reclamo duplicado de otro ya registrado.', 'Datos insuficientes para identificar el servicio.'],
};
const PASOS_HASTA = { 'Recibido': [], 'En revisión': ['En revisión'], 'Atendido': ['En revisión', 'Atendido'], 'Anulado': ['Anulado'] };

// ---------------- utilidades ----------------
const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];
const elegirConPeso = (pesos) => {
  const total = Object.values(pesos).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [clave, peso] of Object.entries(pesos)) if ((r -= peso) < 0) return clave;
  return Object.keys(pesos)[0];
};
const dosDigitos = (n) => String(n).padStart(2, '0');
const fechaLocal = (d) => `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}T${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
const falla = (contexto, error) => { throw new Error(`${contexto}: ${error.message}`); };

async function usuariosDePrueba() {
  const encontrados = [];
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) falla('Listar usuarios', error);
    encontrados.push(...data.users.filter((u) => u.email?.endsWith(DOMINIO)));
    if (data.users.length < 200) return encontrados;
  }
}

async function crearCuenta({ correo, nombre = 'Operador', apellido, rol = 'ciudadano', organizacion = null }) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: correo, password: CONTRASENA, email_confirm: true,
    user_metadata: { nombre, apellido, fecha_nacimiento: '1990-05-10' },
  });
  if (error) falla(correo, error);
  if (rol !== 'ciudadano') {
    const { error: e } = await supabase.from('perfiles').update({ rol, organizacion_id: organizacion }).eq('id', data.user.id);
    if (e) falla(`Rol de ${correo}`, e);
  }
  return data.user.id;
}

// ---------------- borrar ----------------
async function borrar() {
  const usuarios = await usuariosDePrueba();
  for (const u of usuarios) {
    const { error } = await supabase.auth.admin.deleteUser(u.id);  // borra en cascada perfil, reclamos e historial
    if (error) console.error(`No se pudo borrar ${u.email}: ${error.message}`);
  }
  const { error } = await supabase.from('suscripciones').delete().eq('observacion', MARCA_SUSCRIPCION);
  if (error && !/does not exist|schema cache/.test(error.message)) console.error(`Suscripciones: ${error.message}`);
  console.log(`Borradas ${usuarios.length} cuentas de prueba (con sus reclamos) y las suscripciones de prueba.`);
}

// ---------------- cargar ----------------
async function cargar() {
  if ((await usuariosDePrueba()).length) {
    console.error('Ya hay datos de prueba cargados. Corré primero: npm run datos-prueba:borrar');
    process.exit(1);
  }

  const [{ data: sentidos, error: eS }, { data: paradas }] = await Promise.all([
    supabase.from('sentidos_por_linea').select('linea, lugar_id'),
    supabase.from('paradas').select('id, nombre, lineas, latitud, longitud').limit(1000),
  ]);
  if (eS) falla('Leer sentidos (¿está instalada la base?)', eS);
  const sentidosPorLinea = {};
  for (const s of sentidos) (sentidosPorLinea[s.linea] ??= []).push(s.lugar_id);
  const lineas = Object.keys(sentidosPorLinea);
  if (!lineas.length) throw new Error('No hay líneas ni ramales cargados: instalá la base primero.');
  if (!paradas?.length) console.warn('No hay paradas cargadas: los reclamos se crean sin parada.');

  console.log('Creando cuentas…');
  for (const o of OPERADORES) await crearCuenta(o);
  const vecinos = [];
  for (const [i, [nombre, apellido]] of VECINOS.entries()) {
    vecinos.push(await crearCuenta({ correo: `vecino${i + 1}${DOMINIO}`, nombre, apellido }));
  }

  console.log('Creando suscripciones de prueba…');
  for (const s of SUSCRIPCIONES) {
    const { error } = await supabase.from('suscripciones')
      .insert({ linea: s.linea, organizacion_id: s.organizacion, estado: 'activa', observacion: MARCA_SUSCRIPCION });
    if (error) console.warn(`Suscripción ${s.linea} → ${s.organizacion}: ${error.message}`);
  }
  const gestoraDe = Object.fromEntries(SUSCRIPCIONES.map((s) => [s.linea, s.organizacion]));
  const NOMBRE_ORGANIZACION = { tratado: 'Tratado del Pilar', pilarbus: 'Pilar Bus', muni: 'Municipio de Pilar — Transporte' };

  console.log('Creando reclamos…');
  for (let k = 0; k < CANTIDAD_RECLAMOS; k++) {
    const parada = paradas?.length ? elegir(paradas) : null;
    const lineasDeLaParada = (parada?.lineas ?? []).filter((l) => sentidosPorLinea[l]);
    const linea = lineasDeLaParada.length ? elegir(lineasDeLaParada) : elegir(lineas);
    const motivo = elegirConPeso(PESO_MOTIVO);

    const dias = Math.floor(Math.random() * 45);
    const hecho = new Date(Date.now() - dias * 86400e3);
    hecho.setHours(6 + Math.floor(Math.random() * 16), Math.floor(Math.random() * 12) * 5, 0, 0);
    const creado = new Date(Math.min(hecho.getTime() + (20 + Math.random() * 180) * 60e3, Date.now() - 60e3));
    const x = Math.random();
    const estadoFinal = dias < 2 || x < 0.25 ? 'Recibido' : x < 0.5 ? 'En revisión' : x < 0.9 ? 'Atendido' : 'Anulado';

    const { data: reclamo, error } = await supabase.from('reclamos').insert({
      ciudadano_id: elegir(vecinos),
      linea,
      sentido_lugar_id: elegir(sentidosPorLinea[linea]),
      motivo,
      interno_patente: motivo === 'robo' && Math.random() < 0.5 ? null : String(1000 + Math.floor(Math.random() * 900)),
      fecha_hora_hecho: fechaLocal(hecho),
      ubicacion_texto: parada ? `Parada ${parada.nombre ?? 'sin nombre'}` : 'Dirección de prueba, Pilar',
      latitud: parada?.latitud ?? -34.4587 + (Math.random() - 0.5) * 0.04,
      longitud: parada?.longitud ?? -58.9142 + (Math.random() - 0.5) * 0.04,
      parada_id: parada?.id ?? null,
      estado: estadoFinal,
      creado_en: creado.toISOString(),
    }).select('id').single();
    if (error) falla(`Reclamo ${k + 1}`, error);

    // "Recibido" lo agrega la base; acá se suman los pasos siguientes
    const responsable = NOMBRE_ORGANIZACION[motivo === 'robo' && Math.random() < 0.5 ? 'muni' : (gestoraDe[linea] ?? 'muni')];
    let momento = creado.getTime();
    let anterior = 'Recibido';
    for (const estado of PASOS_HASTA[estadoFinal]) {
      momento = Math.min(momento + (6 + Math.random() * 60) * 3600e3, Date.now() - 60e3);
      const { error: eH } = await supabase.from('historial_estados').insert({
        reclamo_id: reclamo.id, estado_anterior: anterior, estado_nuevo: estado,
        comentario: elegir(COMENTARIOS[estado]), responsable_nombre: responsable, creado_en: new Date(momento).toISOString(),
      });
      if (eH) falla(`Historial del reclamo ${k + 1}`, eH);
      anterior = estado;
    }
  }

  console.log(`Listo: ${CANTIDAD_RECLAMOS} reclamos.`);
  console.log(`Cuentas (contraseña ${CONTRASENA}):`);
  console.log(`  tratado${DOMINIO}   → empresa, línea 501`);
  console.log(`  pilarbus${DOMINIO}  → empresa, línea 510`);
  console.log(`  municipio${DOMINIO} → todas las líneas`);
  console.log(`  admin${DOMINIO}     → administración (suscripciones y cuentas)`);
  console.log(`  vecino1${DOMINIO} … vecino8${DOMINIO} → ciudadanos`);
}

(process.argv.includes('--borrar') ? borrar() : cargar()).catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
