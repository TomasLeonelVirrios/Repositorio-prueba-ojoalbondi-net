import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { MapaOSM, MarcadorOSM, Region } from '../componentes/mapa/MapaOSM';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ayuda, Boton, Chip, Etiqueta, HojaModal, Seccion, Selector } from '../componentes/ui';
import { ATRIBUCION_PARADAS } from '../constantes/textos';
import { useTema } from '../contextos/TemaContexto';
import { useCatalogo } from '../servicios/catalogo';
import { CENTRO_PILAR } from '../servicios/geocodificacion';
import { calorPorParada, ReclamoEnParada, reclamosDeParada } from '../servicios/mapa';
import { actualizarParadas, nombreParada, paradasGuardadas } from '../servicios/paradas';
import { Parada } from '../tipos';
import { fechaArgentina } from '../utilidades/fechas';

type Modo = 'paradas' | 'calor';

const REGION_INICIAL: Region = { latitude: CENTRO_PILAR.latitud, longitude: CENTRO_PILAR.longitud, latitudeDelta: 0.05, longitudeDelta: 0.05 };
const ZOOM_MAXIMO_PARADAS = 0.035;  // más alejado no se dibujan las paradas (serían miles)
const MAXIMO_MARCADORES = 150;      // RNF-04
const PERIODOS: { dias: number | null; texto: string }[] = [
  { dias: 7, texto: '7 días' }, { dias: 30, texto: '30 días' }, { dias: null, texto: 'Todo' },
];
const TODAS = 'Todas';
const TODOS = 'Todos';

/** Color del mapa de calor: de amarillo (pocos reclamos) a rojo (muchos). */
function colorCalor(proporcion: number): string {
  const tono = Math.round(48 - 48 * proporcion);
  return `hsl(${tono}, 92%, ${52 - 6 * proporcion}%)`;
}

/**
 * Mapa con las paradas registradas y sus líneas, y mapa de calor de reclamos (RF-17, RF-17.1).
 * Lo usan el ciudadano, la institución y el administrador; la base filtra lo que cada uno puede ver.
 */
export default function MapaPantalla() {
  const { colores, tema } = useTema();
  const { catalogo } = useCatalogo();

  const [paradas, setParadas] = useState<Parada[] | null>(null);
  const [errorParadas, setErrorParadas] = useState(false);
  const [region, setRegion] = useState<Region>(REGION_INICIAL);
  const [modo, setModo] = useState<Modo>('paradas');

  // Filtros
  const [linea, setLinea] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [dias, setDias] = useState<number | null>(30);
  const [verFiltros, setVerFiltros] = useState(false);

  // Mapa de calor
  const [calor, setCalor] = useState<Map<number, number> | null>(null);
  const [cargandoCalor, setCargandoCalor] = useState(false);
  const [errorCalor, setErrorCalor] = useState('');

  // Parada tocada
  const [seleccionada, setSeleccionada] = useState<Parada | null>(null);
  const [detalle, setDetalle] = useState<{ reclamos: ReclamoEnParada[]; total: number } | null>(null);

  useEffect(() => {
    paradasGuardadas().then((g) => g.length && setParadas(g));
    actualizarParadas().then(setParadas).catch(() => {
      paradasGuardadas().then(setParadas);
      setErrorParadas(true);
    });
  }, []);

  const filtros = { motivo, dias, linea };

  useEffect(() => {
    if (modo !== 'calor') return;
    setCargandoCalor(true);
    calorPorParada(filtros)
      .then((c) => { setCalor(c); setErrorCalor(''); })
      .catch(() => setErrorCalor('No se pudo cargar el mapa de calor. Revisá tu conexión.'))
      .finally(() => setCargandoCalor(false));
  }, [modo, motivo, dias, linea]);

  // Al tocar una parada en modo calor, se cargan sus reclamos
  useEffect(() => {
    setDetalle(null);
    if (!seleccionada || modo !== 'calor') return;
    reclamosDeParada(seleccionada.id, filtros).then(setDetalle).catch(() => setDetalle({ reclamos: [], total: 0 }));
  }, [seleccionada, modo, motivo, dias, linea]);

  const muyAlejado = region.latitudeDelta > ZOOM_MAXIMO_PARADAS;
  const enPantalla = (p: Parada) =>
    Math.abs(p.latitud - region.latitude) < region.latitudeDelta * 0.6 && Math.abs(p.longitud - region.longitude) < region.longitudeDelta * 0.6;

  const marcadores = useMemo(() => {
    if (!paradas) return [];
    if (modo === 'paradas') {
      if (muyAlejado) return [];
      return paradas.filter((p) => enPantalla(p) && (!linea || p.lineas.includes(linea))).slice(0, MAXIMO_MARCADORES);
    }
    if (!calor) return [];
    return paradas.filter((p) => (calor.get(p.id) ?? 0) > 0 && enPantalla(p))
      .sort((a, b) => (calor.get(b.id) ?? 0) - (calor.get(a.id) ?? 0))
      .slice(0, MAXIMO_MARCADORES);
  }, [paradas, modo, linea, calor, region]);

  const maximoCalor = calor && calor.size ? Math.max(...calor.values()) : 1;
  const totalReclamos = calor ? [...calor.values()].reduce((a, b) => a + b, 0) : 0;

  const marcadoresParaOSM: MarcadorOSM[] = useMemo(() => {
    return marcadores.map((p) => {
      const elegida = seleccionada?.id === p.id;
      if (modo === 'paradas') {
        return {
          id: p.id,
          latitud: p.latitud,
          longitud: p.longitud,
          tipo: 'parada',
          elegido: elegida,
          nombre: nombreParada(p),
        };
      }
      const cantidad = calor?.get(p.id) ?? 0;
      const proporcion = cantidad / maximoCalor;
      const diametro = Math.round(22 + 30 * Math.sqrt(proporcion));
      return {
        id: p.id,
        latitud: p.latitud,
        longitud: p.longitud,
        tipo: 'calor',
        cantidad,
        color: colorCalor(proporcion),
        diametro,
        elegido: elegida,
        nombre: `${nombreParada(p)}: ${cantidad} reclamos`,
      };
    });
  }, [marcadores, seleccionada, modo, calor, maximoCalor]);

  // Android dibuja los marcadores personalizados como imagen: se redibujan un momento después de cada cambio
  const [redibujar, setRedibujar] = useState(true);
  const firma = marcadores.map((p) => p.id).join(',') + '|' + (seleccionada?.id ?? '') + modo + tema;
  useEffect(() => {
    setRedibujar(true);
    const t = setTimeout(() => setRedibujar(false), 600);
    return () => clearTimeout(t);
  }, [firma]);

  const textoFiltros = [
    linea ? `Línea ${linea}` : 'Todas las líneas',
    ...(modo === 'calor' ? [PERIODOS.find((p) => p.dias === dias)!.texto, motivo ? 'un motivo' : 'todos los motivos'] : []),
  ].join(' · ');

  let indicacion = '';
  if (paradas === null) indicacion = 'Cargando paradas…';
  else if (paradas.length === 0) indicacion = errorParadas ? 'No se pudieron cargar las paradas. Revisá tu conexión.' : 'Todavía no hay paradas cargadas.';
  else if (modo === 'paradas' && muyAlejado) indicacion = 'Acercá el mapa para ver las paradas.';
  else if (modo === 'calor' && cargandoCalor) indicacion = 'Calculando el mapa de calor…';
  else if (modo === 'calor' && errorCalor) indicacion = errorCalor;
  else if (modo === 'calor' && calor && calor.size === 0) indicacion = 'No hay reclamos con estos filtros.';

  return (
    <View style={{ flex: 1, backgroundColor: colores.fondo }}>
      <MapaOSM
        style={{ flex: 1 }}
        regionInicial={REGION_INICIAL}
        onRegionChangeComplete={setRegion}
        onMapPress={() => setSeleccionada(null)}
        onMarkerPress={(id) => {
          const elegida = marcadores.find((p) => p.id === id);
          if (elegida) setSeleccionada(elegida);
        }}
        marcadores={marcadoresParaOSM}
      />

      {/* Controles superiores: modo y filtros */}
      <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="box-none">
        <View style={{ margin: 12, gap: 8, width: '100%', maxWidth: 460, alignSelf: 'center', paddingHorizontal: 12 }} pointerEvents="box-none">
          <View style={{ flexDirection: 'row', backgroundColor: colores.superficie, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: colores.borde }}>
            {([['paradas', 'Paradas y líneas'], ['calor', 'Mapa de calor']] as const).map(([valor, texto]) => (
              <Pressable key={valor} onPress={() => { setModo(valor); setSeleccionada(null); }} accessibilityRole="button"
                accessibilityState={{ selected: modo === valor }}
                style={{ flex: 1, minHeight: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 9, backgroundColor: modo === valor ? colores.primarioOscuro : 'transparent' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: modo === valor ? '#FFFFFF' : colores.textoSecundario }}>{texto}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => setVerFiltros(true)} accessibilityRole="button" accessibilityLabel="Filtros del mapa"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: colores.superficie, borderWidth: 1, borderColor: colores.borde }}>
            <Ionicons name="options-outline" size={16} color={colores.primario} />
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: colores.texto }}>{textoFiltros}</Text>
          </Pressable>
          {!!indicacion && (
            <View style={{ alignSelf: 'flex-start', backgroundColor: colores.superficie, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: colores.borde, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              {(paradas === null || cargandoCalor) && <ActivityIndicator size="small" color={colores.primario} />}
              <Text style={{ fontSize: 12.5, color: colores.texto }}>{indicacion}</Text>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* Leyenda y atribución */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 10, bottom: seleccionada ? 300 : 14, gap: 6 }}>
        {modo === 'calor' && calor && calor.size > 0 && (
          <View style={{ backgroundColor: colores.superficie, borderRadius: 10, padding: 8, borderWidth: 1, borderColor: colores.borde }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colores.texto, marginBottom: 4 }}>{totalReclamos} reclamos · sin anulados</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 10.5, color: colores.textoSecundario }}>Menos</Text>
              {[0, 0.5, 1].map((x) => <View key={x} style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colorCalor(x) }} />)}
              <Text style={{ fontSize: 10.5, color: colores.textoSecundario }}>Más</Text>
            </View>
          </View>
        )}
        <Text style={{ fontSize: 10, color: colores.textoSecundario, backgroundColor: colores.superficie, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' }}>
          {ATRIBUCION_PARADAS}
        </Text>
      </View>

      {/* Parada seleccionada */}
      {seleccionada && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colores.superficie, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: 290, borderTopWidth: 1, borderColor: colores.borde }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colores.texto }}>{nombreParada(seleccionada)}</Text>
              <Text style={{ fontSize: 12.5, color: colores.textoSecundario, marginTop: 3 }}>
                {seleccionada.lineas.length ? `Líneas ${seleccionada.lineas.join(', ')}` : 'Líneas sin informar'}
              </Text>
            </View>
            <Pressable onPress={() => setSeleccionada(null)} accessibilityLabel="Cerrar" hitSlop={10}>
              <Ionicons name="close" size={22} color={colores.textoSecundario} />
            </Pressable>
          </View>
          {modo === 'calor' && (
            !detalle ? <ActivityIndicator color={colores.primario} style={{ marginTop: 14 }} /> : (
              <>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colores.primario, marginTop: 10 }}>
                  {detalle.total} reclamo(s) · Reclamos informados por vecinos
                </Text>
                <FlatList
                  data={detalle.reclamos}
                  keyExtractor={(_, i) => String(i)}
                  style={{ marginTop: 6 }}
                  ListEmptyComponent={<Ayuda>No hay reclamos en esta parada con los filtros elegidos.</Ayuda>}
                  ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colores.borde }} />}
                  renderItem={({ item }) => (
                    <View style={{ paddingVertical: 7 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colores.texto }}>{item.motivoDescripcion}</Text>
                      <Text style={{ fontSize: 12, color: colores.textoSecundario }}>{fechaArgentina(item.fecha)} · Línea {item.linea}</Text>
                    </View>
                  )}
                  ListFooterComponent={detalle.total > detalle.reclamos.length
                    ? <Ayuda>Se muestran los {detalle.reclamos.length} más recientes de {detalle.total}.</Ayuda> : null}
                />
              </>
            )
          )}
        </View>
      )}

      {/* Filtros */}
      <HojaModal visible={verFiltros} onCerrar={() => setVerFiltros(false)}>
        <Seccion style={{ marginTop: 0 }}>Filtros del mapa</Seccion>
        <Etiqueta>Línea</Etiqueta>
        <Selector valor={linea ?? TODAS} opciones={[TODAS, ...catalogo.lineas]} textoVacio={TODAS} titulo="Línea"
          onCambiar={(v) => { setLinea(v === TODAS ? null : v); setSeleccionada(null); }} />
        {modo === 'calor' && (
          <>
            <Etiqueta>Motivo</Etiqueta>
            <Selector
              valor={motivo ? catalogo.motivos.find((m) => m.codigo === motivo)?.descripcion ?? TODOS : TODOS}
              opciones={[TODOS, ...catalogo.motivos.map((m) => m.descripcion)]}
              textoVacio={TODOS} titulo="Motivo"
              onCambiar={(v) => setMotivo(v === TODOS ? null : catalogo.motivos.find((m) => m.descripcion === v)?.codigo ?? null)}
            />
            <Etiqueta>Período</Etiqueta>
            <View style={{ flexDirection: 'row', gap: 7 }}>
              {PERIODOS.map((p) => <Chip key={p.texto} texto={p.texto} seleccionado={dias === p.dias} onPress={() => setDias(p.dias)} />)}
            </View>
            <Ayuda>No cuentan los reclamos anulados. Cada vecino suma como máximo 3 reclamos por parada.</Ayuda>
          </>
        )}
        <Boton titulo="Listo" onPress={() => setVerFiltros(false)} />
      </HojaModal>
    </View>
  );
}
