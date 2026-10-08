import { ActivityIndicator, Pressable, StyleProp, Text, ViewStyle } from 'react-native';
import { useTema } from '../../contextos/TemaContexto';

export type VarianteBoton = 'primario' | 'contorno' | 'peligro' | 'secundario';

export function Boton({ titulo, onPress, variante = 'primario', deshabilitado, cargando, style }: {
  titulo: string;
  onPress: () => void;
  variante?: VarianteBoton;
  deshabilitado?: boolean;
  cargando?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colores } = useTema();
  const estilos: Record<VarianteBoton, { fondo: string; texto: string; borde?: string }> = {
    primario: { fondo: colores.primario, texto: colores.sobrePrimario },
    contorno: { fondo: 'transparent', texto: colores.primario, borde: colores.primario },
    peligro: { fondo: colores.peligroSuave, texto: colores.peligro },
    secundario: { fondo: 'transparent', texto: colores.textoSecundario },
  };
  const e = estilos[variante];
  const esSecundario = variante === 'secundario';  // botón de texto subrayado (ej. "← Volver")
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado || cargando}
      hitSlop={esSecundario ? { top: 6, bottom: 6 } : undefined}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!deshabilitado, busy: !!cargando }}
      style={({ pressed }) => [
        {
          width: esSecundario ? undefined : '100%',
          paddingVertical: esSecundario ? 8 : 13, paddingHorizontal: esSecundario ? 0 : 13,
          borderRadius: 12, backgroundColor: e.fondo, borderWidth: e.borde ? 1.5 : 0, borderColor: e.borde,
          marginTop: esSecundario ? 8 : 18, alignItems: esSecundario ? 'flex-start' : 'center',
          opacity: deshabilitado ? 0.45 : 1, transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={e.texto} />
      ) : (
        <Text style={{
          color: e.texto, fontSize: esSecundario ? 13.5 : 15, fontWeight: esSecundario ? '600' : '700',
          textDecorationLine: esSecundario ? 'underline' : 'none',
        }}>
          {titulo}
        </Text>
      )}
    </Pressable>
  );
}
