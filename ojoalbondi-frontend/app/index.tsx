import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Boton, Pantalla, Subtitulo, Titulo } from '@/componentes/ui';
import { useTema } from '@/contextos/TemaContexto';

export default function Bienvenida() {
  const router = useRouter();
  const { colores } = useTema();
  return (
    <Pantalla centrado desplazable={false}>
      <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: colores.primario, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 30 }}>🚌</Text>
      </View>
      <Titulo style={{ marginTop: 14 }}>Ojo al Bondi</Titulo>
      <Subtitulo style={{ textAlign: 'center' }}>Reportá problemas de transporte en Pilar</Subtitulo>
      <View style={{ width: '100%', maxWidth: 280 }}>
        <Boton titulo="Iniciar sesión" onPress={() => router.push('/login')} />
        <Boton titulo="Registrarme" variante="contorno" onPress={() => router.push('/registro')} />
      </View>
    </Pantalla>
  );
}
