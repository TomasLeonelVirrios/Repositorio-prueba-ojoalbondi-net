import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { MiniMapa } from '@/componentes/mapa/MiniMapa';
import { LineaDeTiempo } from '@/componentes/reclamos/LineaDeTiempo';
import { Ayuda, Boton, Campo, Chip, HojaModal, Insignia, Pantalla, Seccion, Tarjeta, TextoError, Titulo } from '@/componentes/ui';
import { ACCION_ESTADO, MOTIVOS_ANULACION, TRANSICIONES } from '@/constantes/estados';
import { useTema } from '@/contextos/TemaContexto';
import { cambiarEstado, estaDemorado, obtenerHistorial, obtenerReclamo, urlTemporalFoto } from '@/servicios/gestion';
import { EntradaHistorial, Estado, ReclamoDetalle } from '@/tipos';
import { mensajeDeError } from '@/utilidades/errores';
import { antiguedad, fechaHoraArgentina } from '@/utilidades/fechas';

// RF-13 Detalle · RF-14 Cambio de estado · RF-15 Seguimiento (institución)
export default function DetalleReclamo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colores } = useTema();

  const [reclamo, setReclamo] = useState<ReclamoDetalle | null | undefined>(undefined);  // undefined = cargando
  const [historial, setHistorial] = useState<EntradaHistorial[]>([]);
  const [urlFoto, setUrlFoto] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [estadoNuevo, setEstadoNuevo] = useState<Estado | null>(null);  // acción abierta en la hoja modal
  const [comentario, setComentario] = useState('');
  const [errorAccion, setErrorAccion] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [detalle, entradas] = await Promise.all([obtenerReclamo(id), obtenerHistorial(id)]);
      setReclamo(detalle);
      setHistorial(entradas);
      if (detalle?.fotoRuta) urlTemporalFoto(detalle.fotoRuta).then(setUrlFoto);
      setError('');
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudo cargar el reclamo. Revisá tu conexión.'));
      setReclamo((previo) => previo ?? null);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirAccion = (estado: Estado) => {
    setEstadoNuevo(estado);
    setComentario('');
    setErrorAccion('');
  };

  const confirmarCambio = async () => {
    if (!estadoNuevo || !reclamo) return;
    if (estadoNuevo === 'Anulado' && !comentario.trim()) return setErrorAccion('El motivo de anulación es obligatorio.');
    setGuardando(true);
    try {
      await cambiarEstado(reclamo.id, estadoNuevo, comentario.trim());
      setEstadoNuevo(null);
      cargar();
    } catch (e) {
      setErrorAccion(mensajeDeError(e, 'No se pudo cambiar el estado. Intentá de nuevo.'));
    } finally {
      setGuardando(false);
    }
  };

  if (reclamo === undefined) {
    return <Pantalla centrado><ActivityIndicator color={colores.primario} /></Pantalla>;
  }
  if (reclamo === null) {
    return (
      <Pantalla>
        <Boton titulo="← Volver" variante="secundario" onPress={() => router.back()} style={{ marginTop: 0 }} />
        <Text style={{ textAlign: 'center', padding: 40, color: colores.textoTenue }}>{error || 'No tenés acceso a este reclamo.'}</Text>
      </Pantalla>
    );
  }

  const acciones = TRANSICIONES[reclamo.estado];
  const Fila = ({ dato, valor }: { dato: string; valor: string }) => (
    <Text style={{ fontSize: 13, color: colores.texto, marginVertical: 2 }}><Text style={{ fontWeight: '700' }}>{dato}: </Text>{valor}</Text>
  );

  return (
    <Pantalla>
      <Boton titulo="← Volver" variante="secundario" onPress={() => router.back()} style={{ marginTop: 0 }} />
      <Titulo>Reclamo {reclamo.ticket}</Titulo>
      <Text style={{ fontSize: 12, color: colores.textoTenue, marginBottom: 10 }}>
        Registrado {antiguedad(reclamo.creadoEn)}{estaDemorado(reclamo) ? ' · pendiente hace más de 7 días' : ''}
      </Text>
      {!!error && <TextoError>{error}</TextoError>}

      <Tarjeta>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontWeight: '700', color: colores.texto }}>N° {reclamo.ticket}</Text>
          <Insignia tipo={reclamo.estado} />
        </View>
        <Fila dato="Línea" valor={reclamo.linea} />
        <Fila dato="Interno o patente" valor={reclamo.internoPatente || 'No informado'} />
        <Fila dato="Sentido" valor={`hacia ${reclamo.sentido}`} />
        <Fila dato="Motivo" valor={reclamo.motivoDescripcion} />
        <Fila dato="Fecha y hora del hecho" valor={fechaHoraArgentina(reclamo.fechaHoraHecho)} />
        <Fila dato="Ubicación" valor={reclamo.ubicacionTexto} />
        {!!reclamo.descripcion && <Fila dato="Descripción" valor={reclamo.descripcion} />}
        <Fila dato="Ciudadano" valor={`${reclamo.ciudadanoNombre} ${reclamo.ciudadanoApellido}`} />
        {reclamo.latitud !== null && reclamo.longitud !== null && (
          <MiniMapa punto={{ latitud: reclamo.latitud, longitud: reclamo.longitud }} onPress={() => {}} />
        )}
        {urlFoto && (
          <Image source={{ uri: urlFoto }} style={{ width: '100%', height: 200, borderRadius: 12, marginTop: 10 }}
            resizeMode="cover" accessibilityLabel="Foto adjunta al reclamo" />
        )}
      </Tarjeta>

      <Seccion>Cambiar estado</Seccion>
      {acciones.length ? (
        <View style={{ gap: 8 }}>
          {acciones.map((estado) => (
            <Boton key={estado} titulo={ACCION_ESTADO[estado] ?? estado} onPress={() => abrirAccion(estado)} style={{ marginTop: 0 }}
              variante={estado === 'Anulado' ? 'peligro' : estado === 'Atendido' ? 'primario' : 'contorno'} />
          ))}
        </View>
      ) : (
        <Ayuda style={{ marginTop: 0 }}>Estado final: no admite más cambios.</Ayuda>
      )}

      <Seccion>Seguimiento</Seccion>
      <LineaDeTiempo historial={historial} />

      <HojaModal visible={!!estadoNuevo} onCerrar={() => setEstadoNuevo(null)}>
        <Seccion style={{ marginTop: 0 }}>{estadoNuevo === 'Anulado' ? 'Anular reclamo' : `Pasar a ${estadoNuevo}`}</Seccion>
        <Ayuda style={{ marginTop: 0 }}>
          {estadoNuevo === 'Anulado'
            ? 'El motivo es obligatorio y lo verá el ciudadano en el seguimiento.'
            : 'El comentario es opcional y lo verá el ciudadano en el seguimiento.'}
        </Ayuda>
        {estadoNuevo === 'Anulado' && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
            {MOTIVOS_ANULACION.map((m) => (
              <Chip key={m} texto={m} seleccionado={comentario === m} onPress={() => { setComentario(m); setErrorAccion(''); }} />
            ))}
          </View>
        )}
        <View style={{ marginTop: 10 }}>
          <Campo
            value={comentario}
            onChangeText={(t) => { setComentario(t); setErrorAccion(''); }}
            placeholder={estadoNuevo === 'Atendido' ? 'Qué se hizo para resolverlo' : estadoNuevo === 'Anulado' ? 'Motivo de anulación' : 'Comentario (opcional)'}
            multiline
            accessibilityLabel={estadoNuevo === 'Anulado' ? 'Motivo de anulación' : 'Comentario'}
          />
        </View>
        {!!errorAccion && <TextoError>{errorAccion}</TextoError>}
        <Boton titulo="Confirmar" variante={estadoNuevo === 'Anulado' ? 'peligro' : 'primario'} cargando={guardando} onPress={confirmarCambio} />
        <Boton titulo="Cancelar" variante="secundario" onPress={() => setEstadoNuevo(null)} />
      </HojaModal>
    </Pantalla>
  );
}
