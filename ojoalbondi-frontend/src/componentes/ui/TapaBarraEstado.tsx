import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTema } from '../../contextos/TemaContexto';

/**
 * Franja fija del color del Encabezado detrás de la barra de estado del celular.
 * Va después del ScrollView o FlatList de la pantalla: al desplazar, el Encabezado pasa por debajo
 * en vez de quedar encimado con la hora y los íconos del sistema.
 * Mientras la pantalla está a la vista, los íconos de la barra van claros (la franja es oscura en los dos temas);
 * al salir vuelve el estilo general de app/_layout.tsx.
 */
export function TapaBarraEstado() {
  const { colores } = useTema();
  const { top } = useSafeAreaInsets();
  const enFoco = useIsFocused();
  return (
    <>
      {enFoco && <StatusBar style="light" />}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: top, backgroundColor: colores.primarioOscuro }} />
    </>
  );
}
