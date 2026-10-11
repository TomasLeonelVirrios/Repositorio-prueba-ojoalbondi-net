import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Text, View } from 'react-native';
import { Boton, Insignia, Pantalla, Subtitulo, Tarjeta, Titulo } from '@/componentes/ui';
import { useTema } from '@/contextos/TemaContexto';

export type ParametrosReclamoEnviado = {
  ticket?: string;          // vacío si quedó como borrador
  linea: string;
  motivo: string;
  horario: string;
  ubicacion: string;
  esBorrador?: '1';
  fotoUri?: string;         // vista previa de la foto adjunta
};

// RF-04 · Confirmación del reclamo
export default function ReclamoEnviado() {
  const router = useRouter();
  const { colores } = useTema();
  const p = useLocalSearchParams<ParametrosReclamoEnviado>();
  const esBorrador = p.esBorrador === '1';

  const Fila = ({ dato, valor }: { dato: string; valor?: string }) => (
    <Text style={{ marginVertical: 2, fontSize: 13, color: colores.texto }}><Text style={{ fontWeight: '700' }}>{dato}:</Text> {valor}</Text>
  );

  return (
    <Pantalla centrado>
      <View style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: colores.exitoSuave, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 28 }}>✅</Text>
      </View>
      <Titulo style={{ textAlign: 'center' }}>{esBorrador ? 'Guardado como borrador' : 'Reporte enviado'}</Titulo>
      <Subtitulo style={{ textAlign: 'center' }}>
        {esBorrador ? 'Sin conexión: se va a enviar solo cuando vuelva la señal.' : `Ticket N° ${p.ticket}`}
      </Subtitulo>

      <Tarjeta style={{ width: '100%', maxWidth: 320 }}>
        <Fila dato="Línea" valor={p.linea} />
        <Fila dato="Motivo" valor={p.motivo} />
        <Fila dato="Horario del hecho" valor={p.horario} />
        <Fila dato="Ubicación" valor={p.ubicacion} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Text style={{ fontSize: 13, color: colores.texto, fontWeight: '700' }}>Estado:</Text>
          {esBorrador ? <Insignia tipo="Borrador" texto="Borrador local" /> : <Insignia tipo="Recibido" />}
        </View>
        {!!p.fotoUri && (
          <Image source={{ uri: p.fotoUri }} style={{ width: '100%', height: 180, borderRadius: 12, marginTop: 10 }}
            resizeMode="cover" accessibilityLabel="Foto adjunta al reporte" />
        )}
      </Tarjeta>

      <Boton titulo="Ver mis reportes" onPress={() => router.replace('/ciudadano/mis-reclamos')} style={{ maxWidth: 280 }} />
    </Pantalla>
  );
}
