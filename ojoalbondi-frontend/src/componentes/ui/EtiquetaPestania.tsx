import { ColorValue, Text } from 'react-native';

/**
 * Etiqueta de las pestañas de abajo. Con la letra grande del celular se achica hasta que entra entera,
 * en vez de cortarse ("Mis repo…"). Respeta el tamaño elegido hasta 1,6 veces (RNF-06).
 */
export function EtiquetaPestania({ color, children }: { color: ColorValue; children: string }) {
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      maxFontSizeMultiplier={1.6}
      style={{ color, fontSize: 10.5, fontWeight: '600' }}
    >
      {children}
    </Text>
  );
}
