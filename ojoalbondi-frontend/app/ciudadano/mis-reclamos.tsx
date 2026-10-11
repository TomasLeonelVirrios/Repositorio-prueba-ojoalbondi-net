import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { TarjetaReclamo } from '@/componentes/reclamos/TarjetaReclamo';
import { Aviso, Boton, Pantalla, Tarjeta, TextoError, Titulo } from '@/componentes/ui';
import { useConexion } from '@/contextos/ConexionContexto';
import { useTema } from '@/contextos/TemaContexto';
import { listarMisReclamos } from '@/servicios/reclamos';
import { Borrador, ReclamoResumen } from '@/tipos';
import { fechaHoraArgentina } from '@/utilidades/fechas';

// RF-05 · Todos los reclamos del ciudadano
export default function MisReclamos() {
  const { colores } = useTema();
  const { borradoresPendientes, borradoresSincronizados, borradoresConError, actualizarPendientes, reintentar, descartar } = useConexion();
  const [reclamos, setReclamos] = useState<ReclamoResumen[] | null>(null);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    actualizarPendientes();
    listarMisReclamos()
      .then((lista) => { setReclamos(lista); setError(''); })
      .catch(() => { setReclamos((r) => r ?? []); setError('No se pudieron cargar tus reportes. Revisá tu conexión.'); });
  }, [borradoresSincronizados]));

  const confirmarDescarte = (b: Borrador) =>
    Alert.alert('Descartar borrador', 'El reporte no se va a enviar y se borra del celular.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => descartar(b.idLocal) },
    ]);

  return (
    <Pantalla>
      <Titulo>Mis reportes</Titulo>
      {borradoresPendientes > 0 && <Aviso tipo="advertencia">{borradoresPendientes} borrador(es) esperando conexión para enviarse.</Aviso>}

      {/* Borradores que la base rechazó: ya no se reintentan solos */}
      {borradoresConError.map((b) => (
        <Tarjeta key={b.idLocal}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colores.texto }}>Borrador sin enviar · Línea {b.datos.linea}</Text>
          <Text style={{ fontSize: 12, color: colores.textoSecundario, marginTop: 2 }}>Hecho del {fechaHoraArgentina(b.datos.fechaHoraHecho)}</Text>
          <TextoError>{b.error}</TextoError>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Boton titulo="Reintentar" variante="secundario" onPress={() => reintentar(b.idLocal)} style={{ flex: 1 }} />
            <Boton titulo="Descartar" variante="peligro" onPress={() => confirmarDescarte(b)} style={{ flex: 1 }} />
          </View>
        </Tarjeta>
      ))}
      {!!error && <TextoError>{error}</TextoError>}

      {reclamos === null ? (
        <ActivityIndicator color={colores.primario} style={{ marginTop: 30 }} />
      ) : reclamos.length === 0 ? (
        <Text style={{ textAlign: 'center', paddingVertical: 50, paddingHorizontal: 20, color: colores.textoTenue, lineHeight: 20 }}>
          Todavía no hiciste ningún reporte.{'\n'}Tocá "Reportar" abajo para crear el primero.
        </Text>
      ) : (
        reclamos.map((r) => <TarjetaReclamo key={r.id} reclamo={r} />)
      )}
    </Pantalla>
  );
}
