import NetInfo from '@react-native-community/netinfo';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { borradoresDe, descartarBorrador, reintentarBorrador, sincronizarBorradores } from '../servicios/borradores';
import { Borrador } from '../tipos';
import { useSesion } from './SesionContexto';

type ValorConexion = {
  conectado: boolean;
  borradoresPendientes: number;      // reclamos guardados esperando conexión
  borradoresSincronizados: number;   // enviados en la última reconexión (para el aviso verde)
  borradoresConError: Borrador[];    // rechazados por la base: el ciudadano decide qué hacer
  actualizarPendientes: () => Promise<void>;
  reintentar: (idLocal: string) => Promise<void>;
  descartar: (idLocal: string) => Promise<void>;
};

const ConexionContexto = createContext<ValorConexion>({
  conectado: true,
  borradoresPendientes: 0,
  borradoresSincronizados: 0,
  borradoresConError: [],
  actualizarPendientes: async () => {},
  reintentar: async () => {},
  descartar: async () => {},
});

const SEGUNDOS_AVISO_SINCRONIZADOS = 6;
const SEGUNDOS_ENTRE_REINTENTOS = 30;

export function ProveedorConexion({ children }: { children: ReactNode }) {
  const { sesion } = useSesion();
  const ciudadanoId = sesion?.user.id;
  const [conectado, setConectado] = useState(true);
  const [borradoresPendientes, setPendientes] = useState(0);
  const [borradoresSincronizados, setSincronizados] = useState(0);
  const [borradoresConError, setConError] = useState<Borrador[]>([]);
  const sincronizando = useRef(false);

  const actualizarPendientes = useCallback(async () => {
    const propios = ciudadanoId ? await borradoresDe(ciudadanoId) : [];
    setPendientes(propios.filter((b) => !b.error).length);
    setConError(propios.filter((b) => !!b.error));
  }, [ciudadanoId]);

  const sincronizar = useCallback(async () => {
    if (!ciudadanoId || sincronizando.current) return;
    sincronizando.current = true;
    try {
      const enviados = await sincronizarBorradores(ciudadanoId);
      if (enviados > 0) {
        setSincronizados(enviados);
        setTimeout(() => setSincronizados(0), SEGUNDOS_AVISO_SINCRONIZADOS * 1000);
      }
    } catch {
      // por ejemplo, el almacenamiento del celular está lleno: se reintenta en la próxima reconexión
    } finally {
      sincronizando.current = false;
    }
    await actualizarPendientes().catch(() => {});
  }, [ciudadanoId, actualizarPendientes]);

  const reintentar = useCallback(async (idLocal: string) => {
    await reintentarBorrador(idLocal);
    await actualizarPendientes();
    if (conectado) await sincronizar();
  }, [actualizarPendientes, sincronizar, conectado]);

  const descartar = useCallback(async (idLocal: string) => {
    await descartarBorrador(idLocal);
    await actualizarPendientes();
  }, [actualizarPendientes]);

  useEffect(() => {
    return NetInfo.addEventListener((estado) => {
      const hayConexion = !!estado.isConnected && estado.isInternetReachable !== false;
      setConectado(hayConexion);
      if (hayConexion) sincronizar();  // al volver la señal, los borradores se envían solos
    });
  }, [sincronizar]);

  useEffect(() => {
    actualizarPendientes();
  }, [actualizarPendientes]);

  // Si un envío falló por la red justo cuando volvía la señal, NetInfo no vuelve a avisar:
  // mientras haya conexión y borradores esperando, se reintenta cada 30 segundos.
  useEffect(() => {
    if (!conectado || borradoresPendientes === 0) return;
    const id = setInterval(sincronizar, SEGUNDOS_ENTRE_REINTENTOS * 1000);
    return () => clearInterval(id);
  }, [conectado, borradoresPendientes, sincronizar]);

  return (
    <ConexionContexto.Provider value={{ conectado, borradoresPendientes, borradoresSincronizados, borradoresConError, actualizarPendientes, reintentar, descartar }}>
      {children}
    </ConexionContexto.Provider>
  );
}

export const useConexion = () => useContext(ConexionContexto);
