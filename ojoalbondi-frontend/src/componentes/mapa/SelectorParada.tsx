import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { MapaOSM, MapaOSMRef, MarcadorOSM, Region } from './MapaOSM';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ATRIBUCION_PARADAS } from '../../constantes/textos';
import { useTema } from '../../contextos/TemaContexto';
import { buscarDireccion, CENTRO_PILAR, distanciaKm, ResultadoBusqueda, textoDeParada } from '../../servicios/geocodificacion';
import { actualizarParadas, nombreParada, paradasGuardadas } from '../../servicios/paradas';
import { Parada, Punto } from '../../tipos';
import { Boton } from '../ui';

const REGION_PILAR: Region = { latitude: CENTRO_PILAR.latitud, longitude: CENTRO_PILAR.longitud, latitudeDelta: 0.02, longitudeDelta: 0.02 };
const ZOOM_CALLE = { latitudeDelta: 0.006, longitudeDelta: 0.006 };
const ZOOM_MAXIMO_CON_PARADAS = 0.035; // más alejado que esto no se dibujan paradas (serían miles)
const MAXIMO_MARCADORES = 150;        // RNF-04

/**
 * Mapa a pantalla completa con las paradas de colectivo como marcadores fijos.
 * El usuario navega el mapa (o busca calle y altura para centrarse) y toca la parada del hecho.
 */
export function SelectorParada({
  visible,
  inicial,
  linea,
  busquedaInicial = '',
  onCerrar,
  onConfirmar,
}: {
  visible: boolean;
  /** Parada ya elegida (para volver a abrir el mapa sobre ella). */
  inicial: Parada | null;
  /** Línea elegida en el formulario: si hay, se muestran primero sus paradas. */
  linea: string;
  /** Lo que el usuario ya escribió en el campo Ubicación: se busca apenas abre el mapa. */
  busquedaInicial?: string;
  onCerrar: () => void;
  onConfirmar: (p: Parada, texto: string) => void;
}) {
  const { colores, tema } = useTema();
  const mapa = useRef<MapaOSMRef>(null);

  const [paradas, setParadas] = useState<Parada[] | null>(null);
  const [errorParadas, setErrorParadas] = useState(false);
  const [region, setRegion] = useState<Region>(REGION_PILAR);
  const [seleccionada, setSeleccionada] = useState<Parada | null>(inicial);
  const [soloLinea, setSoloLinea] = useState(true);
  const [confirmando, setConfirmando] = useState(false);

  const [busqueda, setBusqueda] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [sinResultados, setSinResultados] = useState(false);
  const [puntoBuscado, setPuntoBuscado] = useState<Punto | null>(null);

  const [permisoUbicacion, setPermisoUbicacion] = useState(false);
  const [aviso, setAviso] = useState('');

  const regionInicial: Region = inicial
    ? { latitude: inicial.latitud, longitude: inicial.longitud, ...ZOOM_CALLE }
    : REGION_PILAR;

  // ---------- Al abrir ----------
  useEffect(() => {
    if (!visible) return;
    setSeleccionada(inicial);
    setRegion(regionInicial);
    setSoloLinea(true);
    setAviso('');
    setResultados([]);
    setSinResultados(false);
    setPuntoBuscado(null);
    setErrorParadas(false);

    paradasGuardadas().then((g) => g.length && setParadas(g));
    actualizarParadas()
      .then(setParadas)
      .catch(() => {
        paradasGuardadas().then((g) => setParadas(g));
        setErrorParadas(true);
      });

    Location.getForegroundPermissionsAsync().then(({ status }) => setPermisoUbicacion(status === 'granted'));

    const previa = busquedaInicial.trim();
    if (!inicial && previa && !previa.startsWith('Lat ') && !previa.startsWith('Parada')) {
      setBusqueda(previa);
      buscar(previa);
    } else {
      setBusqueda('');
    }
  }, [visible]);

  // ---------- Paradas a dibujar: solo las de la zona visible y con zoom suficiente ----------
  const filtrarPorLinea = !!linea && soloLinea;
  const muyLejos = region.latitudeDelta > ZOOM_MAXIMO_CON_PARADAS;

  const visibles = useMemo(() => {
    if (!paradas || muyLejos) return [];
    const margenLat = region.latitudeDelta * 0.6;
    const margenLon = region.longitudeDelta * 0.6;
    const centro = { latitud: region.latitude, longitud: region.longitude };
    return paradas
      .filter(
        (p) =>
          Math.abs(p.latitud - region.latitude) < margenLat &&
          Math.abs(p.longitud - region.longitude) < margenLon &&
          // si OSM no informa las líneas de una parada, se muestra igual
          (!filtrarPorLinea || p.lineas.length === 0 || p.lineas.includes(linea))
      )
      .sort((a, b) => distanciaKm(a, centro) - distanciaKm(b, centro))
      .slice(0, MAXIMO_MARCADORES);
  }, [paradas, region, muyLejos, filtrarPorLinea, linea]);

  // Android dibuja los marcadores personalizados como imagen: hay que dejarlos "vivos" un momento
  // después de cada cambio para que no aparezcan vacíos, y después congelarlos para que el mapa ande fluido.
  const [redibujar, setRedibujar] = useState(true);
  const firma = visibles.map((p) => p.id).join(',') + '|' + (seleccionada?.id ?? '');
  useEffect(() => {
    setRedibujar(true);
    const t = setTimeout(() => setRedibujar(false), 600);
    return () => clearTimeout(t);
  }, [firma, tema]);

  // La parada elegida siempre se dibuja, aunque quede fuera del filtro
  const marcadores = seleccionada && !visibles.some((p) => p.id === seleccionada.id) ? [...visibles, seleccionada] : visibles;

  const marcadoresParaOSM: MarcadorOSM[] = useMemo(() => {
    return marcadores.map((p) => ({
      id: p.id,
      latitud: p.latitud,
      longitud: p.longitud,
      tipo: 'parada',
      elegido: seleccionada?.id === p.id,
      nombre: nombreParada(p),
    }));
  }, [marcadores, seleccionada]);

  // ---------- Acciones ----------
  const irA = (p: Punto, zoomNivel = 16) => mapa.current?.animarA(p, zoomNivel);

  const buscar = async (texto = busqueda) => {
    if (!texto.trim()) return;
    Keyboard.dismiss();
    setBuscando(true);
    setSinResultados(false);
    setResultados([]);
    const encontrados = await buscarDireccion(texto);
    setBuscando(false);
    if (encontrados.length === 0) setSinResultados(true);
    else if (encontrados.length === 1) centrarEnResultado(encontrados[0]);
    else setResultados(encontrados);
  };

  const centrarEnResultado = (r: ResultadoBusqueda) => {
    setResultados([]);
    setBusqueda(r.texto);
    setPuntoBuscado(r.punto);
    irA(r.punto);
  };

  const limpiarBusqueda = () => {
    setBusqueda('');
    setResultados([]);
    setSinResultados(false);
    setPuntoBuscado(null);
  };

  const miUbicacion = async () => {
    setAviso('Buscando tu ubicación...');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setAviso('Sin permiso de ubicación — buscá la calle o mové el mapa.');
        return;
      }
      setPermisoUbicacion(true);
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      irA({ latitud: pos.coords.latitude, longitud: pos.coords.longitude });
      setAviso('');
    } catch {
      setAviso('No se pudo obtener el GPS — buscá la calle o mové el mapa.');
    }
  };

  const confirmar = async () => {
    if (!seleccionada) return;
    setConfirmando(true);
    const texto = await textoDeParada(seleccionada);
    setConfirmando(false);
    onConfirmar(seleccionada, texto);
  };

  // ---------- Mensaje de la hoja inferior cuando no hay parada elegida ----------
  let indicacion = 'Tocá la parada donde pasó el hecho.';
  if (paradas === null) indicacion = 'Cargando paradas...';
  else if (paradas.length === 0)
    indicacion = errorParadas
      ? 'No se pudieron cargar las paradas. Revisá tu conexión.'
      : 'Todavía no hay paradas cargadas.';
  else if (muyLejos) indicacion = 'Acercá el mapa para ver las paradas.';
  else if (visibles.length === 0)
    indicacion = filtrarPorLinea ? `No hay paradas de la línea ${linea} en esta zona.` : 'No hay paradas en esta zona.';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <View style={{ flex: 1, backgroundColor: colores.fondo }}>
        <MapaOSM
          ref={mapa}
          style={{ flex: 1 }}
          regionInicial={regionInicial}
          onRegionChangeComplete={setRegion}
          onMapPress={() => {
            Keyboard.dismiss();
            setResultados([]);
          }}
          onMarkerPress={(id) => {
            Keyboard.dismiss();
            setResultados([]);
            const p = paradas?.find((x) => x.id === id);
            if (p) setSeleccionada(p);
          }}
          marcadores={marcadoresParaOSM}
          puntoBuscado={puntoBuscado}
        />

        {/* Buscador de calle y altura + filtro de línea */}
        <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="box-none">
          <View style={{ margin: 12, width: '100%', maxWidth: 460, alignSelf: 'center', paddingHorizontal: 12 }} pointerEvents="box-none">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable
                onPress={onCerrar}
                accessibilityRole="button"
                accessibilityLabel="Cancelar"
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colores.superficie, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colores.borde }}
              >
                <Ionicons name="close" size={22} color={colores.texto} />
              </Pressable>
              <View
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 44, backgroundColor: colores.superficie,
                  borderRadius: 22, paddingLeft: 14, paddingRight: 6, borderWidth: 1, borderColor: colores.borde,
                }}
              >
                <Ionicons name="search" size={18} color={colores.textoTenue} />
                <TextInput
                  value={busqueda}
                  onChangeText={(t) => { setBusqueda(t); setSinResultados(false); }}
                  onSubmitEditing={() => buscar()}
                  placeholder="Calle y altura (ej: Tucumán 750)"
                  placeholderTextColor={colores.textoTenue}
                  returnKeyType="search"
                  autoCorrect={false}
                  accessibilityLabel="Buscar calle y altura"
                  style={{ flex: 1, color: colores.texto, fontSize: 14.5, paddingHorizontal: 8, paddingVertical: 10 }}
                />
                {buscando ? (
                  <ActivityIndicator color={colores.primario} style={{ marginRight: 8 }} />
                ) : busqueda ? (
                  <Pressable onPress={limpiarBusqueda} accessibilityLabel="Borrar búsqueda" hitSlop={8} style={{ padding: 6 }}>
                    <Ionicons name="close-circle" size={18} color={colores.textoTenue} />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {resultados.length > 0 && (
              <View style={{ marginTop: 8, marginLeft: 54, backgroundColor: colores.superficie, borderRadius: 14, borderWidth: 1, borderColor: colores.borde, overflow: 'hidden' }}>
                <FlatList
                  data={resultados}
                  keyboardShouldPersistTaps="handled"
                  keyExtractor={(r) => `${r.punto.latitud},${r.punto.longitud}`}
                  ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colores.borde }} />}
                  renderItem={({ item }) => (
                    <Pressable onPress={() => centrarEnResultado(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 }}>
                      <Ionicons name="location-outline" size={18} color={colores.textoSecundario} />
                      <Text style={{ flex: 1, fontSize: 14, color: colores.texto }} numberOfLines={2}>{item.texto}</Text>
                    </Pressable>
                  )}
                />
              </View>
            )}

            {sinResultados && (
              <View style={{ marginTop: 8, marginLeft: 54, backgroundColor: colores.superficie, borderRadius: 14, borderWidth: 1, borderColor: colores.borde, padding: 12 }}>
                <Text style={{ fontSize: 13, color: colores.texto }}>No encontramos esa dirección.</Text>
                <Text style={{ fontSize: 12, color: colores.textoSecundario, marginTop: 2 }}>
                  Revisá la calle y la altura, agregá la localidad (ej: "Tucumán 750, Del Viso") o mové el mapa.
                </Text>
              </View>
            )}

            {!!linea && resultados.length === 0 && !sinResultados && (
              <Pressable
                onPress={() => setSoloLinea((v) => !v)}
                accessibilityRole="switch"
                accessibilityState={{ checked: soloLinea }}
                style={{
                  marginTop: 8, marginLeft: 54, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingVertical: 7, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1.3,
                  borderColor: soloLinea ? colores.primario : colores.borde, backgroundColor: soloLinea ? colores.primario : colores.superficie,
                }}
              >
                <Ionicons name="bus" size={14} color={soloLinea ? colores.sobrePrimario : colores.texto} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: soloLinea ? colores.sobrePrimario : colores.texto }}>
                  {soloLinea ? `Paradas de la línea ${linea}` : 'Todas las paradas'}
                </Text>
              </Pressable>
            )}
          </View>
        </SafeAreaView>

        {/* Atribución de los datos de paradas (RNF-05) */}
        <View pointerEvents="none" style={{ position: 'absolute', left: 10, bottom: 200, backgroundColor: colores.superficie, opacity: 0.9, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ fontSize: 10.5, color: colores.textoSecundario }}>{ATRIBUCION_PARADAS}</Text>
        </View>

        {/* Botón "mi ubicación" */}
        <Pressable
          onPress={miUbicacion}
          accessibilityRole="button"
          accessibilityLabel="Ir a mi ubicación"
          style={{ position: 'absolute', right: 16, bottom: 200, width: 48, height: 48, borderRadius: 24, backgroundColor: colores.superficie, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colores.borde }}
        >
          <Ionicons name="locate" size={22} color={colores.primario} />
        </Pressable>

        {/* Hoja inferior: parada elegida o indicación */}
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: colores.superficie, borderTopLeftRadius: 20, borderTopRightRadius: 20, marginTop: -20 }}>
          <View style={{ padding: 20, paddingBottom: 12, width: '100%', maxWidth: 460, alignSelf: 'center' }}>
            {seleccionada ? (
              <>
                <Text style={{ fontSize: 12.5, color: colores.textoSecundario, fontWeight: '600' }}>Parada elegida</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colores.texto, marginTop: 4 }} numberOfLines={2}>
                  {nombreParada(seleccionada)}
                </Text>
                <Text style={{ fontSize: 12.5, color: colores.textoSecundario, marginTop: 4 }}>
                  {seleccionada.lineas.length ? `Líneas ${seleccionada.lineas.join(', ')}` : 'Líneas sin informar'}
                </Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 12.5, color: colores.textoSecundario, fontWeight: '600' }}>Parada del hecho</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colores.texto, marginTop: 4 }}>{indicacion}</Text>
              </>
            )}
            {!!aviso && <Text style={{ color: colores.textoTenue, fontSize: 12, marginTop: 6 }}>{aviso}</Text>}
            <Boton
              titulo="Confirmar parada"
              deshabilitado={!seleccionada}
              cargando={confirmando}
              onPress={confirmar}
              style={{ marginTop: 14 }}
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
