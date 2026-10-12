import { Pressable, View, ViewStyle } from 'react-native';
import { useTema } from '../../contextos/TemaContexto';
import { Punto } from '../../tipos';
import { Mapa } from './Mapa';

/**
 * Vista previa chica (no interactiva) del punto elegido.
 * Sin onPress es solo para ver (detalle de la empresa): va en un View, así no figura como tocable.
 */
export function MiniMapa({ punto, onPress }: { punto: Punto; onPress?: () => void }) {
  const { colores, tema } = useTema();
  const marco: ViewStyle = { height: 140, borderRadius: 12, overflow: 'hidden', borderWidth: 1.3, borderColor: colores.borde, marginTop: 8 };
  const mapa = (
    <View pointerEvents="none" style={{ flex: 1 }}>
      <Mapa
        // la clave fuerza a recentrar si cambia el punto
        key={`${punto.latitud},${punto.longitud}`}
        regionInicial={{ latitude: punto.latitud, longitude: punto.longitud, latitudeDelta: 0.004, longitudeDelta: 0.004 }}
        marcadores={[{ id: 'punto', latitud: punto.latitud, longitud: punto.longitud, pin: true }]}
        oscuro={tema === 'oscuro'}
        interactivo={false}
      />
    </View>
  );
  if (!onPress) {
    return <View accessible accessibilityRole="image" accessibilityLabel="Mapa con la ubicación del reclamo" style={marco}>{mapa}</View>;
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Cambiar la parada en el mapa" style={marco}>
      {mapa}
    </Pressable>
  );
}
