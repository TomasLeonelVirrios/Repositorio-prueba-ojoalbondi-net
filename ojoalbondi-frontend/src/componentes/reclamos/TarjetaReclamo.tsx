import { Text, View } from 'react-native';
import { useTema } from '../../contextos/TemaContexto';
import { estaDemorado } from '../../servicios/gestion';
import { ReclamoResumen } from '../../tipos';
import { antiguedad, fechaArgentina } from '../../utilidades/fechas';
import { Insignia, Tarjeta } from '../ui';

/**
 * Reclamo en un listado.
 * - Ciudadano: ticket, línea, motivo, fecha del hecho y estado.
 * - Institución (conGestion): además antigüedad, marca "+7 días" y borde de color si es grave o está demorado.
 */
export function TarjetaReclamo({ reclamo, conGestion = false, onPress }: {
  reclamo: ReclamoResumen;
  conGestion?: boolean;
  onPress?: () => void;
}) {
  const { colores } = useTema();
  const demorado = conGestion && estaDemorado(reclamo);
  const graveYPendiente = conGestion && reclamo.esGrave && (reclamo.estado === 'Recibido' || reclamo.estado === 'En revisión');
  const borde = graveYPendiente ? colores.peligro : demorado ? colores.advertencia : null;

  return (
    <Tarjeta onPress={onPress} style={borde ? { borderLeftWidth: 4, borderLeftColor: borde } : undefined}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ fontSize: 13.5, fontWeight: '700', color: colores.texto, flexShrink: 1 }}>
          N° {reclamo.ticket} · Línea {reclamo.linea}
        </Text>
        <Text style={{ fontSize: 11.5, color: colores.textoTenue }}>
          {conGestion ? antiguedad(reclamo.creadoEn) : fechaArgentina(reclamo.fechaHoraHecho)}
        </Text>
      </View>
      <Text style={{ marginVertical: 6, fontSize: 13, color: colores.textoSecundario }}>
        {reclamo.motivoDescripcion}{conGestion ? ` · ${fechaArgentina(reclamo.fechaHoraHecho)}` : ''}
      </Text>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Insignia tipo={reclamo.estado} />
        {demorado && <Insignia tipo="Demorado" texto="+7 días" />}
      </View>
    </Tarjeta>
  );
}
