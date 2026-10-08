import { Pressable, Text } from 'react-native';
import { useTema } from '../../contextos/TemaContexto';

/** Opción seleccionable (motivos, filtros). */
export function Chip({ texto, seleccionado, conAlerta, onPress }: {
  texto: string;
  seleccionado: boolean;
  conAlerta?: boolean;
  onPress: () => void;
}) {
  const { colores } = useTema();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: seleccionado }}
      hitSlop={{ top: 6, bottom: 6 }}
      style={{
        paddingVertical: 7, paddingHorizontal: 13, borderRadius: 16, borderWidth: 1.3,
        borderColor: seleccionado ? colores.primario : colores.borde,
        backgroundColor: seleccionado ? colores.primario : colores.superficie,
      }}
    >
      <Text style={{ fontSize: 13, color: seleccionado ? colores.sobrePrimario : colores.texto }}>
        {texto}{conAlerta ? ' ⚠' : ''}
      </Text>
    </Pressable>
  );
}
