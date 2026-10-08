import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { TarjetaReclamo } from '@/componentes/reclamos/TarjetaReclamo';
import { Aviso, Pantalla, TextoError, Titulo } from '@/componentes/ui';
import { useConexion } from '@/contextos/ConexionContexto';
import { useTema } from '@/contextos/TemaContexto';
import { listarMisReclamos } from '@/servicios/reclamos';
import { ReclamoResumen } from '@/tipos';

// RF-05 · Todos los reclamos del ciudadano
export default function MisReclamos() {
  const { colores } = useTema();
  const { borradoresPendientes, borradoresSincronizados, actualizarPendientes } = useConexion();
  const [reclamos, setReclamos] = useState<ReclamoResumen[] | null>(null);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    actualizarPendientes();
    listarMisReclamos()
      .then((lista) => { setReclamos(lista); setError(''); })
      .catch(() => { setReclamos((r) => r ?? []); setError('No se pudieron cargar tus reportes. Revisá tu conexión.'); });
  }, [borradoresSincronizados]));

  return (
    <Pantalla>
      <Titulo>Mis reportes</Titulo>
      {borradoresPendientes > 0 && <Aviso tipo="advertencia">{borradoresPendientes} borrador(es) esperando conexión para enviarse.</Aviso>}
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
