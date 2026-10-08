// Paleta de la app. Contraste mínimo 4.5:1 en textos, en ambos temas (RNF-06, WCAG AA).
const claro = {
  primario: '#1565D8',
  sobrePrimario: '#FFFFFF',        // texto sobre fondo primario
  primarioOscuro: '#173A67',
  primarioSuave: '#E8F2FF',
  peligro: '#C62828',
  peligroSuave: '#FDEAEA',
  exito: '#167A4C',
  exitoSuave: '#E6F7EE',
  advertencia: '#8A6500',
  advertenciaSuave: '#FFF6DF',
  fondo: '#F4F6F9',
  superficie: '#FFFFFF',
  borde: '#E2E8F0',
  texto: '#1B2734',
  textoSecundario: '#5B6B7C',
  textoTenue: '#5F6F82',
};
export type Colores = typeof claro;

const oscuro: Colores = {
  ...claro,
  primario: '#5B9BF0',
  sobrePrimario: '#0F1620',
  primarioSuave: '#15263D',
  peligro: '#F26B6B',
  peligroSuave: '#3B1B1B',
  exito: '#3CC287',
  exitoSuave: '#113321',
  advertencia: '#E0B84A',
  advertenciaSuave: '#3A2E0C',
  fondo: '#0F1620',
  superficie: '#1A2433',
  borde: '#2A3647',
  texto: '#F0F4F8',
  textoSecundario: '#9FB0C0',
  textoTenue: '#8494A5',
};

export const PALETAS = { claro, oscuro };
