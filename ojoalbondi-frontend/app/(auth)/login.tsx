import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { Ayuda, Boton, Campo, Enlace, Etiqueta, Pantalla, Subtitulo, TextoError, Titulo } from '@/componentes/ui';
import { useSesion } from '@/contextos/SesionContexto';
import { useTema } from '@/contextos/TemaContexto';

// RF-02 · Inicio de sesión
export default function IniciarSesion() {
  const router = useRouter();
  const { iniciarSesion, recuperarContrasena } = useSesion();
  const { colores } = useTema();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const ingresar = async () => {
    if (!correo.trim() || !contrasena) {
      setError('Completá tu correo y tu contraseña.');
      return;
    }
    setEnviando(true);
    const mensaje = await iniciarSesion(correo, contrasena);
    setEnviando(false);
    if (mensaje) setError(mensaje);
    // si sale bien, la navegación por rol lleva a la pantalla que corresponde
  };

  const olvideMiContrasena = async () => {
    if (!correo.trim()) {
      setError('Escribí tu correo arriba y tocá de nuevo "¿Olvidaste tu contraseña?".');
      return;
    }
    const mensaje = await recuperarContrasena(correo);
    if (mensaje) setError(mensaje);
    else Alert.alert('Revisá tu correo', `Te enviamos un mail a ${correo.trim()} para restablecer tu contraseña.`);
  };

  return (
    <Pantalla>
      <Boton titulo="← Volver" variante="secundario" onPress={() => router.replace('/')} style={{ marginTop: 0 }} />
      <Titulo>Iniciar sesión</Titulo>
      <Subtitulo>Ingresá con tu cuenta para reclamar y ver el estado.</Subtitulo>

      <Etiqueta>Correo electrónico</Etiqueta>
      <Campo value={correo} onChangeText={(t) => { setCorreo(t); setError(''); }} placeholder="vos@ejemplo.com"
        keyboardType="email-address" autoCapitalize="none" autoComplete="email" accessibilityLabel="Correo electrónico" />
      <Etiqueta>Contraseña</Etiqueta>
      <Campo value={contrasena} onChangeText={(t) => { setContrasena(t); setError(''); }} placeholder="Tu contraseña"
        secureTextEntry autoComplete="password" onSubmitEditing={ingresar} accessibilityLabel="Contraseña" />
      {!!error && <TextoError>{error}</TextoError>}

      <Enlace onPress={olvideMiContrasena} style={{ textAlign: 'right', fontSize: 13 }}>¿Olvidaste tu contraseña?</Enlace>
      <Boton titulo="Iniciar sesión" onPress={ingresar} cargando={enviando} />

      <Pressable onPress={() => router.replace('/registro')} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center', marginTop: 8 }}>
        <Ayuda style={{ textAlign: 'center', marginTop: 0 }}>
          ¿No tenés cuenta? <Text style={{ color: colores.primario, fontWeight: '600' }}>Registrate</Text>
        </Ayuda>
      </Pressable>
    </Pantalla>
  );
}
