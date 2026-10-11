import { Punto } from '../../tipos';

/** Zona visible del mapa: centro y apertura en grados. */
export type RegionMapa = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

/** Marcador que dibuja el mapa. Los colores van como CSS (por ejemplo '#1565D8' o 'hsl(…)'). */
export type MarcadorMapa = {
  id: string;
  latitud: number;
  longitud: number;
  diametro?: number;
  fondo?: string;
  borde?: string;        // CSS, por ejemplo '2px solid #173A67'
  texto?: string;        // texto o emoji en el centro
  opacidad?: number;
  zIndex?: number;
  pin?: boolean;         // pin rojo no tocable (dirección buscada o punto elegido)
};

export type PropsMapa = {
  regionInicial: RegionMapa;
  marcadores: MarcadorMapa[];
  oscuro?: boolean;
  interactivo?: boolean;
  ubicacionUsuario?: Punto | null;
  onRegion?: (region: RegionMapa) => void;
  onMarcador?: (id: string) => void;
  onToque?: () => void;
};

/** Acciones que se pueden pedir al mapa desde afuera (con ref). */
export type ControlMapa = { irA: (punto: Punto, latitudeDelta?: number) => void };

/** Mensajes que manda la página del mapa. */
export type MensajeMapa =
  | { tipo: 'listo' | 'region'; region: RegionMapa }
  | { tipo: 'marcador'; id: string }
  | { tipo: 'toque' };
