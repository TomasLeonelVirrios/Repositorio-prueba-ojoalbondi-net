import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTema } from '../../contextos/TemaContexto';
import { Punto } from '../../tipos';

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type MarcadorOSM = {
  id: number;
  latitud: number;
  longitud: number;
  tipo?: 'parada' | 'calor';
  elegido?: boolean;
  nombre?: string;
  cantidad?: number;
  color?: string;
  diametro?: number;
};

export type MapaOSMRef = {
  animarA: (punto: Punto, zoom?: number) => void;
};

type Props = {
  regionInicial?: Region;
  onRegionChangeComplete?: (region: Region) => void;
  onMapPress?: () => void;
  onMarkerPress?: (id: number) => void;
  marcadores?: MarcadorOSM[];
  puntoBuscado?: Punto | null;
  interactive?: boolean;
  zoom?: number;
  style?: ViewStyle;
};

function deltaAZoom(latitudeDelta?: number): number {
  if (!latitudeDelta || latitudeDelta <= 0) return 15;
  const z = Math.round(Math.log2(360 / latitudeDelta));
  return Math.min(Math.max(z, 3), 19);
}

export const MapaOSM = forwardRef<MapaOSMRef, Props>(function MapaOSM(
  {
    regionInicial,
    onRegionChangeComplete,
    onMapPress,
    onMarkerPress,
    marcadores = [],
    puntoBuscado = null,
    interactive = true,
    zoom,
    style,
  },
  ref
) {
  const { colores, tema } = useTema();
  const webViewRef = useRef<WebView>(null);
  const [cargado, setCargado] = useState(false);

  const latInicial = regionInicial?.latitude ?? -34.4587;
  const lonInicial = regionInicial?.longitude ?? -58.9142;
  const zoomInicial = zoom ?? deltaAZoom(regionInicial?.latitudeDelta);

  const marcadoresRef = useRef(marcadores);
  marcadoresRef.current = marcadores;
  const puntoBuscadoRef = useRef(puntoBuscado);
  puntoBuscadoRef.current = puntoBuscado;

  useImperativeHandle(ref, () => ({
    animarA: (punto: Punto, zoomNivel = 16) => {
      const js = `window.animarA && window.animarA(${punto.latitud}, ${punto.longitud}, ${zoomNivel}); true;`;
      webViewRef.current?.injectJavaScript(js);
    },
  }));

  // Sincronizar marcadores hacia la vista web cuando cambian
  useEffect(() => {
    if (!cargado) return;
    const datos = JSON.stringify(marcadores);
    const buscado = JSON.stringify(puntoBuscado);
    const js = `window.actualizarMarcadores && window.actualizarMarcadores(${datos}, ${buscado}); true;`;
    webViewRef.current?.injectJavaScript(js);
  }, [marcadores, puntoBuscado, cargado]);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #e5e3df; overflow: hidden; }
    .leaflet-control-attribution { font-size: 9px !important; background: rgba(255,255,255,0.7) !important; padding: 0 4px !important; }
    .custom-marker, .custom-pin { background: transparent !important; border: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map;
    var markersGroup;
    var searchGroup;

    function init() {
      map = L.map('map', {
        zoomControl: false,
        attributionControl: ${interactive ? 'true' : 'false'},
        dragging: ${interactive ? 'true' : 'false'},
        touchZoom: ${interactive ? 'true' : 'false'},
        doubleClickZoom: ${interactive ? 'true' : 'false'},
        scrollWheelZoom: ${interactive ? 'true' : 'false'},
        boxZoom: false
      }).setView([${latInicial}, ${lonInicial}], ${zoomInicial});

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      markersGroup = L.layerGroup().addTo(map);
      searchGroup = L.layerGroup().addTo(map);

      if (${interactive ? 'true' : 'false'}) {
        map.on('moveend', function() {
          var c = map.getCenter();
          var b = map.getBounds();
          var latDelta = Math.abs(b.getNorth() - b.getSouth());
          var lonDelta = Math.abs(b.getEast() - b.getWest());
          enviar({
            tipo: 'region-change',
            region: {
              latitude: c.lat,
              longitude: c.lng,
              latitudeDelta: latDelta,
              longitudeDelta: lonDelta
            }
          });
        });

        map.on('click', function() {
          enviar({ tipo: 'map-press' });
        });
      }

      enviar({ tipo: 'ready' });
    }

    function enviar(data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }

    window.animarA = function(lat, lng, zoomNivel) {
      if (map) {
        map.flyTo([lat, lng], zoomNivel || 16, { duration: 0.6 });
      }
    };

    window.actualizarMarcadores = function(marcadores, puntoBuscado) {
      if (!markersGroup || !searchGroup) return;
      markersGroup.clearLayers();

      if (Array.isArray(marcadores)) {
        marcadores.forEach(function(m) {
          var iconHtml;
          var w = 26, h = 26;

          if (m.tipo === 'calor') {
            w = m.diametro || 26;
            h = w;
            var borde = m.elegido ? '3px solid #1B2734' : '1px solid rgba(0,0,0,0.15)';
            iconHtml = '<div style="width:' + w + 'px;height:' + h + 'px;border-radius:' + (w/2) + 'px;background-color:' + (m.color || '#F5A623') + ';opacity:0.92;border:' + borde + ';display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,0.3);font-family:sans-serif;font-weight:800;font-size:11px;color:#1B2734;">' + (m.cantidad || 0) + '</div>';
          } else {
            if (m.elegido) {
              w = 36; h = 36;
              iconHtml = '<div style="width:36px;height:36px;border-radius:18px;background-color:#0077D7;border:2px solid #FFFFFF;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,119,215,0.45);"><svg width="18" height="18" viewBox="0 0 24 24" fill="#FFFFFF"><path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg></div>';
            } else {
              w = 26; h = 26;
              iconHtml = '<div style="width:26px;height:26px;border-radius:13px;background-color:#FFFFFF;border:2px solid #173A67;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.25);"><svg width="13" height="13" viewBox="0 0 24 24" fill="#173A67"><path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg></div>';
            }
          }

          var icon = L.divIcon({
            className: 'custom-marker',
            html: iconHtml,
            iconSize: [w, h],
            iconAnchor: [w / 2, h / 2]
          });

          var marker = L.marker([m.latitud, m.longitud], {
            icon: icon,
            zIndexOffset: m.elegido ? 1000 : (m.tipo === 'calor' ? (m.cantidad || 0) : 1)
          });

          marker.on('click', function(e) {
            L.DomEvent.stopPropagation(e);
            enviar({ tipo: 'marker-press', id: m.id });
          });

          markersGroup.addLayer(marker);
        });
      }

      searchGroup.clearLayers();
      if (puntoBuscado && puntoBuscado.latitud && puntoBuscado.longitud) {
        var pinHtml = '<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35));"><svg width="24" height="32" viewBox="0 0 24 32" fill="none"><path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z" fill="#E53935"/><circle cx="12" cy="12" r="5" fill="#FFFFFF"/></svg></div>';
        var pinIcon = L.divIcon({
          className: 'custom-pin',
          html: pinHtml,
          iconSize: [24, 32],
          iconAnchor: [12, 32]
        });
        var pinMarker = L.marker([puntoBuscado.latitud, puntoBuscado.longitud], { icon: pinIcon, zIndexOffset: 2000 });
        searchGroup.addLayer(pinMarker);
      }
    };

    window.addEventListener('DOMContentLoaded', init);
  </script>
</body>
</html>`;

  const onMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.tipo === 'ready') {
        setCargado(true);
        // Enviar marcadores iniciales inmediatamente
        const d = JSON.stringify(marcadoresRef.current);
        const b = JSON.stringify(puntoBuscadoRef.current);
        webViewRef.current?.injectJavaScript(`window.actualizarMarcadores && window.actualizarMarcadores(${d}, ${b}); true;`);
      } else if (data.tipo === 'region-change') {
        onRegionChangeComplete?.(data.region);
      } else if (data.tipo === 'marker-press') {
        onMarkerPress?.(data.id);
      } else if (data.tipo === 'map-press') {
        onMapPress?.();
      }
    } catch {
      // Ignorar mensajes no JSON
    }
  };

  return (
    <View style={[styles.contenedor, { backgroundColor: colores.fondo }, style]}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        scrollEnabled={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        androidLayerType="hardware"
      />
      {!cargado && (
        <View pointerEvents="none" style={[styles.cargando, { backgroundColor: colores.fondo }]}>
          <ActivityIndicator size="large" color={colores.primario} />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  cargando: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
