import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { CampoFecha } from '@/componentes/formulario/CampoFecha';
import { CampoHora } from '@/componentes/formulario/CampoHora';
import { MiniMapa } from '@/componentes/mapa/MiniMapa';
import { SelectorParada } from '@/componentes/mapa/SelectorParada';
import { Aviso, Ayuda, Boton, Campo, Chip, Etiqueta, Pantalla, Selector, TextoError, Titulo } from '@/componentes/ui';
import { MOTIVO_NO_FRENO, MOTIVO_ROBO } from '@/constantes/motivos';
import { AVISO_911, AYUDA_INTERNO, AYUDA_INTERNO_NO_FRENO } from '@/constantes/textos';
import { useConexion } from '@/contextos/ConexionContexto';
import { useSesion } from '@/contextos/SesionContexto';
import { guardarBorrador } from '@/servicios/borradores';
import { descripcionMotivo, textoSentido, useCatalogo } from '@/servicios/catalogo';
import { enviarReclamo } from '@/servicios/reclamos';
import { NuevoReclamo, Parada, Punto } from '@/tipos';
import { esErrorDeRed, mensajeDeError } from '@/utilidades/errores';
import { aFechaISO, aHora } from '@/utilidades/fechas';
import type { ParametrosReclamoEnviado } from './reclamo-enviado';

type Formulario = {
  linea: string;
  sentidoLugarId: number | null;
  motivo: string;
  internoPatente: string;
  descripcion: string;
  fecha: string;            // AAAA-MM-DD
  hora: string;             // HH:MM
  ubicacionTexto: string;
  latitud: number | null;
  longitud: number | null;
  parada: Parada | null;
  fotoUri: string | null;
  fotoBase64: string | null;
};

const FORMULARIO_VACIO: Formulario = {
  linea: '', sentidoLugarId: null, motivo: '', internoPatente: '', descripcion: '', fecha: '', hora: '',
  ubicacionTexto: '', latitud: null, longitud: null, parada: null, fotoUri: null, fotoBase64: null,
};

// RF-03 · Nuevo reclamo
export default function NuevoReclamoPantalla() {
  const router = useRouter();
  const { sesion } = useSesion();
  const { conectado, actualizarPendientes } = useConexion();
  const { catalogo, sinDatos } = useCatalogo();   // líneas, sentidos y motivos desde la base (con copia local)

  const [formulario, setFormulario] = useState<Formulario>(FORMULARIO_VACIO);
  const [error, setError] = useState('');
  const [estadoGps, setEstadoGps] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mapaAbierto, setMapaAbierto] = useState(false);

  const actualizar = (cambios: Partial<Formulario>) => {
    setFormulario((f) => ({ ...f, ...cambios }));
    setError('');
  };

  const sentidosDeLaLinea = catalogo.sentidos[formulario.linea] ?? [];
  const sentidoElegido = sentidosDeLaLinea.find((s) => s.lugarId === formulario.sentidoLugarId);
  const esRobo = formulario.motivo === MOTIVO_ROBO;
  const puntoElegido: Punto | null =
    formulario.latitud !== null && formulario.longitud !== null ? { latitud: formulario.latitud, longitud: formulario.longitud } : null;

  // Al cambiar de línea, el sentido elegido deja de valer si no es un destino de la nueva línea
  const elegirLinea = (linea: string) => {
    const sigueValiendo = (catalogo.sentidos[linea] ?? []).some((s) => s.lugarId === formulario.sentidoLugarId);
    actualizar({ linea, sentidoLugarId: sigueValiendo ? formulario.sentidoLugarId : null });
  };

  const elegirSentido = (texto: string) => {
    actualizar({ sentidoLugarId: sentidosDeLaLinea.find((s) => textoSentido(s) === texto)?.lugarId ?? null });
  };

  // ---------- Ubicación ----------
  const usarGps = async () => {
    setEstadoGps('Buscando tu ubicación…');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return setEstadoGps('No se pudo obtener el GPS: escribí la dirección o elegí la parada en el mapa.');
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      actualizar({
        latitud: coords.latitude, longitud: coords.longitude, parada: null,
        ubicacionTexto: `Lat ${coords.latitude.toFixed(4)}, Lon ${coords.longitude.toFixed(4)}`,
      });
      setEstadoGps('');
    } catch {
      setEstadoGps('No se pudo obtener el GPS: escribí la dirección o elegí la parada en el mapa.');
    }
  };

  const confirmarParada = (parada: Parada, texto: string) => {
    actualizar({ parada, latitud: parada.latitud, longitud: parada.longitud, ubicacionTexto: texto });
    setEstadoGps('');
    setMapaAbierto(false);
  };

  // ---------- Foto (cámara o galería) ----------
  const elegirFoto = () => {
    // base64: el contenido de la foto se sube a Storage (ver servicios/reclamos.ts)
    const opciones = { mediaTypes: ['images'] as ImagePicker.MediaType[], quality: 0.5, base64: true };
    const obtener = async (conCamara: boolean) => {
      const permiso = conCamara ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permiso.granted) return;
      const resultado = conCamara ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
      const foto = resultado.canceled ? null : resultado.assets[0];
      if (!foto) return;
      if (!foto.base64) return Alert.alert('Foto', 'No se pudo leer la foto. Probá de nuevo.');
      actualizar({ fotoUri: foto.uri, fotoBase64: foto.base64 });
    };
    Alert.alert('Foto', 'Podés sacarla ahora o elegir una de la galería.', [
      { text: 'Sacar foto', onPress: () => obtener(true) },
      { text: 'Galería', onPress: () => obtener(false) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  // ---------- Validación y envío ----------
  const validar = (): string | null => {
    const f = formulario;
    if (!f.linea || !f.sentidoLugarId || !f.motivo || !f.fecha || !f.hora || !f.ubicacionTexto.trim()) {
      return 'Completá línea, sentido, motivo, fecha, horario y ubicación.';
    }
    if (!esRobo && !f.internoPatente.trim()) return 'El interno o la patente es obligatorio para este motivo.';
    const ahora = new Date();
    if (f.fecha === aFechaISO(ahora) && f.hora > aHora(ahora)) return 'El horario del hecho no puede ser posterior a la hora actual.';
    return null;
  };

  const enviar = async () => {
    const problema = validar();
    if (problema) return setError(problema);
    if (!sesion) return;

    const f = formulario;
    const reclamo: NuevoReclamo = {
      linea: f.linea, sentidoLugarId: f.sentidoLugarId!, motivo: f.motivo, internoPatente: f.internoPatente,
      descripcion: f.descripcion, fechaHoraHecho: `${f.fecha}T${f.hora}`, ubicacionTexto: f.ubicacionTexto,
      latitud: f.latitud, longitud: f.longitud, paradaId: f.parada?.id ?? null, fotoUri: f.fotoUri, fotoBase64: f.fotoBase64,
    };
    const resumen: ParametrosReclamoEnviado = {
      linea: f.linea, motivo: descripcionMotivo(catalogo, f.motivo), horario: `${f.hora} hs`, ubicacion: f.ubicacionTexto.trim(),
      ...(f.fotoUri ? { fotoUri: f.fotoUri } : {}),
    };
    const guardarComoBorrador = async () => {
      await guardarBorrador(sesion.user.id, reclamo);
      await actualizarPendientes();
      router.replace({ pathname: '/reclamo-enviado', params: { ...resumen, esBorrador: '1' } });
    };

    setEnviando(true);
    try {
      if (!conectado) return await guardarComoBorrador();
      const ticket = await enviarReclamo(sesion.user.id, reclamo);
      router.replace({ pathname: '/reclamo-enviado', params: { ...resumen, ticket } });
    } catch (e) {
      if (esErrorDeRed(e)) await guardarComoBorrador();   // se cortó la señal al enviar
      else setError(mensajeDeError(e, 'No se pudo enviar el reporte. Intentá de nuevo.'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Pantalla>
      <Boton titulo="← Cancelar" variante="secundario" onPress={() => router.back()} style={{ marginTop: 0 }} />
      <Titulo>Crear reporte</Titulo>
      {!conectado && <Aviso tipo="advertencia">📴 Estás sin conexión: el reporte se guarda igual y se envía cuando vuelva la señal.</Aviso>}
      {sinDatos && <Aviso tipo="advertencia">No se pudieron cargar las líneas. Conectate a internet una vez para descargarlas.</Aviso>}

      <Etiqueta>Línea</Etiqueta>
      <Selector valor={formulario.linea} opciones={catalogo.lineas} textoVacio="Seleccioná una línea" titulo="Línea" onCambiar={elegirLinea} />

      {/* Sentido: destinos de los ramales de la línea (Registro de requerimiento N° 26) */}
      <Etiqueta>Sentido</Etiqueta>
      <Selector
        valor={sentidoElegido ? textoSentido(sentidoElegido) : ''}
        opciones={sentidosDeLaLinea.map(textoSentido)}
        textoVacio={formulario.linea ? 'Elegí hacia dónde iba' : 'Primero elegí la línea'}
        titulo="Sentido"
        deshabilitado={!formulario.linea}
        onCambiar={elegirSentido}
      />

      <Etiqueta>¿Qué pasó?</Etiqueta>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 4 }}>
        {catalogo.motivos.map((m) => (
          <Chip key={m.codigo} texto={m.descripcion} conAlerta={m.esGrave} seleccionado={formulario.motivo === m.codigo} onPress={() => actualizar({ motivo: m.codigo })} />
        ))}
      </View>
      {esRobo && <View style={{ marginTop: 12 }}><Aviso tipo="peligro">🚨 {AVISO_911}</Aviso></View>}

      <Etiqueta>{esRobo ? 'Interno o patente (opcional)' : 'Interno o patente'}</Etiqueta>
      <Campo value={formulario.internoPatente} onChangeText={(t) => actualizar({ internoPatente: t })} placeholder="Ej: 1245"
        autoCapitalize="characters" accessibilityLabel="Interno o patente" />
      <Ayuda>{AYUDA_INTERNO}</Ayuda>
      {formulario.motivo === MOTIVO_NO_FRENO && <Ayuda style={{ fontWeight: '700' }}>{AYUDA_INTERNO_NO_FRENO}</Ayuda>}

      <Etiqueta>Descripción (opcional)</Etiqueta>
      <Campo value={formulario.descripcion} onChangeText={(t) => actualizar({ descripcion: t })} multiline accessibilityLabel="Descripción" />

      <Etiqueta>Fecha del hecho</Etiqueta>
      <CampoFecha valor={formulario.fecha} onCambiar={(fecha) => actualizar({ fecha })} />
      <Etiqueta>Horario del hecho (formato 24 hs)</Etiqueta>
      <CampoHora valor={formulario.hora} onCambiar={(hora) => actualizar({ hora })} />
      <Ayuda>Ej: 14:30 (2:30 de la tarde), siempre en formato de 24 horas.</Ayuda>

      <Etiqueta>Ubicación</Etiqueta>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Campo
          style={{ flex: 1, width: undefined }}
          value={formulario.ubicacionTexto}
          // si se edita a mano, la parada o las coordenadas elegidas dejan de corresponder
          onChangeText={(t) => actualizar({ ubicacionTexto: t, latitud: null, longitud: null, parada: null })}
          placeholder="Escribí la dirección o parada"
          accessibilityLabel="Ubicación"
        />
        <Boton titulo="📍 GPS" variante="contorno" onPress={usarGps} style={{ marginTop: 0, width: undefined, paddingHorizontal: 14 }} />
      </View>
      {!!estadoGps && <Ayuda>{estadoGps}</Ayuda>}
      {puntoElegido ? (
        <>
          <MiniMapa punto={puntoElegido} onPress={() => setMapaAbierto(true)} />
          <Ayuda>{formulario.parada ? 'Tocá el mapa para cambiar la parada.' : 'Tocá el mapa para elegir la parada.'}</Ayuda>
        </>
      ) : (
        <Boton titulo="🗺️ Elegir la parada en el mapa" variante="contorno" onPress={() => setMapaAbierto(true)} style={{ marginTop: 8 }} />
      )}
      <SelectorParada
        visible={mapaAbierto}
        inicial={formulario.parada}
        linea={formulario.linea}
        busquedaInicial={formulario.ubicacionTexto}
        onCerrar={() => setMapaAbierto(false)}
        onConfirmar={confirmarParada}
      />

      <Etiqueta>Foto (opcional)</Etiqueta>
      {formulario.fotoUri ? (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Pressable onPress={elegirFoto} accessibilityRole="button" accessibilityLabel="Cambiar la foto">
            <Image source={{ uri: formulario.fotoUri }} style={{ width: 96, height: 96, borderRadius: 12 }} accessibilityLabel="Foto adjunta" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Etiqueta style={{ marginTop: 0 }}>Foto adjuntada ✓</Etiqueta>
            <Boton titulo="Cambiar foto" variante="secundario" onPress={elegirFoto} style={{ marginTop: 2 }} />
            <Boton titulo="Quitar foto" variante="secundario" onPress={() => actualizar({ fotoUri: null, fotoBase64: null })} style={{ marginTop: 0 }} />
          </View>
        </View>
      ) : (
        <>
          <Boton titulo="Adjuntar foto" variante="contorno" onPress={elegirFoto} style={{ marginTop: 0 }} />
          <Ayuda>Podés sacarla ahora o elegir una de la galería.</Ayuda>
        </>
      )}

      {!!error && <TextoError>{error}</TextoError>}
      <Boton titulo="Enviar reporte" onPress={enviar} cargando={enviando} />
    </Pantalla>
  );
}
