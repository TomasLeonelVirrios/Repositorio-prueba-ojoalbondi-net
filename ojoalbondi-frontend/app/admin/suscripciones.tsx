import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { Ayuda, Boton, Encabezado, Etiqueta, HojaModal, Insignia, Seccion, Selector, Tarjeta, TextoError } from '@/componentes/ui';
import { useTema } from '@/contextos/TemaContexto';
import {
  activarSuscripcion, LineaConSuscripcion, listarLineasConSuscripcion, listarOrganizaciones, Organizacion, suspenderSuscripcion,
} from '@/servicios/administracion';
import { mensajeDeError } from '@/utilidades/errores';
import { fechaArgentina } from '@/utilidades/fechas';

// RF-25 y RF-26 · El administrador decide qué empresa gestiona cada línea
export default function Suscripciones() {
  const { colores } = useTema();
  const [lineas, setLineas] = useState<LineaConSuscripcion[] | null>(null);
  const [empresas, setEmpresas] = useState<Organizacion[]>([]);
  const [error, setError] = useState('');

  const [lineaEditada, setLineaEditada] = useState<LineaConSuscripcion | null>(null);
  const [empresaElegida, setEmpresaElegida] = useState('');
  const [errorHoja, setErrorHoja] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [l, o] = await Promise.all([listarLineasConSuscripcion(), listarOrganizaciones()]);
      setLineas(l);
      setEmpresas(o.filter((x) => x.tipo === 'empresa'));
      setError('');
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudieron cargar las líneas.'));
      setLineas((l) => l ?? []);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const abrir = (l: LineaConSuscripcion) => {
    setLineaEditada(l);
    setEmpresaElegida(l.empresaOperadora?.nombre ?? '');
    setErrorHoja('');
  };

  const activar = async () => {
    const empresa = empresas.find((e) => e.nombre === empresaElegida);
    if (!lineaEditada || !empresa) return setErrorHoja('Elegí una empresa.');
    setGuardando(true);
    try {
      await activarSuscripcion(lineaEditada.linea, empresa.id);
      setLineaEditada(null);
      cargar();
    } catch (e) {
      setErrorHoja(mensajeDeError(e, 'No se pudo activar la suscripción.'));
    } finally {
      setGuardando(false);
    }
  };

  const suspender = (l: LineaConSuscripcion) => {
    if (!l.suscripcionActiva) return;
    Alert.alert(
      `Suspender la línea ${l.linea}`,
      `${l.suscripcionActiva.organizacion.nombre} dejará de ver estos reclamos. Los reclamos y su historial se conservan y los sigue gestionando el municipio.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Suspender', style: 'destructive',
          onPress: async () => {
            try { await suspenderSuscripcion(l.suscripcionActiva!.id); cargar(); }
            catch (e) { Alert.alert('Error', mensajeDeError(e)); }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colores.fondo }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Encabezado antetitulo="ADMINISTRACIÓN" titulo="Suscripciones por línea" detalle="Qué empresa gestiona los reclamos de cada línea" />
      <View style={{ padding: 20, width: '100%', maxWidth: 460, alignSelf: 'center' }}>
        <Ayuda style={{ marginTop: 0, marginBottom: 10 }}>
          Una sola empresa por línea. Sin suscripción activa, los reclamos de la línea los gestiona solo el municipio.
        </Ayuda>
        {!!error && <TextoError>{error}</TextoError>}
        {lineas === null ? <ActivityIndicator color={colores.primario} style={{ marginTop: 30 }} /> : lineas.map((l) => (
          <Tarjeta key={l.linea}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colores.texto }}>Línea {l.linea}</Text>
              {l.suscripcionActiva ? <Insignia tipo="Atendido" texto="Suscripción activa" /> : <Insignia tipo="Anulado" texto="Sin suscripción" />}
            </View>
            <Text style={{ fontSize: 12.5, color: colores.textoSecundario, marginTop: 6 }}>
              Opera: {l.empresaOperadora?.nombre ?? 'sin dato'}
            </Text>
            <Text style={{ fontSize: 13, color: colores.texto, marginTop: 3 }}>
              {l.suscripcionActiva
                ? `Gestiona: ${l.suscripcionActiva.organizacion.nombre}${l.suscripcionActiva.aprobadaEn ? ` · desde ${fechaArgentina(l.suscripcionActiva.aprobadaEn)}` : ''}`
                : 'Gestiona: Municipio'}
            </Text>
            {l.suscripcionActiva
              ? <Boton titulo="Suspender suscripción" variante="peligro" onPress={() => suspender(l)} style={{ marginTop: 12 }} />
              : <Boton titulo="Activar suscripción" variante="contorno" onPress={() => abrir(l)} style={{ marginTop: 12 }} />}
          </Tarjeta>
        ))}
      </View>

      <HojaModal visible={!!lineaEditada} onCerrar={() => setLineaEditada(null)}>
        <Seccion style={{ marginTop: 0 }}>Activar suscripción · Línea {lineaEditada?.linea}</Seccion>
        <Ayuda style={{ marginTop: 0 }}>La empresa verá todos los reclamos de la línea, también los anteriores.</Ayuda>
        <Etiqueta>Empresa</Etiqueta>
        <Selector valor={empresaElegida} opciones={empresas.map((e) => e.nombre)} textoVacio="Elegí una empresa" titulo="Empresa" onCambiar={setEmpresaElegida} />
        {lineaEditada?.empresaOperadora && <Ayuda>Según el relevamiento, la línea la opera {lineaEditada.empresaOperadora.nombre}.</Ayuda>}
        {!!errorHoja && <TextoError>{errorHoja}</TextoError>}
        <Boton titulo="Activar" onPress={activar} cargando={guardando} />
        <Boton titulo="Cancelar" variante="secundario" onPress={() => setLineaEditada(null)} />
      </HojaModal>
    </ScrollView>
  );
}
