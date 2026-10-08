import { Session } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
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

  // Perfil con rol y organización del usuario conectado
  useEffect(() => {
    if (!sesion) {
      setPerfil(null);
      return;
    }
    supabase
      .from('perfiles')
      .select('id, nombre, apellido, fecha_nacimiento, rol, organizacion_id, organizaciones(nombre)')
      .eq('id', sesion.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const fila = data as unknown as Omit<Perfil, 'organizacion_nombre'> & { organizaciones: { nombre: string } | null };
          const { organizaciones, ...resto } = fila;
          setPerfil({ ...resto, organizacion_nombre: organizaciones?.nombre ?? null });
          return;
        }
        // Sin conexión: se usan los datos del registro (el rol por defecto es ciudadano)
        const meta = sesion.user.user_metadata ?? {};
        setPerfil({
          id: sesion.user.id, nombre: meta.nombre ?? '', apellido: meta.apellido ?? '',
          fecha_nacimiento: meta.fecha_nacimiento ?? '', rol: 'ciudadano', organizacion_id: null, organizacion_nombre: null,
        });
      });
  }, [sesion]);

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
  };

  return (
    <SesionContexto.Provider value={{ sesion, perfil, cargando, iniciarSesion, registrarse, recuperarContrasena, cerrarSesion }}>
      {children}
    </SesionContexto.Provider>
  );
}

export const useSesion = () => useContext(SesionContexto);
