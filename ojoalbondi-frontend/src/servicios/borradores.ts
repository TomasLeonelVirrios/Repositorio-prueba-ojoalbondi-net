import AsyncStorage from '@react-native-async-storage/async-storage';
import { CLAVES } from '../constantes/almacenamiento';
import { Borrador, NuevoReclamo } from '../tipos';
import { esErrorDeRed, mensajeDeError } from '../utilidades/errores';
import { nuevoId } from '../utilidades/ids';
import { enviarReclamo } from './reclamos';

// Reclamos guardados en el celular mientras no hay conexión (RF-07).

async function leerTodos(): Promise<Borrador[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(CLAVES.borradores)) ?? '[]');
  } catch {
    return [];
  }
}

const guardarTodos = (borradores: Borrador[]) => AsyncStorage.setItem(CLAVES.borradores, JSON.stringify(borradores));

export async function guardarBorrador(ciudadanoId: string, datos: NuevoReclamo): Promise<void> {
  const todos = await leerTodos();
  todos.push({ idLocal: String(Date.now()), ciudadanoId, creadoEn: new Date().toISOString(), datos });
  await guardarTodos(todos);
}

export async function borradoresDe(ciudadanoId: string): Promise<Borrador[]> {
  return (await leerTodos()).filter((b) => b.ciudadanoId === ciudadanoId);
}

/**
 * Envía los borradores del ciudadano. Devuelve cuántos se enviaron.
 * Si falla la red, el borrador queda para la próxima reconexión. Si la base lo rechaza por otro motivo
 * (por ejemplo, se desactivó el sentido elegido), se guarda el error y deja de reintentarse solo:
 * el ciudadano lo ve en Mis reportes y elige reintentar o descartar.
 */
export async function sincronizarBorradores(ciudadanoId: string): Promise<number> {
  await asignarIds();
  const propios = (await borradoresDe(ciudadanoId)).filter((b) => !b.error);
  if (!propios.length) return 0;
  const enviados = new Set<string>();
  const rechazados = new Map<string, string>();
  for (const b of propios) {
    try {
      await enviarReclamo(ciudadanoId, b.datos);
      enviados.add(b.idLocal);
    } catch (e) {
      if (!esErrorDeRed(e)) rechazados.set(b.idLocal, mensajeDeError(e, 'No se pudo enviar el reporte.'));
    }
  }
  await guardarTodos((await leerTodos())
    .filter((b) => !enviados.has(b.idLocal))
    .map((b) => (rechazados.has(b.idLocal) ? { ...b, error: rechazados.get(b.idLocal) } : b)));
  return enviados.size;
}

/** Vuelve a poner el borrador en la cola de envío (el próximo intento es al sincronizar). */
export async function reintentarBorrador(idLocal: string): Promise<void> {
  await guardarTodos((await leerTodos()).map((b) => (b.idLocal === idLocal ? { ...b, error: null } : b)));
}

export async function descartarBorrador(idLocal: string): Promise<void> {
  await guardarTodos((await leerTodos()).filter((b) => b.idLocal !== idLocal));
}

/** Los borradores guardados por versiones anteriores de la app no tienen id: se les asigna y se guarda antes de enviar. */
async function asignarIds(): Promise<void> {
  const todos = await leerTodos();
  const sinId = todos.filter((b) => !b.datos.id);
  if (!sinId.length) return;
  for (const b of sinId) b.datos.id = nuevoId();
  await guardarTodos(todos);
}
