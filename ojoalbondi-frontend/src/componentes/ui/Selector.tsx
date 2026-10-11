import { useState } from 'react';
import { FlatList, Pressable, StyleProp, Text, ViewStyle } from 'react-native';
import { useTema } from '../../contextos/TemaContexto';
import { HojaModal } from './HojaModal';
import { Seccion } from './Textos';

/** Reemplazo táctil del <select>: muestra el valor y abre una hoja con las opciones. */
export function Selector({ valor, opciones, textoVacio, titulo, onCambiar, deshabilitado, style }: {
  valor: string;
  opciones: string[];
  textoVacio: string;
  titulo?: string;
  onCambiar: (opcion: string) => void;
  deshabilitado?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colores } = useTema();
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setAbierto(true)}
        disabled={deshabilitado}
        accessibilityRole="button"
        accessibilityLabel={titulo ?? textoVacio}
        accessibilityState={{ disabled: !!deshabilitado }}
        style={[
          deshabilitado && { opacity: 0.5 },
          {
            paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.3, borderColor: colores.borde,
            backgroundColor: colores.superficie, flexDirection: 'row', justifyContent: 'space-between',
          },
          style,
        ]}
      >
        <Text style={{ fontSize: 14.5, color: valor ? colores.texto : colores.textoTenue }}>{valor || textoVacio}</Text>
        <Text style={{ color: colores.textoTenue }}>▾</Text>
      </Pressable>
      <HojaModal visible={abierto} onCerrar={() => setAbierto(false)}>
        {titulo && <Seccion style={{ marginTop: 0 }}>{titulo}</Seccion>}
        <FlatList
          data={opciones}
          keyExtractor={(o) => o}
          style={{ maxHeight: 360 }}
          renderItem={({ item }) => {
            const elegido = item === valor;
            return (
              <Pressable
                onPress={() => { onCambiar(item); setAbierto(false); }}
                style={{ paddingVertical: 13, paddingHorizontal: 12, borderRadius: 10, backgroundColor: elegido ? colores.primarioSuave : 'transparent' }}
              >
                <Text style={{ fontSize: 15, color: elegido ? colores.primario : colores.texto, fontWeight: elegido ? '700' : '400' }}>{item}</Text>
              </Pressable>
            );
          }}
        />
      </HojaModal>
    </>
  );
}
