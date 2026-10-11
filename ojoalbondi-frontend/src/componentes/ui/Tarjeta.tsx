import { ReactNode } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { useTema } from '../../contextos/TemaContexto';

export function Tarjeta({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { colores } = useTema();
  const estilo: StyleProp<ViewStyle> = [
    { backgroundColor: colores.superficie, borderWidth: 1, borderColor: colores.borde, borderRadius: 14, padding: 14, marginBottom: 10 },
    style,
  ];
  return onPress
    ? <Pressable onPress={onPress} accessibilityRole="button" style={estilo}>{children}</Pressable>
    : <View style={estilo}>{children}</View>;
}
