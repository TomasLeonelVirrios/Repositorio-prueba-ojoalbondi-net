import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTema } from '../../contextos/TemaContexto';

/**
 * Franja fija del color del Encabezado detrás de la barra de estado del celular.
 * Va después del ScrollView o FlatList de la pantalla: al desplazar, el Encabezado pasa por debajo
 * en vez de quedar encimado con la hora y los íconos del sistema.
 */
export function TapaBarraEstado() {
  const { colores } = useTema();
  const { top } = useSafeAreaInsets();
  return <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: top, backgroundColor: colores.primarioOscuro }} />;
}
