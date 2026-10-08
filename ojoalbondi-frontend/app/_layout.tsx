import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProveedorConexion } from '@/contextos/ConexionContexto';
import { esAdministrador, esInstitucion, ProveedorSesion, useSesion } from '@/contextos/SesionContexto';
import { ProveedorTema, useTema } from '@/contextos/TemaContexto';

// Rutas que puede ver cada perfil (RF-10). Se comparan con el primer segmento de la ruta.
const RUTAS_PUBLICAS = ['index', '(auth)'];
const RUTAS_CIUDADANO = ['ciudadano', 'nuevo-reclamo', 'reclamo-enviado'];
const RUTAS_INSTITUCION = ['institucion', 'gestion'];
const RUTAS_ADMINISTRADOR = ['admin'];

/** Lleva a cada usuario a la interfaz de su perfil y le impide entrar a las de los otros. */
function Navegacion() {
  const { sesion, perfil, cargando } = useSesion();
  const { colores, tema } = useTema();
  const segmentos = useSegments();
  const router = useRouter();

  // El rol se conoce cuando el perfil corresponde a la sesión actual
  const perfilListo = !sesion || perfil?.id === sesion.user.id;
  const institucion = esInstitucion(perfil);
  const administrador = esAdministrador(perfil);

  useEffect(() => {
    if (cargando || !perfilListo) return;
    const ruta = segmentos[0] ?? 'index';
    if (!sesion) {
      if (!RUTAS_PUBLICAS.includes(ruta)) router.replace('/');
    } else if (administrador) {
      if (!RUTAS_ADMINISTRADOR.includes(ruta)) router.replace('/admin/suscripciones');
    } else if (institucion) {
      if (!RUTAS_INSTITUCION.includes(ruta)) router.replace('/institucion/bandeja');
    } else if (!RUTAS_CIUDADANO.includes(ruta)) {
      router.replace('/ciudadano/inicio');
    }
  }, [sesion, perfilListo, institucion, administrador, cargando, segmentos]);

  if (cargando || !perfilListo) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colores.fondo }}>
        <ActivityIndicator color={colores.primario} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={tema === 'oscuro' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colores.fondo }, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="ciudadano" />
        <Stack.Screen name="nuevo-reclamo" />
        <Stack.Screen name="reclamo-enviado" options={{ gestureEnabled: false }} />
        <Stack.Screen name="institucion" />
        <Stack.Screen name="gestion/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="admin" />
      </Stack>
    </>
  );
}

export default function RaizApp() {
  return (
    <SafeAreaProvider>
      <ProveedorTema>
        <ProveedorSesion>
          <ProveedorConexion>
            <Navegacion />
          </ProveedorConexion>
        </ProveedorSesion>
      </ProveedorTema>
    </SafeAreaProvider>
  );
}
