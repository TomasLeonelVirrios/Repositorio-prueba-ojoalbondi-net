/** Traduce errores técnicos (Supabase, red) a mensajes para el usuario. */
export function mensajeDeError(error: unknown, porDefecto = 'Ocurrió un error. Intentá de nuevo.'): string {
  const m = String((error as { message?: string })?.message ?? error ?? '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'El correo o la contraseña son incorrectos.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Ya existe una cuenta con ese correo.';
  if (m.includes('email not confirmed')) return 'Confirmá tu correo con el mail que te enviamos antes de iniciar sesión.';
  if (m.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (m.includes('invalid') && m.includes('email')) return 'El correo no es válido.';
  if (m.includes('motivo de anulación')) return 'El motivo de anulación es obligatorio.';
  if (m.includes('no permitido')) return 'Este cambio de estado no está permitido. Actualizá el reclamo: puede que otro operador lo haya cambiado.';
  if (m.includes('permiso')) return 'No tenés permiso para realizar esta acción.';
  if (m.includes('sentido elegido')) return 'El sentido elegido no corresponde a la línea. Volvé a elegirlo.';
  if (esErrorDeRed(error)) return 'No hay conexión. Revisá tu internet e intentá de nuevo.';
  return porDefecto;
}

export function esErrorDeRed(error: unknown): boolean {
  const m = String((error as { message?: string })?.message ?? error ?? '').toLowerCase();
  return m.includes('network') || m.includes('fetch');
}
