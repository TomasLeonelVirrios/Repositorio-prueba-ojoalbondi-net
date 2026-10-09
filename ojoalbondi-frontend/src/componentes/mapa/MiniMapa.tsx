import { Pressable, View } from 'react-native';
import { useTema } from '../../contextos/TemaContexto';
import { Punto } from '../../tipos';
import { MapaOSM } from './MapaOSM';

/** Vista previa chica (no interactiva) del punto elegido, para el formulario. */
export function MiniMapa({ punto, onPress }: { punto: Punto; onPress: () => void }) {
  const { colores } = useTema();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Cambiar la parada en el mapa"
      style={{ height: 140, borderRadius: 12, overflow: 'hidden', borderWidth: 1.3, borderColor: colores.borde, marginTop: 8 }}
    >
      <View pointerEvents="none" style={{ flex: 1 }}>
        <MapaOSM
          style={{ flex: 1 }}
          regionInicial={{ latitude: punto.latitud, longitude: punto.longitud, latitudeDelta: 0.004, longitudeDelta: 0.004 }}
          puntoBuscado={punto}
          interactive={false}
          zoom={16}
        />
      </View>
    </Pressable>
  );
}
