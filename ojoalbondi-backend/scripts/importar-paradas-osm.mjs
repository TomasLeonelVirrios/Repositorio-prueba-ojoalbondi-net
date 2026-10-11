// Importa las paradas de colectivo de Pilar desde OpenStreetMap y genera
// ojoalbondi-backend/supabase/paradas_seed.sql para pegar en el SQL Editor de Supabase.
//
// Uso (Node 18+):
//   node ojoalbondi-backend/scripts/importar-paradas-osm.mjs
//   node ojoalbondi-backend/scripts/importar-paradas-osm.mjs --desde export.json   (JSON de overpass-turbo)
//
// Se puede volver a correr cuando se actualice OSM: el SQL hace upsert por id.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LINEAS = ['501', '503', '506', '509', '510', '511', '520'];
// Partido del Pilar (sur, oeste, norte, este) con un poco de margen
const BBOX = '-34.62,-59.10,-34.30,-58.75';

const CONSULTA = `
[out:json][timeout:180];
(
  node["highway"="bus_stop"](${BBOX});
  node["public_transport"="platform"]["bus"="yes"](${BBOX});
)->.paradas;
rel(bn.paradas)["type"="route"]["route"="bus"]->.rutas;
.paradas out body;
.rutas out body;
`;

const aqui = dirname(fileURLToPath(import.meta.url));
const SALIDA = join(aqui, '..', 'supabase', 'paradas_seed.sql');

// Servidores públicos de Overpass: si uno falla o está saturado, se prueba el siguiente.
const SERVIDORES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
// Overpass rechaza (error 406) los pedidos que no se identifican: hay que mandar un User-Agent propio.
const ENCABEZADOS = {
  'User-Agent': 'OjoAlBondi/1.0 (proyecto academico, Universidad Nacional de Pilar; importador de paradas)',
  'Accept': '*/*',
  'Content-Type': 'application/x-www-form-urlencoded',
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function obtenerDatos() {
  const i = process.argv.indexOf('--desde');
  if (i !== -1) return JSON.parse(await readFile(process.argv[i + 1], 'utf8'));
  const errores = [];
  for (const url of SERVIDORES) {
    for (let intento = 1; intento <= 2; intento++) {
      console.log(`Consultando ${new URL(url).host} (intento ${intento})… puede tardar un minuto.`);
      try {
        const r = await fetch(url, { method: 'POST', headers: ENCABEZADOS, body: 'data=' + encodeURIComponent(CONSULTA) });
        if (r.ok) return await r.json();
        errores.push(`${new URL(url).host}: respondió ${r.status}`);
        if (![429, 502, 503, 504].includes(r.status)) break; // otro error: pasar al siguiente servidor
      } catch (e) {
        errores.push(`${new URL(url).host}: ${e.message}`);
      }
      await esperar(15000); // servidor ocupado: esperar antes de reintentar
    }
  }
  throw new Error(
    'No se pudieron descargar las paradas.\n  ' + errores.join('\n  ') +
    '\nAlternativa manual: abrir https://overpass-turbo.eu, pegar la consulta que está al principio de este script,' +
    '\nejecutarla, Exportar > "raw OSM data" (JSON), y correr: node importar-paradas-osm.mjs --desde archivo.json'
  );
}

function distanciaM(a, b) {
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(h));
}

const lineasDeTexto = (t = '') =>
  t.split(/[;,/ ]+/).map((s) => s.trim()).filter((s) => LINEAS.includes(s));

function procesar(json) {
  const nodos = json.elements.filter((e) => e.type === 'node');
  const rutas = json.elements.filter((e) => e.type === 'relation');

  // Líneas de cada parada: por las relaciones de ruta que la incluyen + la etiqueta route_ref
  const lineasPorNodo = new Map();
  for (const r of rutas) {
    const ls = lineasDeTexto(r.tags?.ref);
    if (!ls.length) continue;
    for (const m of r.members ?? []) {
      if (m.type !== 'node') continue;
      const set = lineasPorNodo.get(m.ref) ?? new Set();
      ls.forEach((l) => set.add(l));
      lineasPorNodo.set(m.ref, set);
    }
  }

  const paradas = nodos.map((n) => {
    const set = lineasPorNodo.get(n.id) ?? new Set();
    lineasDeTexto(n.tags?.route_ref).forEach((l) => set.add(l));
    return { id: n.id, nombre: n.tags?.name?.trim() || null, lineas: [...set].sort(), lat: n.lat, lon: n.lon };
  });

  // Unir duplicados (mismo punto cargado como bus_stop y como platform, a menos de 15 m)
  const unicas = [];
  for (const p of paradas) {
    const dup = unicas.find((u) => distanciaM(u, p) < 15);
    if (dup) {
      dup.lineas = [...new Set([...dup.lineas, ...p.lineas])].sort();
      dup.nombre ??= p.nombre;
    } else unicas.push({ ...p });
  }
  return unicas;
}

const sqlTexto = (s) => (s === null ? 'null' : `'${s.replace(/'/g, "''")}'`);
const sqlArray = (a) => `'{${a.join(',')}}'`;

function generarSQL(paradas) {
  const lotes = [];
  for (let i = 0; i < paradas.length; i += 500) {
    const filas = paradas
      .slice(i, i + 500)
      .map((p) => `  (${p.id}, ${sqlTexto(p.nombre)}, ${sqlArray(p.lineas)}, ${p.lat}, ${p.lon})`)
      .join(',\n');
    lotes.push(
      `insert into public.paradas (id, nombre, lineas, latitud, longitud) values\n${filas}\n` +
        `on conflict (id) do update set nombre = excluded.nombre, lineas = excluded.lineas,\n` +
        `  latitud = excluded.latitud, longitud = excluded.longitud;`
    );
  }
  return `-- Generado por importar-paradas-osm.mjs el ${new Date().toISOString()}\n` +
    `-- Datos © colaboradores de OpenStreetMap (ODbL)\n\n${lotes.join('\n\n')}\n`;
}

const paradas = procesar(await obtenerDatos());
await writeFile(SALIDA, generarSQL(paradas));
const conLinea = paradas.filter((p) => p.lineas.length).length;
console.log(`Listo: ${paradas.length} paradas (${conLinea} con línea identificada) → ${SALIDA}`);
