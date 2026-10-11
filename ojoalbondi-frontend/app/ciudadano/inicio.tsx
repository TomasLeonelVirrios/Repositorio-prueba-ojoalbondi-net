import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { TarjetaReclamo } from '@/componentes/reclamos/TarjetaReclamo';
import { Aviso, Boton, Pantalla, Seccion, Tarjeta, Titulo } from '@/componentes/ui';
import { useConexion } from '@/contextos/ConexionContexto';
import { useSesion } from '@/contextos/SesionContexto';
import { useTema } from '@/contextos/TemaContexto';
import { listarMisReclamos } from '@/servicios/reclamos';
import { ReclamoResumen } from '@/tipos';

const CANTIDAD_ULTIMOS = 3;

// RF-05 · Inicio del ciudadano: saludo, acceso a nuevo reclamo y últimos reclamos
export default function Inicio() {
  const router = useRouter();
  const { colores } = useTema();
  const { perfil } = useSesion();
  const { conectado, borradoresSincronizados } = useConexion();
  const [ultimos, setUltimos] = useState<ReclamoResumen[] | null>(null);

  useFocusEffect(useCallback(() => {
    listarMisReclamos(CANTIDAD_ULTIMOS).then(setUltimos).catch(() => setUltimos((u) => u ?? []));
  }, [borradoresSincronizados]));

  return (
    <Pantalla>
      {!conectado && <Aviso tipo="advertencia">📴 Sin conexión: los reclamos se guardan en el celular y se envían solos al volver la señal.</Aviso>}
      {conectado && borradoresSincronizados > 0 && <Aviso tipo="exito">✅ {borradoresSincronizados} borrador(es) enviado(s).</Aviso>}

      <Text style={{ fontSize: 12, color: colores.textoSecundario, fontWeight: '600' }}>Hola,</Text>
      <Titulo style={{ marginTop: 0 }}>{perfil?.nombre ?? ''}</Titulo>

      <Boton titulo="＋ Crear reporte" onPress={() => router.push('/nuevo-reclamo')} style={{ marginTop: 14 }} />

      <Seccion>Últimos reportes</Seccion>
      {ultimos === null ? (
        <ActivityIndicator color={colores.primario} />
      ) : ultimos.length === 0 ? (
        <Tarjeta><Text style={{ textAlign: 'center', color: colores.textoTenue, fontSize: 13 }}>Todavía no hiciste ningún reporte.</Text></Tarjeta>
      ) : (
        ultimos.map((r) => <TarjetaReclamo key={r.id} reclamo={r} />)
      )}
    </Pantalla>
  );
}
