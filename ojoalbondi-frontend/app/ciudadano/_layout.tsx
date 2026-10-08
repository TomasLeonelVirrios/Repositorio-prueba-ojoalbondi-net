import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTema } from '@/contextos/TemaContexto';

// Pestañas del ciudadano
export default function PestaniasCiudadano() {
  const { colores } = useTema();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colores.primario,
      tabBarInactiveTintColor: colores.textoTenue,
      tabBarStyle: { backgroundColor: colores.superficie, borderTopColor: colores.borde },
      tabBarLabelStyle: { fontSize: 10.5, fontWeight: '600' },
      sceneStyle: { backgroundColor: colores.fondo },
    }}>
      <Tabs.Screen name="inicio" options={{ title: 'Reportar', tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-done-outline" color={color} size={size - 3} /> }} />
      <Tabs.Screen name="mapa" options={{ title: 'Mapa', tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" color={color} size={size - 3} /> }} />
      <Tabs.Screen name="mis-reclamos" options={{ title: 'Mis reportes', tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" color={color} size={size - 3} /> }} />
      <Tabs.Screen name="ajustes" options={{ title: 'Ajustes', tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size - 3} /> }} />
    </Tabs>
  );
}
