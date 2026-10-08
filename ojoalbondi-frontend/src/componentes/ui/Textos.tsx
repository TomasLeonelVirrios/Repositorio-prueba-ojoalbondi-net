import { ReactNode } from 'react';
import { Pressable, StyleProp, Text, TextStyle } from 'react-native';
import { useTema } from '../../contextos/TemaContexto';

type PropsTexto = { children: ReactNode; style?: StyleProp<TextStyle> };

export function Titulo({ children, style }: PropsTexto) {
  const { colores } = useTema();
  return <Text accessibilityRole="header" style={[{ fontSize: 22, fontWeight: '700', color: colores.texto, marginVertical: 4 }, style]}>{children}</Text>;
}

export function Subtitulo({ children, style }: PropsTexto) {
  const { colores } = useTema();
  return <Text style={[{ fontSize: 14, color: colores.textoSecundario, marginBottom: 20, lineHeight: 20 }, style]}>{children}</Text>;
}

export function Seccion({ children, style }: PropsTexto) {
  const { colores } = useTema();
  return <Text accessibilityRole="header" style={[{ fontSize: 15, fontWeight: '700', color: colores.texto, marginTop: 18, marginBottom: 8 }, style]}>{children}</Text>;
}

/** Rótulo de un campo de formulario. */
export function Etiqueta({ children, style }: PropsTexto) {
  const { colores } = useTema();
  return <Text style={[{ fontSize: 12.5, color: colores.textoSecundario, marginTop: 12, marginBottom: 5, fontWeight: '600' }, style]}>{children}</Text>;
}

export function Ayuda({ children, style }: PropsTexto) {
  const { colores } = useTema();
  return <Text style={[{ color: colores.textoTenue, fontSize: 12, marginTop: 6, lineHeight: 17 }, style]}>{children}</Text>;
}

export function TextoError({ children }: { children: ReactNode }) {
  const { colores } = useTema();
  return <Text accessibilityRole="alert" style={{ color: colores.peligro, fontSize: 12.5, marginTop: 8 }}>{children}</Text>;
}

/** Enlace suelto, con área táctil de al menos 44 pt (RNF-06). */
export function Enlace({ children, onPress, style }: PropsTexto & { onPress: () => void }) {
  const { colores } = useTema();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={[{ color: colores.primario, fontWeight: '600' }, style]}>{children}</Text>
    </Pressable>
  );
}
