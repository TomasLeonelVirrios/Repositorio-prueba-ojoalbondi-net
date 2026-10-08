import NetInfo from '@react-native-community/netinfo';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { borradoresDe, sincronizarBorradores } from '../servicios/borradores';
import { useSesion } from './SesionContexto';

type ValorConexion = {
  conectado: boolean;
  borradoresPendientes: number;      // reclamos guardados esperando conexión
  borradoresSincronizados: number;   // enviados en la última reconexión (para el aviso verde)
  actualizarPendientes: () => Promise<void>;
};

const ConexionContexto = createContext<ValorConexion>({
  conectado: true,
  borradoresPendientes: 0,
  borradoresSincronizados: 0,
  actualizarPendientes: async () => {},
});

const SEGUNDOS_AVISO_SINCRONIZADOS = 6;

export function ProveedorConexion({ children }: { children: ReactNode }) {
  const { sesion } = useSesion();
  const ciudadanoId = sesion?.user.id;
  const [conectado, setConectado] = useState(true);
  const [borradoresPendientes, setPendientes] = useState(0);
  const [borradoresSincronizados, setSincronizados] = useState(0);
  const sincronizando = useRef(false);

  const actualizarPendientes = useCallback(async () => {
    setPendientes(ciudadanoId ? (await borradoresDe(ciudadanoId)).length : 0);
  }, [ciudadanoId]);

  const sincronizar = useCallback(async () => {
    if (!ciudadanoId || sincronizando.current) return;
    sincronizando.current = true;
    const enviados = await sincronizarBorradores(ciudadanoId);
    sincronizando.current = false;
    if (enviados > 0) {
      setSincronizados(enviados);
      setTimeout(() => setSincronizados(0), SEGUNDOS_AVISO_SINCRONIZADOS * 1000);
    }
    await actualizarPendientes();
  }, [ciudadanoId, actualizarPendientes]);

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

  return (
    <ConexionContexto.Provider value={{ conectado, borradoresPendientes, borradoresSincronizados, actualizarPendientes }}>
      {children}
    </ConexionContexto.Provider>
  );
}

export const useConexion = () => useContext(ConexionContexto);
