import { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useTema } from '../../contextos/TemaContexto';

export type TipoAviso = 'advertencia' | 'exito' | 'peligro';

/** Banda de aviso (sin conexión, sincronización, 911). */
export function Aviso({ tipo, children }: { tipo: TipoAviso; children: ReactNode }) {
  const { colores } = useTema();
  const [fondo, color] = {
    advertencia: [colores.advertenciaSuave, colores.advertencia],
    exito: [colores.exitoSuave, colores.exito],
    peligro: [colores.peligroSuave, colores.peligro],
  }[tipo];
  return (
    <View accessibilityRole="alert" style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, marginBottom: 14, backgroundColor: fondo }}>
      <Text style={{ fontSize: 12.5, fontWeight: '600', color }}>{children}</Text>
    </View>
  );
}
