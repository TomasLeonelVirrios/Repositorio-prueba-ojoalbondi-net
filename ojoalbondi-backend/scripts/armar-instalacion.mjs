// Arma supabase/instalacion_completa.sql uniendo los archivos de supabase/esquema en orden.
// Se corre cada vez que se modifica algún archivo del esquema:  npm run armar-instalacion
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase');
const carpeta = join(raiz, 'esquema');
const archivos = (await readdir(carpeta)).filter((f) => f.endsWith('.sql')).sort();

const encabezado = `-- =====================================================================
-- OjoAlBondi · INSTALACIÓN COMPLETA (base de datos nueva)
-- Generado a partir de supabase/esquema/01 a 05 (scripts/armar-instalacion.mjs).
-- No editar a mano: editar los archivos de supabase/esquema y volver a generarlo.
-- Uso: Supabase > SQL Editor > New query > pegar todo > Run.
-- Se puede volver a correr sin romper nada.
-- =====================================================================
begin;

`;
const partes = await Promise.all(archivos.map((f) => readFile(join(carpeta, f), 'utf8')));
await writeFile(join(raiz, 'instalacion_completa.sql'), encabezado + partes.join('\n\n') + '\ncommit;\n');
console.log(`instalacion_completa.sql generado con ${archivos.length} archivos: ${archivos.join(', ')}`);
