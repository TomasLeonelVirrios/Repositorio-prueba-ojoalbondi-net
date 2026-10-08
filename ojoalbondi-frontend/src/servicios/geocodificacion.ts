import * as Location from 'expo-location';
import { Parada, Punto } from '../tipos';

// Búsqueda de direcciones y nombres de lugares con el geocodificador del celular (sin costo ni API key).

export type ResultadoBusqueda = { punto: Punto; texto: string };

/** Centro de Pilar: referencia para ordenar resultados y vista inicial del mapa. */
export const CENTRO_PILAR: Punto = { latitud: -34.4587, longitud: -58.9142 };

/** Distancia en kilómetros entre dos puntos (fórmula de Haversine). */
export function distanciaKm(a: Punto, b: Punto): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.latitud - a.latitud);
  const dLon = rad(b.longitud - a.longitud);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitud)) * Math.cos(rad(b.latitud)) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Convierte coordenadas en "Calle 123, Ciudad"; si no se puede, devuelve "Lat x, Lon y" como el index. */
export async function textoDeUbicacion({ latitud, longitud }: Punto): Promise<string> {
  const coords = `Lat ${latitud.toFixed(4)}, Lon ${longitud.toFixed(4)}`;
  try {
    const [d] = await Location.reverseGeocodeAsync({ latitude: latitud, longitude: longitud });
    if (!d) return coords;
    const calle = [d.street, d.streetNumber].filter(Boolean).join(' ');
    const lugar = d.city || d.subregion || d.district;
    return [calle, lugar].filter(Boolean).join(', ') || coords;
  } catch {
    return coords;
  }
}

/**
 * Busca "calle altura" y devuelve los lugares encontrados, los más cercanos a Pilar primero.
 * Sin coma se asume Pilar ("Tucumán 750"); con coma se respeta la localidad ("Tucumán 750, Del Viso").
 */
export async function buscarDireccion(consulta: string): Promise<ResultadoBusqueda[]> {
  const q = consulta.trim();
  if (!q) return [];
  const intentos = q.includes(',')
    ? [`${q}, Buenos Aires, Argentina`, q]
    : [`${q}, Pilar, Buenos Aires, Argentina`, `${q}, Buenos Aires, Argentina`];
  const centroPilar = CENTRO_PILAR;
  for (const intento of intentos) {
    let crudos: Location.LocationGeocodedLocation[] = [];
    try {
      crudos = await Location.geocodeAsync(intento);
    } catch {
      continue;
    }
    const puntos = crudos
      .map((g) => ({ latitud: g.latitude, longitud: g.longitude }))
      .sort((a, b) => distanciaKm(a, centroPilar) - distanciaKm(b, centroPilar));
    const unicos: Punto[] = [];
    for (const p of puntos) if (!unicos.some((u) => distanciaKm(u, p) < 0.03)) unicos.push(p);
    if (unicos.length) {
      const top = unicos.slice(0, 5);
      const textos = await Promise.all(top.map(textoDeUbicacion));
      return top.map((punto, i) => ({ punto, texto: textos[i] }));
    }
  }
  return [];
}

/** Texto que va al campo Ubicación del formulario para una parada. */
export async function textoDeParada(p: Parada): Promise<string> {
  if (p.nombre) return `Parada ${p.nombre}`;
  return `Parada en ${await textoDeUbicacion(p)}`;
}
