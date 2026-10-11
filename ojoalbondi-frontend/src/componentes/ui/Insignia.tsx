import { Text, View } from 'react-native';
import { useTema } from '../../contextos/TemaContexto';
import { Estado } from '../../tipos';

type TipoInsignia = Estado | 'Borrador' | 'Demorado';

/** Etiqueta de color para estados y marcas. */
export function Insignia({ tipo, texto }: { tipo: TipoInsignia; texto?: string }) {
  const { colores } = useTema();
  const [fondo, color] = {
    'Recibido': [colores.advertenciaSuave, colores.advertencia],
    'En revisión': [colores.primarioSuave, colores.primario],
    'Atendido': [colores.exitoSuave, colores.exito],
    'Anulado': [colores.borde, colores.textoSecundario],
    'Borrador': [colores.borde, colores.textoSecundario],
    'Demorado': [colores.advertenciaSuave, colores.advertencia],
  }[tipo];
  return (
    <View style={{ alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20, backgroundColor: fondo }}>
      <Text style={{ fontSize: 11.5, fontWeight: '700', color }}>{texto ?? tipo}</Text>
    </View>
  );
}
