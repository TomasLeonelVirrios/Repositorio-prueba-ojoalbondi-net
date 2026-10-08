import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { Ayuda, Boton, Campo, Encabezado, Etiqueta, HojaModal, Seccion, Selector, Tarjeta, TextoError } from '@/componentes/ui';
import { NOMBRE_ROL, useSesion } from '@/contextos/SesionContexto';
import { useTema } from '@/contextos/TemaContexto';
import { asignarRol, Cuenta, listarCuentas, listarOrganizaciones, Organizacion } from '@/servicios/administracion';
import { Rol } from '@/tipos';
import { mensajeDeError } from '@/utilidades/errores';

const ROLES: Rol[] = ['ciudadano', 'empresa', 'municipio', 'admin'];
const necesitaOrganizacion = (rol: Rol) => rol === 'empresa' || rol === 'municipio';

// RF-26 y RN-02 · El administrador asigna el rol y la organización de cada cuenta
export default function Cuentas() {
  const { colores } = useTema();
  const { perfil } = useSesion();
  const [cuentas, setCuentas] = useState<Cuenta[] | null>(null);
  const [organizaciones, setOrganizaciones] = useState<Organizacion[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');

  const [editada, setEditada] = useState<Cuenta | null>(null);
  const [rol, setRol] = useState<Rol>('ciudadano');
  const [organizacion, setOrganizacion] = useState('');
  const [errorHoja, setErrorHoja] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [c, o] = await Promise.all([listarCuentas(), listarOrganizaciones()]);
      setCuentas(c);
      setOrganizaciones(o);
      setError('');
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudieron cargar las cuentas.'));
      setCuentas((c) => c ?? []);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const nombreOrganizacion = (id: string | null) => organizaciones.find((o) => o.id === id)?.nombre ?? '';
  // Empresa: solo empresas. Municipio: solo el municipio.
  const opcionesOrganizacion = organizaciones.filter((o) => (rol === 'municipio' ? o.tipo === 'municipio' : o.tipo === 'empresa'));

  const abrir = (c: Cuenta) => {
    setEditada(c);
    setRol(c.rol);
    setOrganizacion(nombreOrganizacion(c.organizacionId));
    setErrorHoja('');
  };

  const guardar = async () => {
    if (!editada) return;
    const org = opcionesOrganizacion.find((o) => o.nombre === organizacion);
    if (necesitaOrganizacion(rol) && !org) return setErrorHoja('Elegí la organización de la cuenta.');
    setGuardando(true);
    try {
      await asignarRol(editada.id, rol, necesitaOrganizacion(rol) ? org!.id : null);
      setEditada(null);
      cargar();
    } catch (e) {
      setErrorHoja(mensajeDeError(e, 'No se pudo cambiar el rol.'));
    } finally {
      setGuardando(false);
    }
  };

  const filtradas = (cuentas ?? []).filter((c) =>
    `${c.nombre} ${c.apellido} ${c.correo}`.toLowerCase().includes(busqueda.trim().toLowerCase()));

  return (
    <View style={{ flex: 1, backgroundColor: colores.fondo }}>
      <FlatList
        data={filtradas}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View>
            <Encabezado antetitulo="ADMINISTRACIÓN" titulo="Cuentas" detalle="Rol y organización de cada usuario" />
            <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
              <Ayuda style={{ marginTop: 0, marginBottom: 10 }}>
                Las cuentas nuevas se registran como ciudadanos. Desde acá se convierten en cuentas de empresa, municipio o administración.
              </Ayuda>
              <Campo value={busqueda} onChangeText={setBusqueda} placeholder="Buscar por nombre o correo" autoCapitalize="none" accessibilityLabel="Buscar cuentas" />
              {!!error && <TextoError>{error}</TextoError>}
              <Text style={{ fontSize: 12, color: colores.textoSecundario, marginTop: 10, marginBottom: 8 }}>{filtradas.length} cuenta(s)</Text>
            </View>
          </View>
        }
        ListEmptyComponent={cuentas === null ? <ActivityIndicator color={colores.primario} style={{ marginTop: 30 }} /> : null}
        renderItem={({ item: c }) => (
          <View style={{ paddingHorizontal: 20 }}>
            <Tarjeta onPress={() => abrir(c)}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colores.texto }}>{c.nombre} {c.apellido}</Text>
              <Text style={{ fontSize: 12.5, color: colores.textoSecundario, marginTop: 2 }}>{c.correo}</Text>
              <Text style={{ fontSize: 12.5, color: colores.primario, fontWeight: '600', marginTop: 6 }}>
                {NOMBRE_ROL[c.rol]}{c.organizacionId ? ` · ${nombreOrganizacion(c.organizacionId)}` : ''}
              </Text>
            </Tarjeta>
          </View>
        )}
      />

      <HojaModal visible={!!editada} onCerrar={() => setEditada(null)}>
        <Seccion style={{ marginTop: 0 }}>{editada?.nombre} {editada?.apellido}</Seccion>
        <Ayuda style={{ marginTop: 0 }}>{editada?.correo}</Ayuda>
        <Etiqueta>Rol</Etiqueta>
        <Selector
          valor={NOMBRE_ROL[rol]}
          opciones={ROLES.map((r) => NOMBRE_ROL[r])}
          textoVacio="Elegí un rol" titulo="Rol"
          onCambiar={(texto) => { setRol(ROLES.find((r) => NOMBRE_ROL[r] === texto)!); setOrganizacion(''); }}
        />
        {necesitaOrganizacion(rol) && (
          <>
            <Etiqueta>Organización</Etiqueta>
            <Selector valor={organizacion} opciones={opcionesOrganizacion.map((o) => o.nombre)} textoVacio="Elegí la organización" titulo="Organización" onCambiar={setOrganizacion} />
          </>
        )}
        {editada?.id === perfil?.id && <Ayuda>Es tu propia cuenta: no podés quitarte el rol de administración.</Ayuda>}
        {!!errorHoja && <TextoError>{errorHoja}</TextoError>}
        <Boton titulo="Guardar" onPress={guardar} cargando={guardando} />
        <Boton titulo="Cancelar" variante="secundario" onPress={() => setEditada(null)} />
      </HojaModal>
    </View>
  );
}
