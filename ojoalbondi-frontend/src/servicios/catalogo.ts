import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { CLAVES } from '../constantes/almacenamiento';
import { Motivo, Sentido } from '../tipos';
import { supabase } from './supabase';

/**
 * Catálogos que define la base: líneas, sentidos por línea y motivos.
 * Se guarda una copia en el celular para poder crear reclamos sin conexión.
 */
export type Catalogo = { lineas: string[]; sentidos: Record<string, Sentido[]>; motivos: Motivo[] };

const VACIO: Catalogo = { lineas: [], sentidos: {}, motivos: [] };
let enMemoria: Catalogo | null = null;

async function leerCopiaLocal(): Promise<Catalogo> {
  if (enMemoria) return enMemoria;
  try {
    const guardado = await AsyncStorage.getItem(CLAVES.catalogo);
    enMemoria = guardado ? JSON.parse(guardado) : VACIO;
  } catch {
    enMemoria = VACIO;
  }
  return enMemoria!;
}

export async function actualizarCatalogo(): Promise<Catalogo> {
  const [lineas, sentidos, motivos] = await Promise.all([
    supabase.from('lineas').select('codigo').order('codigo'),
    supabase.from('sentidos_por_linea').select('linea, lugar_id, nombre').order('nombre'),
    supabase.from('motivos').select('codigo, descripcion, es_grave').order('orden'),
  ]);
  for (const r of [lineas, sentidos, motivos]) if (r.error) throw r.error;

  const sentidosPorLinea: Record<string, Sentido[]> = {};
  for (const s of sentidos.data ?? []) (sentidosPorLinea[s.linea] ??= []).push({ lugarId: s.lugar_id, nombre: s.nombre });

  const catalogo: Catalogo = {
    lineas: (lineas.data ?? []).map((l) => l.codigo),
    sentidos: sentidosPorLinea,
    motivos: (motivos.data ?? []).map((m) => ({ codigo: m.codigo, descripcion: m.descripcion, esGrave: m.es_grave })),
  };
  enMemoria = catalogo;
  await AsyncStorage.setItem(CLAVES.catalogo, JSON.stringify(catalogo));
  return catalogo;
}

/** Devuelve enseguida la copia local y la actualiza desde la base si hay conexión. */
export function useCatalogo() {
  const [catalogo, setCatalogo] = useState<Catalogo>(enMemoria ?? VACIO);
  const [sinDatos, setSinDatos] = useState(false);

  useEffect(() => {
    let montado = true;
    leerCopiaLocal().then((c) => montado && setCatalogo(c));
    actualizarCatalogo()
      .then((c) => montado && setCatalogo(c))
      .catch(() => leerCopiaLocal().then((c) => montado && setSinDatos(c.lineas.length === 0)));
    return () => { montado = false; };
  }, []);

  return { catalogo, sinDatos };
}

/** Texto que ve el ciudadano: "hacia Pilar". */
export const textoSentido = (s: Sentido) => `hacia ${s.nombre}`;

export const descripcionMotivo = (catalogo: Catalogo, codigo: string) =>
  catalogo.motivos.find((m) => m.codigo === codigo)?.descripcion ?? codigo;
