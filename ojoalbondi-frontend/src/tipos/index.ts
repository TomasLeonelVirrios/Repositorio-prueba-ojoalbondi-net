// =====================================================================
// Tipos del dominio. Los nombres coinciden con las tablas de Supabase.
// =====================================================================

export type Estado = 'Recibido' | 'En revisión' | 'Atendido' | 'Anulado';
export type Rol = 'ciudadano' | 'empresa' | 'municipio' | 'admin';

export type Perfil = {
  id: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  rol: Rol;
  organizacion_id: string | null;
  organizacion_nombre: string | null;
};

export type Motivo = { codigo: string; descripcion: string; esGrave: boolean };
/** Opción del campo Sentido: un destino de los ramales de la línea. */
export type Sentido = { lugarId: number; nombre: string };
export type Punto = { latitud: number; longitud: number };

export type Parada = {
  id: number;
  nombre: string | null;
  lineas: string[];
  latitud: number;
  longitud: number;
};

/** Lo que completa el ciudadano en "Nuevo reclamo". */
export type NuevoReclamo = {
  linea: string;
  sentidoLugarId: number;
  motivo: string;
  internoPatente: string;        // vacío permitido solo con motivo robo
  descripcion: string;
  fechaHoraHecho: string;        // 'AAAA-MM-DDTHH:MM', hora local
  ubicacionTexto: string;
  latitud: number | null;
  longitud: number | null;
  paradaId: number | null;
  fotoUri: string | null;        // archivo local, para mostrar la vista previa
  fotoBase64: string | null;     // contenido de la foto: es lo que se sube a Storage al enviar
};

/** Reclamo guardado en el celular mientras no hay conexión (RF-07). */
export type Borrador = { idLocal: string; ciudadanoId: string; creadoEn: string; datos: NuevoReclamo };

/** Fila de listado (Inicio, Mis reclamos y Bandeja). */
export type ReclamoResumen = {
  id: string;
  ticket: string;
  linea: string;
  estado: Estado;
  motivoDescripcion: string;
  esGrave: boolean;
  fechaHoraHecho: string;
  creadoEn: string;
};

/** Detalle que ve la institución (RF-13): del ciudadano, solo nombre y apellido. */
export type ReclamoDetalle = ReclamoResumen & {
  sentido: string;
  internoPatente: string | null;
  descripcion: string | null;
  ubicacionTexto: string;
  latitud: number | null;
  longitud: number | null;
  fotoRuta: string | null;
  ciudadanoNombre: string;
  ciudadanoApellido: string;
};

export type EntradaHistorial = {
  id: number;
  estadoAnterior: Estado | null;
  estadoNuevo: Estado;
  comentario: string | null;
  responsableNombre: string;
  creadoEn: string;
};
