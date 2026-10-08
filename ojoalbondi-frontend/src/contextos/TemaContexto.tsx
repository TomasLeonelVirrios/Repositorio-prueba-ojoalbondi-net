import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { CLAVES } from '../constantes/almacenamiento';
import { Colores, PALETAS } from '../tema/colores';

export type Tema = 'claro' | 'oscuro';
type ValorTema = { tema: Tema; colores: Colores; cambiarTema: (t: Tema) => void };

const TemaContexto = createContext<ValorTema>({ tema: 'claro', colores: PALETAS.claro, cambiarTema: () => {} });

export function ProveedorTema({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>('claro');

  useEffect(() => {
    AsyncStorage.getItem(CLAVES.tema).then((t) => t === 'oscuro' && setTema('oscuro'));
  }, []);

  const cambiarTema = (t: Tema) => {
    setTema(t);
    AsyncStorage.setItem(CLAVES.tema, t);
  };

  return <TemaContexto.Provider value={{ tema, colores: PALETAS[tema], cambiarTema }}>{children}</TemaContexto.Provider>;
}

export const useTema = () => useContext(TemaContexto);
