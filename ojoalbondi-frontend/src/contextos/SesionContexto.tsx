import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { CLAVES } from '../constantes/almacenamiento';
import { supabase } from '../servicios/supabase';
import { Perfil } from '../tipos';
import { mensajeDeError } from '../utilidades/errores';

export type DatosRegistro = {
  nombre: string;
  apellido: string;
  fechaNacimiento: string;  // AAAA-MM-DD
  correo: string;
  contrasena: string;
};

/** Cada acción devuelve null si salió bien, o el mensaje de error para mostrar. */
type ValorSesion = {
  sesion: Session | null;
  perfil: Perfil | null;
  cargando: boolean;
  iniciarSesion: (correo: string, contrasena: string) => Promise<string | null>;
  registrarse: (datos: DatosRegistro) => Promise<string | null>;
  recuperarContrasena: (correo: string) => Promise<string | null>;
  cerrarSesion: () => Promise<void>;
};

const SesionContexto = createContext<ValorSesion>({} as ValorSesion);

/** Empresa o municipio: usan la interfaz de gestión (RF-10). */
export const esInstitucion = (perfil: Perfil | null) => !!perfil && (perfil.rol === 'empresa' || perfil.rol === 'municipio');

/** Administrador: usa la interfaz de administración (RF-26). */
export const esAdministrador = (perfil: Perfil | null) => perfil?.rol === 'admin';

export const NOMBRE_ROL: Record<Perfil['rol'], string> = {
  ciudadano: 'Ciudadano', empresa: 'Empresa de transporte', municipio: 'Municipio', admin: 'Administración',
};

/** Último perfil leído de la base, guardado en el celular para usarlo sin conexión. */
async function perfilGuardado(usuarioId: string): Promise<Perfil | null> {
  try {
    const guardado = JSON.parse((await AsyncStorage.getItem(CLAVES.perfil)) ?? 'null') as Perfil | null;
    return guardado?.id === usuarioId ? guardado : null;
  } catch {
    return null;
  }
}

/** Sin conexión y sin perfil guardado: los datos del registro (toda cuenta nueva es ciudadano). */
const perfilDelRegistro = (usuario: User): Perfil => {
  const meta = usuario.user_metadata ?? {};
  return {
    id: usuario.id, nombre: meta.nombre ?? '', apellido: meta.apellido ?? '',
    fecha_nacimiento: meta.fecha_nacimiento ?? '', rol: 'ciudadano', organizacion_id: null, organizacion_nombre: null,
  };
};

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargando(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, nueva) => setSesion(nueva));
    return () => data.subscription.unsubscribe();
  }, []);

  // Perfil con rol y organización del usuario conectado.
  // Se lee solo cuando cambia el usuario: renovar el token (cada hora) no vuelve a consultarlo.
  const usuario = sesion?.user ?? null;
  const usuarioId = usuario?.id;
  useEffect(() => {
    if (!usuario) {
      setPerfil(null);
      return;
    }
    let vigente = true;   // descarta la respuesta si mientras tanto cambió la cuenta
    (async () => {
      const { data } = await supabase
        .from('perfiles')
        .select('id, nombre, apellido, fecha_nacimiento, rol, organizacion_id, organizaciones(nombre)')
        .eq('id', usuario.id)
        .single();
      if (!vigente) return;
      if (data) {
        const fila = data as unknown as Omit<Perfil, 'organizacion_nombre'> & { organizaciones: { nombre: string } | null };
        const { organizaciones, ...resto } = fila;
        const leido: Perfil = { ...resto, organizacion_nombre: organizaciones?.nombre ?? null };
        setPerfil(leido);
        AsyncStorage.setItem(CLAVES.perfil, JSON.stringify(leido)).catch(() => {});
        return;
      }
      // Sin conexión o con error: el último perfil guardado de esta cuenta (nunca se rebaja el rol a ciudadano
      // si ya se conocía); si no hay, los datos del registro.
      const guardado = await perfilGuardado(usuario.id);
      if (vigente) setPerfil((previo) => (previo?.id === usuario.id ? previo : guardado ?? perfilDelRegistro(usuario)));
    })();
    return () => { vigente = false; };
  }, [usuarioId]);

  const iniciarSesion: ValorSesion['iniciarSesion'] = async (correo, contrasena) => {
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim().toLowerCase(), password: contrasena });
    return error ? mensajeDeError(error) : null;
  };

  const registrarse: ValorSesion['registrarse'] = async (d) => {
    const { data, error } = await supabase.auth.signUp({
      email: d.correo.trim().toLowerCase(),
      password: d.contrasena,
      options: { data: { nombre: d.nombre.trim(), apellido: d.apellido.trim(), fecha_nacimiento: d.fechaNacimiento } },
    });
    if (error) return mensajeDeError(error);
    // Con "Confirm email" activo, un correo repetido devuelve un usuario sin identidades
    if (data.user && data.user.identities?.length === 0) return 'Ya existe una cuenta con ese correo.';
    // Después de registrarse se vuelve a Login, sin quedar con la sesión iniciada
    if (data.session) await supabase.auth.signOut();
    return null;
  };

  const recuperarContrasena: ValorSesion['recuperarContrasena'] = async (correo) => {
    const { error } = await supabase.auth.resetPasswordForEmail(correo.trim().toLowerCase());
    return error ? mensajeDeError(error) : null;
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    await AsyncStorage.removeItem(CLAVES.perfil).catch(() => {});
  };

  return (
    <SesionContexto.Provider value={{ sesion, perfil, cargando, iniciarSesion, registrarse, recuperarContrasena, cerrarSesion }}>
      {children}
    </SesionContexto.Provider>
  );
}

export const useSesion = () => useContext(SesionContexto);
