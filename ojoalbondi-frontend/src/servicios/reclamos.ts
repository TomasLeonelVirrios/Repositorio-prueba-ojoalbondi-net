import { decode } from 'base64-arraybuffer';
import { NuevoReclamo, ReclamoResumen } from '../tipos';
import { BUCKET_FOTOS, supabase } from './supabase';

// Reclamos del ciudadano: crear y listar los propios.

/**
 * Sube la foto a Storage. Se sube el contenido en base64 que entrega el selector de imágenes:
 * leer el archivo local con fetch() en React Native puede generar un archivo vacío.
 */
async function subirFoto(ciudadanoId: string, base64: string): Promise<string> {
  const ruta = `${ciudadanoId}/${Date.now()}.jpg`;   // cada ciudadano sube a su carpeta
  const { error } = await supabase.storage
    .from(BUCKET_FOTOS)
    .upload(ruta, decode(base64), { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return ruta;
}

/** Registra el reclamo y devuelve el ticket que genera la base (OB-AAAA-NNNN). */
export async function enviarReclamo(ciudadanoId: string, r: NuevoReclamo): Promise<string> {
  const fotoRuta = r.fotoBase64 ? await subirFoto(ciudadanoId, r.fotoBase64) : null;
  const { data, error } = await supabase
    .from('reclamos')
    .insert({
      ciudadano_id: ciudadanoId,
      linea: r.linea,
      sentido_lugar_id: r.sentidoLugarId,
      motivo: r.motivo,
      interno_patente: r.internoPatente.trim() || null,
      descripcion: r.descripcion.trim() || null,
      fecha_hora_hecho: r.fechaHoraHecho,
      ubicacion_texto: r.ubicacionTexto.trim(),
      latitud: r.latitud,
      longitud: r.longitud,
      parada_id: r.paradaId,
      foto_ruta: fotoRuta,
    })
    .select('ticket')
    .single();
  if (error) throw error;
  return data.ticket as string;
}

type FilaReclamo = {
  id: string; ticket: string; linea: string; estado: ReclamoResumen['estado'];
  fecha_hora_hecho: string; creado_en: string; motivos: { descripcion: string; es_grave: boolean } | null;
};

/** Reclamos del ciudadano conectado, los más recientes primero. */
export async function listarMisReclamos(limite?: number): Promise<ReclamoResumen[]> {
  let consulta = supabase
    .from('reclamos')
    .select('id, ticket, linea, estado, fecha_hora_hecho, creado_en, motivos(descripcion, es_grave)')
    .order('creado_en', { ascending: false });
  if (limite) consulta = consulta.limit(limite);
  const { data, error } = await consulta;
  if (error) throw error;
  return ((data ?? []) as unknown as FilaReclamo[]).map((f) => ({
    id: f.id,
    ticket: f.ticket,
    linea: f.linea,
    estado: f.estado,
    motivoDescripcion: f.motivos?.descripcion ?? '',
    esGrave: f.motivos?.es_grave ?? false,
    fechaHoraHecho: f.fecha_hora_hecho,
    creadoEn: f.creado_en,
  }));
}
