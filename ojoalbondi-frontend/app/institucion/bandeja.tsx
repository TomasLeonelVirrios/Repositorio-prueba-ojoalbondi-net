import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { TarjetaReclamo } from '@/componentes/reclamos/TarjetaReclamo';
import { Encabezado, TextoError } from '@/componentes/ui';
import { ESTADOS } from '@/constantes/estados';
import { useSesion } from '@/contextos/SesionContexto';
import { useTema } from '@/contextos/TemaContexto';
import { contarPorEstado, lineasHabilitadas, listarBandeja, TAMANIO_PAGINA_BANDEJA } from '@/servicios/gestion';
import { Estado, ReclamoResumen } from '@/tipos';

// RF-11 · Bandeja de reclamos de la empresa o el municipio
export default function Bandeja() {
  const router = useRouter();
  const { colores } = useTema();
  const { perfil } = useSesion();

  const [soloPendientes, setSoloPendientes] = useState(true);
  const [reclamos, setReclamos] = useState<ReclamoResumen[]>([]);
  const [pagina, setPagina] = useState(0);
  const [hayMas, setHayMas] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState('');
  const [cuentas, setCuentas] = useState<Record<Estado, number> | null>(null);
  const [lineas, setLineas] = useState<string[] | null>(null);

  useEffect(() => {
    if (perfil?.rol === 'empresa') lineasHabilitadas().then(setLineas).catch(() => setLineas([]));
  }, [perfil]);

  const cargar = useCallback(async (desdeElPrincipio: boolean) => {
    const siguiente = desdeElPrincipio ? 0 : pagina + 1;
    try {
      const nuevos = await listarBandeja(siguiente, soloPendientes);
      setReclamos((previos) => (desdeElPrincipio ? nuevos : [...previos, ...nuevos]));
      setPagina(siguiente);
      setHayMas(nuevos.length === TAMANIO_PAGINA_BANDEJA);
      setError('');
      if (desdeElPrincipio) contarPorEstado().then(setCuentas).catch(() => {});
    } catch {
      setError('No se pudieron cargar los reclamos. Revisá tu conexión.');
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, [pagina, soloPendientes]);

  // Recargar al volver a la pantalla (por ejemplo, después de cambiar un estado)
  useFocusEffect(useCallback(() => { cargar(true); }, [soloPendientes]));

  // RF-25: la empresa gestiona solo las líneas con suscripción activa
  const alcance = perfil?.rol === 'municipio' ? 'Todas las líneas'
    : lineas === null ? ''
    : lineas.length ? `Líneas habilitadas: ${lineas.join(', ')}`
    : 'Sin líneas habilitadas todavía: el administrador tiene que aprobar la suscripción.';

  const encabezado = (
    <View>
      <Encabezado antetitulo="BANDEJA DE RECLAMOS" titulo={perfil?.organizacion_nombre ?? ''} detalle={alcance} />
      <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {ESTADOS.map((estado) => (
            <View key={estado} style={{ flex: 1, backgroundColor: colores.superficie, borderWidth: 1, borderColor: colores.borde, borderRadius: 12, paddingVertical: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colores.texto }}>{cuentas ? cuentas[estado] : '–'}</Text>
              <Text style={{ fontSize: 10.5, fontWeight: '600', color: colores.textoSecundario }}>{estado}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', backgroundColor: colores.fondo, borderRadius: 10, padding: 3, marginTop: 10, borderWidth: 1, borderColor: colores.borde }}>
          {([[true, 'Pendientes'], [false, 'Todos']] as const).map(([valor, texto]) => (
            <Pressable
              key={texto}
              onPress={() => { setSoloPendientes(valor); setCargando(true); }}
              accessibilityRole="button"
              accessibilityState={{ selected: soloPendientes === valor }}
              style={{ flex: 1, minHeight: 40, justifyContent: 'center', borderRadius: 8, alignItems: 'center', backgroundColor: soloPendientes === valor ? colores.primarioOscuro : 'transparent' }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: soloPendientes === valor ? '#FFFFFF' : colores.textoSecundario }}>{texto}</Text>
            </Pressable>
          ))}
        </View>
        {!!error && <TextoError>{error}</TextoError>}
        <Text style={{ fontSize: 12, color: colores.textoSecundario, marginTop: 10, marginBottom: 8 }}>
          Los pendientes de más de 7 días aparecen marcados.
        </Text>
      </View>
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colores.fondo }}
      data={reclamos}
      keyExtractor={(r) => r.id}
      ListHeaderComponent={encabezado}
      contentContainerStyle={{ paddingBottom: 30 }}
      refreshControl={<RefreshControl refreshing={actualizando} onRefresh={() => { setActualizando(true); cargar(true); }} tintColor={colores.primario} />}
      onEndReachedThreshold={0.4}
      onEndReached={() => { if (hayMas && !cargando && reclamos.length) cargar(false); }}
      ListEmptyComponent={cargando
        ? <ActivityIndicator color={colores.primario} style={{ marginTop: 30 }} />
        : <Text style={{ textAlign: 'center', padding: 40, color: colores.textoTenue }}>No hay reclamos {soloPendientes ? 'pendientes' : 'asignados'}.</Text>}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: 20 }}>
          <TarjetaReclamo reclamo={item} conGestion onPress={() => router.push({ pathname: '/gestion/[id]', params: { id: item.id } })} />
        </View>
      )}
      ListFooterComponent={hayMas && reclamos.length > 0 ? <ActivityIndicator color={colores.primario} style={{ marginVertical: 16 }} /> : null}
    />
  );
}
