import { Pressable, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useTema } from '../../contextos/TemaContexto';
import { Punto } from '../../tipos';

/** Vista previa chica (no interactiva) del punto elegido, para el formulario. */
export function MiniMapa({ punto, onPress }: { punto: Punto; onPress: () => void }) {
  const { colores, tema } = useTema();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Cambiar la parada en el mapa"
      style={{ height: 140, borderRadius: 12, overflow: 'hidden', borderWidth: 1.3, borderColor: colores.borde, marginTop: 8 }}
    >
      <View pointerEvents="none" style={{ flex: 1 }}>
        <MapView
          style={{ flex: 1 }}
          region={{ latitude: punto.latitud, longitude: punto.longitud, latitudeDelta: 0.004, longitudeDelta: 0.004 }}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          liteMode
          userInterfaceStyle={tema === 'oscuro' ? 'dark' : 'light'}
        >
          <Marker coordinate={{ latitude: punto.latitud, longitude: punto.longitud }} pinColor={colores.peligro} />
        </MapView>
      </View>
    </Pressable>
  );
}
