import { Estado } from '../tipos';

export const ESTADOS: Estado[] = ['Recibido', 'En revisión', 'Atendido', 'Anulado'];
export const ESTADOS_PENDIENTES: Estado[] = ['Recibido', 'En revisión'];

/** Flujo de estados (sección 4 de la especificación). La base lo vuelve a validar en cambiar_estado(). */
export const TRANSICIONES: Record<Estado, Estado[]> = {
  'Recibido': ['En revisión', 'Anulado'],
  'En revisión': ['Atendido', 'Anulado'],
  'Atendido': [],
  'Anulado': [],
};

/** Texto del botón para pasar a cada estado. */
export const ACCION_ESTADO: Partial<Record<Estado, string>> = {
  'En revisión': 'Tomar (En revisión)',
  'Atendido': 'Marcar como Atendido',
  'Anulado': 'Anular',
};

export const MOTIVOS_ANULACION = ['Reclamo duplicado', 'Datos falsos o insuficientes', 'Fuera de jurisdicción'];

/** RF-11: un reclamo pendiente con más de estos días se resalta en la bandeja. */
export const DIAS_PENDIENTE_RESALTADO = 7;
