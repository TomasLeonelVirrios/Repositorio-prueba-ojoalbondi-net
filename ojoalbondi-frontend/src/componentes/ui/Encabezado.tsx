import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTema } from '../../contextos/TemaContexto';

/** Banda superior oscura de Ajustes y Bandeja. */
export function Encabezado({ antetitulo, titulo, detalle }: { antetitulo: string; titulo: string; detalle?: string | null }) {
  const { colores } = useTema();
  const margenes = useSafeAreaInsets();
  return (
    <View style={{
      backgroundColor: colores.primarioOscuro, paddingTop: margenes.top + 22, paddingHorizontal: 20, paddingBottom: 20,
      borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
    }}>
      <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: '#FFFFFF', opacity: 0.85 }}>{antetitulo}</Text>
      <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginTop: 2 }}>{titulo}</Text>
      {!!detalle && <Text style={{ fontSize: 12.5, color: '#FFFFFF', opacity: 0.85, marginTop: 6 }}>{detalle}</Text>}
    </View>
  );
}
