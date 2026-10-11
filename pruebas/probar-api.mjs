// =====================================================================
// OjoAlBondi · Pruebas por la API (lo que hace cualquiera que tenga la clave publicable)
// Cubre los casos del Plan de pruebas que necesitan la API real de Supabase (Auth, REST y Storage)
// y que no se pueden comprobar desde el SQL Editor.
//
// Uso (Node 18+, sin instalar nada), desde la carpeta ojoalbondi-app:
//   node pruebas/probar-api.mjs
// Lee la URL y la clave publicable de ojoalbondi-frontend/.env (la base beta).
//
// No deja datos: las altas y subidas que se prueban tienen que ser rechazadas. Si alguna NO es
// rechazada, el script lo marca como FALLA y dice qué quedó creado para que lo borre el responsable de la base.
// =====================================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const carpeta = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(carpeta, '..', 'ojoalbondi-frontend', '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const URL_BASE = env.EXPO_PUBLIC_SUPABASE_URL;
const CLAVE = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_BASE || !CLAVE) {
  console.error('No encontré EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY en ojoalbondi-frontend/.env');
  process.exit(1);
}
const CONTRASENA = 'Prueba123!';
const resultados = [];

function anotar(caso, pasa, detalle) {
  resultados.push({ caso, resultado: pasa ? 'Pasa' : 'Falla', detalle });
  console.log(`${pasa ? '✔ Pasa ' : '✘ FALLA'}  ${caso}  ·  ${detalle}`);
}

async function pedir(ruta, { metodo = 'GET', token, cuerpo, tipo = 'application/json', extra = {} } = {}) {
  const r = await fetch(URL_BASE + ruta, {
    method: metodo,
    headers: {
      apikey: CLAVE,
      Authorization: `Bearer ${token ?? CLAVE}`,
      ...(cuerpo !== undefined ? { 'Content-Type': tipo } : {}),
      ...extra,
    },
    body: cuerpo === undefined ? undefined : tipo === 'application/json' ? JSON.stringify(cuerpo) : cuerpo,
  });
  const texto = await r.text();
  let datos;
  try { datos = JSON.parse(texto); } catch { datos = texto; }
  return { estado: r.status, datos };
}

const mensaje = (d) => (typeof d === 'string' ? d : d?.message ?? d?.msg ?? d?.error_description ?? d?.error ?? JSON.stringify(d)).toString().slice(0, 160);

async function iniciarSesion(correo, contrasena = CONTRASENA) {
  const r = await pedir('/auth/v1/token?grant_type=password', { metodo: 'POST', cuerpo: { email: correo, password: contrasena } });
  return { ...r, token: r.datos?.access_token, id: r.datos?.user?.id };
}

// ---------------------------------------------------------------------
// CA-RF02-1 / CA-RF02-2 (lado servidor): inicio de sesión correcto e incorrecto
const vecino = await iniciarSesion('vecino1@prueba.ojoalbondi');
anotar('CA-RF02-1 (API) login vecino1', vecino.estado === 200 && !!vecino.token, `HTTP ${vecino.estado}`);
const malo = await iniciarSesion('vecino1@prueba.ojoalbondi', 'incorrecta');
anotar('CA-RF02-2 (API) contraseña incorrecta', malo.estado === 400, `HTTP ${malo.estado} · ${mensaje(malo.datos)}`);
const tratado = await iniciarSesion('tratado@prueba.ojoalbondi');
if (!vecino.token || !tratado.token) {
  console.error('\nNo pude iniciar sesión con las cuentas de prueba. ¿El .env apunta a la beta y están cargados los datos de prueba?');
  process.exit(1);
}

// CA-RF01-6: alta por la API sin fecha de nacimiento / con fecha futura -> no se crea la cuenta
for (const [nombreCaso, datos] of [
  ['sin fecha de nacimiento', { nombre: 'Api', apellido: 'Prueba' }],
  ['con fecha futura', { nombre: 'Api', apellido: 'Prueba', fecha_nacimiento: '2099-01-01' }],
]) {
  const correo = `api-${Date.now()}@prueba.ojoalbondi`;
  const r = await pedir('/auth/v1/signup', { metodo: 'POST', cuerpo: { email: correo, password: CONTRASENA, data: datos } });
  const rechazada = r.estado >= 400 && /database error/i.test(mensaje(r.datos));
  anotar(`CA-RF01-6 alta ${nombreCaso}`, rechazada,
    rechazada ? `HTTP ${r.estado} · ${mensaje(r.datos)}` : `HTTP ${r.estado} · OJO: se creó ${correo}, borrarla en Authentication`);
}

// CA-RNF01-1: el ciudadano solo lee sus reclamos
{
  const r = await pedir('/rest/v1/reclamos?select=ciudadano_id', { token: vecino.token });
  const ajenos = Array.isArray(r.datos) ? r.datos.filter((x) => x.ciudadano_id !== vecino.id).length : -1;
  anotar('CA-RNF01-1 (API) vecino1 no ve reclamos ajenos', ajenos === 0, `${Array.isArray(r.datos) ? r.datos.length : '?'} propios, ${ajenos} ajenos`);
}

// CA-RNF01-2 y CA-RNF01-5: la empresa no ve otras líneas ni la tabla reclamos
{
  const r510 = await pedir('/rest/v1/reclamos_gestion?select=id&linea=eq.510', { token: tratado.token });
  anotar('CA-RNF01-2 (API) tratado no ve la 510', Array.isArray(r510.datos) && r510.datos.length === 0, `${JSON.stringify(r510.datos).slice(0, 80)}`);
  const rec = await pedir('/rest/v1/reclamos?select=id', { token: tratado.token });
  const ges = await pedir('/rest/v1/reclamos_gestion?select=id', { token: tratado.token });
  anotar('CA-RNF01-5 (API) tratado: reclamos vacío, reclamos_gestion con datos',
    Array.isArray(rec.datos) && rec.datos.length === 0 && Array.isArray(ges.datos) && ges.datos.length > 0,
    `reclamos: ${Array.isArray(rec.datos) ? rec.datos.length : mensaje(rec.datos)} · reclamos_gestion: ${Array.isArray(ges.datos) ? ges.datos.length : mensaje(ges.datos)}`);
}

// CA-RN02-2: el ciudadano no puede cambiarse el rol
{
  const r = await pedir(`/rest/v1/perfiles?id=eq.${vecino.id}`, { metodo: 'PATCH', token: vecino.token, cuerpo: { rol: 'municipio' }, extra: { Prefer: 'return=representation' } });
  const p = await pedir(`/rest/v1/perfiles?select=rol&id=eq.${vecino.id}`, { token: vecino.token });
  const rol = Array.isArray(p.datos) ? p.datos[0]?.rol : '?';
  anotar('CA-RN02-2 (API) vecino1 intenta cambiar su rol', rol === 'ciudadano', `PATCH HTTP ${r.estado} · rol actual: ${rol}`);
}

// CA-RNF01-3: no se puede mandar ticket ni fecha de registro
{
  const r = await pedir('/rest/v1/reclamos', {
    metodo: 'POST', token: vecino.token,
    cuerpo: { linea: '501', sentido_lugar_id: 1, motivo: 'demora', interno_patente: '1', fecha_hora_hecho: '2026-01-01T10:00:00', ubicacion_texto: 'Prueba API', ticket: 'URGENTE', creado_en: '2020-01-01' },
  });
  anotar('CA-RNF01-3 (API) insert con ticket inventado', r.estado === 401 || r.estado === 403, `HTTP ${r.estado} · ${mensaje(r.datos)}`);
}

// CA-RNF01-4: generar_ticket por RPC
{
  const r = await pedir('/rest/v1/rpc/generar_ticket', { metodo: 'POST', token: vecino.token, cuerpo: { p_anio: 2026 } });
  anotar('CA-RNF01-4 (API) generar_ticket con sesión', r.estado >= 400 && /solo se usa desde el trigger/i.test(mensaje(r.datos)), `HTTP ${r.estado} · ${mensaje(r.datos)}`);
  const a = await pedir('/rest/v1/rpc/generar_ticket', { metodo: 'POST', cuerpo: { p_anio: 2026 } });
  anotar('CA-RNF01-4 (API) generar_ticket sin sesión', a.estado >= 400, `HTTP ${a.estado} · ${mensaje(a.datos)}`);
}

// CA-RNF01-7: Storage rechaza PDF y JPEG de más de 5 MB
{
  const rutaPdf = `${vecino.id}/prueba-api-${Date.now()}.pdf`;
  const pdf = await pedir(`/storage/v1/object/fotos-reclamos/${rutaPdf}`, { metodo: 'POST', token: vecino.token, tipo: 'application/pdf', cuerpo: Buffer.from('%PDF-1.4\n%prueba\n') });
  anotar('CA-RNF01-7 subir PDF', pdf.estado >= 400, pdf.estado >= 400 ? `HTTP ${pdf.estado} · ${mensaje(pdf.datos)}` : `HTTP ${pdf.estado} · OJO: quedó fotos-reclamos/${rutaPdf}`);
  const rutaJpg = `${vecino.id}/prueba-api-${Date.now()}.jpg`;
  const grande = Buffer.alloc(6 * 1024 * 1024, 0);
  grande[0] = 0xff; grande[1] = 0xd8; grande[2] = 0xff; // cabecera JPEG
  const jpg = await pedir(`/storage/v1/object/fotos-reclamos/${rutaJpg}`, { metodo: 'POST', token: vecino.token, tipo: 'image/jpeg', cuerpo: grande });
  anotar('CA-RNF01-7 subir JPEG de 6 MB', jpg.estado >= 400, jpg.estado >= 400 ? `HTTP ${jpg.estado} · ${mensaje(jpg.datos)}` : `HTTP ${jpg.estado} · OJO: quedó fotos-reclamos/${rutaJpg}`);
}

const fallas = resultados.filter((r) => r.resultado === 'Falla').length;
console.log(`\n${resultados.length} comprobaciones · ${resultados.length - fallas} pasan · ${fallas} fallan · ${new Date().toLocaleString('es-AR')}`);
process.exit(fallas ? 1 : 0);
