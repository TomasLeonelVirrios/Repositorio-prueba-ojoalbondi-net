import { DIAS_PENDIENTE_RESALTADO, ESTADOS_PENDIENTES } from '../constantes/estados';
import { EntradaHistorial, Estado, ReclamoDetalle, ReclamoResumen } from '../tipos';
import { diasDesde } from '../utilidades/fechas';
import { BUCKET_FOTOS, supabase } from './supabase';

// Gestión de reclamos para empresas y municipio (RF-11, RF-13, RF-14, RF-15, RF-25).
// La vista reclamos_gestion ya filtra por las líneas que gestiona el usuario.

export const TAMANIO_PAGINA_BANDEJA = 20;  // RNF-04

/** RF-11: pendiente con más de 7 días. */
export const estaDemorado = (r: Pick<ReclamoResumen, 'estado' | 'creadoEn'>) =>
  ESTADOS_PENDIENTES.includes(r.estado) && diasDesde(r.creadoEn) > DIAS_PENDIENTE_RESALTADO;

type FilaGestion = {
  id: string; ticket: string; linea: string; estado: Estado; motivo_descripcion: string; es_grave: boolean;
  fecha_hora_hecho: string; creado_en: string; sentido: string; interno_patente: string | null;
  descripcion: string | null; ubicacion_texto: string; latitud: number | null; longitud: number | null;
  foto_ruta: string | null; ciudadano_nombre: string; ciudadano_apellido: string;
};

const aResumen = (f: FilaGestion): ReclamoResumen => ({
  id: f.id, ticket: f.ticket, linea: f.linea, estado: f.estado, motivoDescripcion: f.motivo_descripcion,
  esGrave: f.es_grave, fechaHoraHecho: f.fecha_hora_hecho, creadoEn: f.creado_en,
});

export async function listarBandeja(pagina: number, soloPendientes: boolean): Promise<ReclamoResumen[]> {
  const desde = pagina * TAMANIO_PAGINA_BANDEJA;
  let consulta = supabase
    .from('reclamos_gestion')
    .select('id, ticket, linea, estado, motivo_descripcion, es_grave, fecha_hora_hecho, creado_en')
    .order('creado_en', { ascending: false })
    .range(desde, desde + TAMANIO_PAGINA_BANDEJA - 1);
  if (soloPendientes) consulta = consulta.in('estado', ESTADOS_PENDIENTES);
  const { data, error } = await consulta;
  if (error) throw error;
  return ((data ?? []) as FilaGestion[]).map(aResumen);
}

/** Cantidad de reclamos por estado, en una sola consulta. */
export async function contarPorEstado(): Promise<Record<Estado, number>> {
  const cuentas: Record<Estado, number> = { 'Recibido': 0, 'En revisión': 0, 'Atendido': 0, 'Anulado': 0 };
  const { data, error } = await supabase.rpc('contar_bandeja');
  if (error) throw error;
  for (const f of (data ?? []) as { estado: Estado; cantidad: number }[]) cuentas[f.estado] = Number(f.cantidad);
  return cuentas;
}

/** RF-25: líneas con suscripción activa de la empresa del usuario. */
export async function lineasHabilitadas(): Promise<string[]> {
  const { data, error } = await supabase.from('suscripciones').select('linea').eq('estado', 'activa').order('linea');
  if (error) throw error;
  return (data ?? []).map((s) => s.linea);
}

export async function obtenerReclamo(id: string): Promise<ReclamoDetalle | null> {
  const { data, error } = await supabase.from('reclamos_gestion').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const f = data as FilaGestion;
  return {
    ...aResumen(f), sentido: f.sentido, internoPatente: f.interno_patente, descripcion: f.descripcion,
    ubicacionTexto: f.ubicacion_texto, latitud: f.latitud, longitud: f.longitud, fotoRuta: f.foto_ruta,
    ciudadanoNombre: f.ciudadano_nombre, ciudadanoApellido: f.ciudadano_apellido,
  };
}

export async function obtenerHistorial(reclamoId: string): Promise<EntradaHistorial[]> {
  const { data, error } = await supabase
    .from('historial_estados')
    .select('id, estado_anterior, estado_nuevo, comentario, responsable_nombre, creado_en')
    .eq('reclamo_id', reclamoId)
    .order('creado_en', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((h) => ({
    id: h.id, estadoAnterior: h.estado_anterior, estadoNuevo: h.estado_nuevo, comentario: h.comentario,
    responsableNombre: h.responsable_nombre, creadoEn: h.creado_en,
  }));
}

/** URL temporal de la foto (el bucket es privado). */
export async function urlTemporalFoto(ruta: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrl(ruta, 3600);
  return data?.signedUrl ?? null;
}

/** RF-14: la función de la base valida permiso, flujo y motivo de anulación. */
export async function cambiarEstado(reclamoId: string, nuevo: Estado, comentario: string): Promise<void> {
  const { error } = await supabase.rpc('cambiar_estado', { p_reclamo: reclamoId, p_nuevo: nuevo, p_comentario: comentario || null });
  if (error) throw error;
}
