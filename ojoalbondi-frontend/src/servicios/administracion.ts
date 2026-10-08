import { Rol } from '../tipos';
import { supabase } from './supabase';

// Interfaz de administración (RF-26): suscripciones por línea (RF-25) y roles de las cuentas (RN-02).

export type EstadoSuscripcion = 'pendiente' | 'activa' | 'suspendida' | 'rechazada';
export type Organizacion = { id: string; nombre: string; tipo: 'empresa' | 'municipio' };

export type LineaConSuscripcion = {
  linea: string;
  empresaOperadora: Organizacion | null;            // dato informativo del relevamiento
  suscripcionActiva: { id: number; organizacion: Organizacion; aprobadaEn: string | null } | null;
};

export type Cuenta = {
  id: string; nombre: string; apellido: string; correo: string;
  rol: Rol; organizacionId: string | null; creadoEn: string;
};

export async function listarOrganizaciones(): Promise<Organizacion[]> {
  const { data, error } = await supabase.from('organizaciones').select('id, nombre, tipo').order('nombre');
  if (error) throw error;
  return (data ?? []) as Organizacion[];
}

/** Cada línea con su empresa operadora y su suscripción activa (si tiene). */
export async function listarLineasConSuscripcion(): Promise<LineaConSuscripcion[]> {
  const [lineas, suscripciones, organizaciones] = await Promise.all([
    supabase.from('lineas').select('codigo, empresa_operadora_id').order('codigo'),
    supabase.from('suscripciones').select('id, linea, organizacion_id, aprobada_en').eq('estado', 'activa'),
    listarOrganizaciones(),
  ]);
  if (lineas.error) throw lineas.error;
  if (suscripciones.error) throw suscripciones.error;
  const porId = new Map(organizaciones.map((o) => [o.id, o]));
  return (lineas.data ?? []).map((l) => {
    const activa = (suscripciones.data ?? []).find((s) => s.linea === l.codigo);
    return {
      linea: l.codigo,
      empresaOperadora: porId.get(l.empresa_operadora_id) ?? null,
      suscripcionActiva: activa && porId.get(activa.organizacion_id)
        ? { id: activa.id, organizacion: porId.get(activa.organizacion_id)!, aprobadaEn: activa.aprobada_en }
        : null,
    };
  });
}

/** Activa la suscripción de una empresa a una línea (la base impide dos activas por línea). */
export async function activarSuscripcion(linea: string, organizacionId: string): Promise<void> {
  const { error } = await supabase.from('suscripciones').insert({ linea, organizacion_id: organizacionId, estado: 'activa' });
  if (error) throw error;
}

/** Suspende una suscripción: la empresa deja de ver los reclamos; el municipio los sigue gestionando. */
export async function suspenderSuscripcion(suscripcionId: number): Promise<void> {
  const { error } = await supabase.from('suscripciones').update({ estado: 'suspendida' as EstadoSuscripcion }).eq('id', suscripcionId);
  if (error) throw error;
}

export async function listarCuentas(): Promise<Cuenta[]> {
  const { data, error } = await supabase.rpc('admin_listar_cuentas');
  if (error) throw error;
  return ((data ?? []) as { id: string; nombre: string; apellido: string; correo: string; rol: Rol; organizacion_id: string | null; creado_en: string }[])
    .map((c) => ({ id: c.id, nombre: c.nombre, apellido: c.apellido, correo: c.correo, rol: c.rol, organizacionId: c.organizacion_id, creadoEn: c.creado_en }));
}

export async function asignarRol(usuarioId: string, rol: Rol, organizacionId: string | null): Promise<void> {
  const { error } = await supabase.rpc('admin_asignar_rol', { p_usuario: usuarioId, p_rol: rol, p_organizacion: organizacionId });
  if (error) throw error;
}
