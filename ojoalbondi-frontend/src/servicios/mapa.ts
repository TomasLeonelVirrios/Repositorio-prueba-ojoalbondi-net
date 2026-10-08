import { supabase } from './supabase';

// Mapa de calor de reclamos por parada (RF-17 y RF-17.1).
// La base devuelve solo datos agrupados: nunca reclamos individuales con datos del ciudadano.

export type FiltrosCalor = {
  motivo: string | null;   // código de motivo o null para todos
  dias: number | null;     // período en días o null para todo el historial
  linea: string | null;    // línea o null para todas
};

export type ReclamoEnParada = { motivoDescripcion: string; fecha: string; linea: string };

/** Cantidad de reclamos por parada (sin anulados, máximo 3 por ciudadano y parada). */
export async function calorPorParada(f: FiltrosCalor): Promise<Map<number, number>> {
  const { data, error } = await supabase.rpc('calor_por_parada', { p_motivo: f.motivo, p_dias: f.dias, p_linea: f.linea });
  if (error) throw error;
  return new Map(((data ?? []) as { parada_id: number; cantidad: number }[]).map((x) => [Number(x.parada_id), Number(x.cantidad)]));
}

/** Los 20 reclamos más recientes de una parada (motivo, fecha y línea) y el total. */
export async function reclamosDeParada(paradaId: number, f: FiltrosCalor): Promise<{ reclamos: ReclamoEnParada[]; total: number }> {
  const { data, error } = await supabase.rpc('reclamos_de_parada', { p_parada: paradaId, p_motivo: f.motivo, p_dias: f.dias, p_linea: f.linea });
  if (error) throw error;
  const filas = (data ?? []) as { motivo_descripcion: string; fecha: string; linea: string; total: number }[];
  return {
    reclamos: filas.map((x) => ({ motivoDescripcion: x.motivo_descripcion, fecha: x.fecha, linea: x.linea })),
    total: filas.length ? Number(filas[0].total) : 0,
  };
}
