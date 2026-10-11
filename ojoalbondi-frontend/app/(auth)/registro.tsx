import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { CampoFecha } from '@/componentes/formulario/CampoFecha';
import { Boton, Campo, Etiqueta, Pantalla, TextoError, Titulo } from '@/componentes/ui';
import { DatosRegistro, useSesion } from '@/contextos/SesionContexto';

const LARGO_MINIMO_CONTRASENA = 6;
const FORMULARIO_VACIO = { nombre: '', apellido: '', fechaNacimiento: '', correo: '', contrasena: '', repetirContrasena: '' };

// RF-01 · Registro de ciudadano
export default function Registro() {
  const router = useRouter();
  const { registrarse } = useSesion();
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cambiar = (campo: keyof typeof FORMULARIO_VACIO) => (valor: string) => {
    setFormulario((f) => ({ ...f, [campo]: valor }));
    setError('');
  };

  const registrar = async () => {
    const f = formulario;
    if (Object.values(f).some((v) => !v.trim())) return setError('Completá todos los campos.');
    if (f.contrasena.length < LARGO_MINIMO_CONTRASENA) return setError(`La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`);
    if (f.contrasena !== f.repetirContrasena) return setError('Las contraseñas no coinciden.');

    setEnviando(true);
    const datos: DatosRegistro = { nombre: f.nombre, apellido: f.apellido, fechaNacimiento: f.fechaNacimiento, correo: f.correo, contrasena: f.contrasena };
    const mensaje = await registrarse(datos);
    setEnviando(false);
    if (mensaje) return setError(mensaje);
    Alert.alert('Cuenta creada', 'Ya podés iniciar sesión. Si te llega un mail de confirmación, abrilo primero.');
    router.replace('/login');
  };

  return (
    <Pantalla>
      <Boton titulo="← Volver" variante="secundario" onPress={() => router.replace('/')} style={{ marginTop: 0 }} />
      <Titulo>Crear cuenta</Titulo>

      <Etiqueta>Nombre</Etiqueta>
      <Campo value={formulario.nombre} onChangeText={cambiar('nombre')} autoComplete="given-name" accessibilityLabel="Nombre" />
      <Etiqueta>Apellido</Etiqueta>
      <Campo value={formulario.apellido} onChangeText={cambiar('apellido')} autoComplete="family-name" accessibilityLabel="Apellido" />
      <Etiqueta>Fecha de nacimiento</Etiqueta>
      <CampoFecha valor={formulario.fechaNacimiento} onCambiar={cambiar('fechaNacimiento')} />
      <Etiqueta>Correo electrónico</Etiqueta>
      <Campo value={formulario.correo} onChangeText={cambiar('correo')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" accessibilityLabel="Correo electrónico" />
      <Etiqueta>Contraseña</Etiqueta>
      <Campo value={formulario.contrasena} onChangeText={cambiar('contrasena')} secureTextEntry autoComplete="new-password" accessibilityLabel="Contraseña" />
      <Etiqueta>Repetir contraseña</Etiqueta>
      <Campo value={formulario.repetirContrasena} onChangeText={cambiar('repetirContrasena')} secureTextEntry autoComplete="new-password" accessibilityLabel="Repetir contraseña" />

      {!!error && <TextoError>{error}</TextoError>}
      <Boton titulo="Registrarme" onPress={registrar} cargando={enviando} />
    </Pantalla>
  );
}
