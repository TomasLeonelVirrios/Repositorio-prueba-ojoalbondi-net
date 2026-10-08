import AsyncStorage from '@react-native-async-storage/async-storage';
import { CLAVES } from '../constantes/almacenamiento';
import { Borrador, NuevoReclamo } from '../tipos';
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

/** Envía los borradores del ciudadano. Devuelve cuántos se enviaron; los que fallan quedan para el próximo intento. */
export async function sincronizarBorradores(ciudadanoId: string): Promise<number> {
  const propios = await borradoresDe(ciudadanoId);
  if (!propios.length) return 0;
  const enviados = new Set<string>();
  for (const b of propios) {
    try {
      await enviarReclamo(ciudadanoId, b.datos);
      enviados.add(b.idLocal);
    } catch {
      // se reintenta en la próxima reconexión
    }
  }
  await guardarTodos((await leerTodos()).filter((b) => !enviados.has(b.idLocal)));
  return enviados.size;
}
