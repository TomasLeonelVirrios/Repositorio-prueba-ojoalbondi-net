import * as Location from 'expo-location';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View, ViewStyle } from 'react-native';
import { Ayuda, Boton, Encabezado, Etiqueta, HojaModal, Seccion, TapaBarraEstado, Tarjeta } from '../componentes/ui';
import { TERMINOS_Y_CONDICIONES } from '../constantes/textos';
import { esInstitucion, NOMBRE_ROL, useSesion } from '../contextos/SesionContexto';
import { Tema, useTema } from '../contextos/TemaContexto';
import { fechaArgentina } from '../utilidades/fechas';

const FILA: ViewStyle = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 };

/**
 * Ajustes (RF-06). La usan todos los perfiles.
 * Arriba está el nombre de la cuenta: al tocarlo se ven los datos personales (RF-24).
 * El permiso de ubicación es solo del ciudadano. El interruptor "Avisos de estado" se quitó hasta que
 * existan las notificaciones (RF-09); antes guardaba la preferencia pero no avisaba nada.
 */
export default function AjustesPantalla() {
  const { colores, tema, cambiarTema } = useTema();
  const { sesion, perfil, cerrarSesion } = useSesion();
  const institucion = esInstitucion(perfil);
  const [estadoUbicacion, setEstadoUbicacion] = useState('');
  const [verTerminos, setVerTerminos] = useState(false);
  const [verMisDatos, setVerMisDatos] = useState(false);

  const probarUbicacion = async () => {
    setEstadoUbicacion('Pidiendo permiso…');
    const { status } = await Location.requestForegroundPermissionsAsync();
    setEstadoUbicacion(status === 'granted' ? '✅ Permiso otorgado.' : '❌ Permiso denegado: revisalo en la configuración del celular.');
  };

  const datosPersonales: [string, string][] = perfil ? [
    ['Nombre', perfil.nombre],
    ['Apellido', perfil.apellido],
    ['Fecha de nacimiento', perfil.fecha_nacimiento ? fechaArgentina(perfil.fecha_nacimiento) : '—'],
    ['Correo', sesion?.user.email ?? '—'],
    ['Perfil', NOMBRE_ROL[perfil.rol] + (perfil.organizacion_nombre ? ` · ${perfil.organizacion_nombre}` : '')],
  ] : [];
  const iniciales = perfil ? `${perfil.nombre.charAt(0)}${perfil.apellido.charAt(0)}`.toUpperCase() : '';

  return (
    <View style={{ flex: 1, backgroundColor: colores.fondo }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Encabezado antetitulo="OJO AL BONDI" titulo="Ajustes" detalle={institucion ? perfil?.organizacion_nombre : null} />

        <View style={{ padding: 20, paddingTop: 18, width: '100%', maxWidth: 460, alignSelf: 'center' }}>
          {/* RF-24: al tocar el nombre se ven los datos de la cuenta */}
          {perfil && (
            <Tarjeta onPress={() => setVerMisDatos(true)} style={[FILA, { marginTop: 4 }]}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colores.primario, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colores.sobrePrimario }}>{iniciales}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colores.texto }}>{perfil.nombre} {perfil.apellido}</Text>
                <Text style={{ fontSize: 12, color: colores.textoSecundario, marginTop: 2 }}>Ver mis datos personales</Text>
              </View>
              <Text style={{ color: colores.texto, fontSize: 18 }}>›</Text>
            </Tarjeta>
          )}

          <Seccion>APARIENCIA</Seccion>
          <Tarjeta>
            <Etiqueta style={{ marginTop: 0 }}>Tema</Etiqueta>
            <View style={{ flexDirection: 'row', backgroundColor: colores.fondo, borderRadius: 10, padding: 3, marginTop: 6 }}>
              {(['claro', 'oscuro'] as Tema[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => cambiarTema(t)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: tema === t }}
                  style={{ flex: 1, minHeight: 44, justifyContent: 'center', borderRadius: 8, alignItems: 'center', backgroundColor: tema === t ? colores.primarioOscuro : 'transparent' }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: tema === t ? '#FFFFFF' : colores.textoSecundario }}>
                    {t === 'claro' ? 'Claro' : 'Oscuro'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Tarjeta>

          {!institucion && (
            <>
              <Seccion>PERMISOS</Seccion>
              <Tarjeta>
                <View style={FILA}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colores.texto }}>Ubicación</Text>
                    <Text style={{ fontSize: 12, color: colores.textoSecundario }}>Para completar el lugar del reclamo.</Text>
                  </View>
                  <Boton titulo="Probar" variante="secundario" onPress={probarUbicacion} style={{ marginTop: 0 }} />
                </View>
                {!!estadoUbicacion && <Ayuda>{estadoUbicacion}</Ayuda>}
              </Tarjeta>
            </>
          )}

          <Seccion>LEGAL</Seccion>
          <Tarjeta onPress={() => setVerTerminos(true)} style={FILA}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colores.texto }}>Términos y condiciones</Text>
            <Text style={{ color: colores.texto }}>›</Text>
          </Tarjeta>

          <Boton titulo="Cerrar sesión" variante="peligro" onPress={cerrarSesion} />
        </View>

        <HojaModal visible={verMisDatos} onCerrar={() => setVerMisDatos(false)}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colores.texto, marginBottom: 8 }}>Mis datos</Text>
          {datosPersonales.map(([dato, valor], i) => (
            <View key={dato} style={[FILA, { paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colores.borde }]}>
              <Text style={{ fontSize: 13, color: colores.textoSecundario }}>{dato}</Text>
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: colores.texto, flexShrink: 1, textAlign: 'right' }}>{valor}</Text>
            </View>
          ))}
          <Ayuda>Son los datos que cargaste al crear la cuenta.</Ayuda>
          <Boton titulo="Cerrar" onPress={() => setVerMisDatos(false)} />
        </HojaModal>

        <HojaModal visible={verTerminos} onCerrar={() => setVerTerminos(false)}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colores.texto, marginBottom: 8 }}>Términos y condiciones</Text>
          <Text style={{ fontSize: 13, color: colores.textoSecundario, lineHeight: 21 }}>{TERMINOS_Y_CONDICIONES}</Text>
          <Ayuda>Demo académica (Aplicaciones Móviles): texto de referencia, no un documento legal definitivo.</Ayuda>
          <Boton titulo="Cerrar" onPress={() => setVerTerminos(false)} />
        </HojaModal>
      </ScrollView>
      <TapaBarraEstado />
    </View>
  );
}
