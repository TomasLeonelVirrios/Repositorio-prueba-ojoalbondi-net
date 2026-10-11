/**
 * Traduce errores técnicos (Supabase, red) a mensajes para el usuario.
 * Los errores de la base se distinguen primero por su código (errcode de las funciones SQL):
 * 42501 = sin permiso, 23505 = dato repetido. Los de validación (22023) comparten código y se
 * distinguen por el texto que arma la base en supabase/esquema/02_funciones.sql.
 */
export function mensajeDeError(error: unknown, porDefecto = 'Ocurrió un error. Intentá de nuevo.'): string {
  const codigo = (error as { code?: string })?.code;
  const m = String((error as { message?: string })?.message ?? error ?? '').toLowerCase();

  // Autenticación (Supabase Auth)
  if (m.includes('invalid login credentials')) return 'El correo o la contraseña son incorrectos.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Ya existe una cuenta con ese correo.';
  if (m.includes('email not confirmed')) return 'Confirmá tu correo con el mail que te enviamos antes de iniciar sesión.';
  if (m.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (m.includes('invalid') && m.includes('email')) return 'El correo no es válido.';
  // El alta del perfil falló en la base (faltan datos o la fecha de nacimiento no es válida)
  if (m.includes('database error saving new user')) return 'No se pudo crear la cuenta. Revisá nombre, apellido y fecha de nacimiento.';

  // Base de datos: por código
  if (codigo === '42501') {
    if (m.includes('foto')) return 'La foto no corresponde a tu cuenta. Volvé a adjuntarla.';
    return 'No tenés permiso para realizar esta acción.';
  }
  if (codigo === '23505' && m.includes('suscripciones_una_activa')) return 'Esa línea ya tiene una suscripción activa.';

  // Validaciones (22023): por el texto que arma la base
  if (m.includes('motivo de anulación')) return 'El motivo de anulación es obligatorio.';
  if (m.includes('no permitido')) return 'Este cambio de estado no está permitido. Actualizá el reclamo: puede que otro operador lo haya cambiado.';
  if (m.includes('sentido elegido')) return 'El sentido elegido no corresponde a la línea. Volvé a elegirlo.';
  if (m.includes('no puede ser futura')) return 'La fecha y hora del hecho no puede ser posterior a la actual. Revisá la hora del celular.';
  if (m.includes('organización elegida')) return 'La organización elegida no corresponde a ese rol.';

  if (esErrorDeRed(error)) return 'No hay conexión. Revisá tu internet e intentá de nuevo.';
  return porDefecto;
}

export function esErrorDeRed(error: unknown): boolean {
  const m = String((error as { message?: string })?.message ?? error ?? '').toLowerCase();
  return m.includes('network') || m.includes('fetch');
}
