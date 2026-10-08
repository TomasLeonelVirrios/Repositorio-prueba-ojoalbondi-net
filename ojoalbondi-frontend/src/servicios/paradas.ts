import AsyncStorage from '@react-native-async-storage/async-storage';
import { CLAVES } from '../constantes/almacenamiento';
import { Parada } from '../tipos';
import { supabase } from './supabase';

let enMemoria: Parada[] | null = null;
const TAMANIO_PAGINA = 1000;  // máximo de filas que devuelve Supabase por consulta

/** Copia guardada en el celular: el mapa la muestra enseguida. */
export async function paradasGuardadas(): Promise<Parada[]> {
  if (enMemoria) return enMemoria;
  try {
    enMemoria = JSON.parse((await AsyncStorage.getItem(CLAVES.paradas)) ?? '[]');
  } catch {
    enMemoria = [];
  }
  return enMemoria!;
}

export async function actualizarParadas(): Promise<Parada[]> {
  const todas: Parada[] = [];
  for (let desde = 0; ; desde += TAMANIO_PAGINA) {
    const { data, error } = await supabase
      .from('paradas')
      .select('id, nombre, lineas, latitud, longitud')
      .order('id')
      .range(desde, desde + TAMANIO_PAGINA - 1);
    if (error) throw error;
    todas.push(...((data ?? []) as Parada[]));
    if (!data || data.length < TAMANIO_PAGINA) break;
  }
  enMemoria = todas;
  await AsyncStorage.setItem(CLAVES.paradas, JSON.stringify(todas));
  return todas;
}

export const nombreParada = (p: Parada) => p.nombre ?? 'Parada sin nombre';
