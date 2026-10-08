import { Text, View } from 'react-native';
import { useTema } from '../../contextos/TemaContexto';
import { EntradaHistorial } from '../../tipos';
import { fechaHoraArgentina } from '../../utilidades/fechas';
import { Insignia } from '../ui';

/** Seguimiento del reclamo: cada cambio de estado con responsable, fecha y comentario (RF-15). */
export function LineaDeTiempo({ historial }: { historial: EntradaHistorial[] }) {
  const { colores } = useTema();
  return (
    <View style={{ marginLeft: 8, paddingLeft: 16, borderLeftWidth: 2, borderLeftColor: colores.borde }}>
      {historial.map((h) => (
        <View key={h.id} style={{ paddingBottom: 14 }}>
          <View style={{ position: 'absolute', left: -23, top: 3, width: 12, height: 12, borderRadius: 6, backgroundColor: colores.primario }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Insignia tipo={h.estadoNuevo} />
            <Text style={{ fontSize: 11.5, color: colores.textoTenue }}>{fechaHoraArgentina(h.creadoEn)}</Text>
          </View>
          <Text style={{ fontSize: 13, color: colores.textoSecundario, marginTop: 4 }}>
            <Text style={{ fontWeight: '700', color: colores.texto }}>{h.responsableNombre}</Text>
            {h.comentario ? `: ${h.comentario}` : h.estadoNuevo === 'Recibido' ? ': reclamo recibido.' : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}
