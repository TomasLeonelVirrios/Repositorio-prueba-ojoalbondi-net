import { Pressable, View } from 'react-native';
import { useTema } from '../../contextos/TemaContexto';
import { Punto } from '../../tipos';
import { Mapa } from './Mapa';

/** Vista previa chica (no interactiva) del punto elegido. */
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
        <Mapa
          // la clave fuerza a recentrar si cambia el punto
          key={`${punto.latitud},${punto.longitud}`}
          regionInicial={{ latitude: punto.latitud, longitude: punto.longitud, latitudeDelta: 0.004, longitudeDelta: 0.004 }}
          marcadores={[{ id: 'punto', latitud: punto.latitud, longitud: punto.longitud, pin: true }]}
          oscuro={tema === 'oscuro'}
          interactivo={false}
        />
      </View>
    </Pressable>
  );
}
