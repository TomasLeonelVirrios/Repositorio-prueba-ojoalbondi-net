// Página HTML con el mapa (Leaflet + OpenStreetMap) que se muestra dentro de un WebView (iPhone y Android)
// o de un iframe (web). Así el mapa se ve igual en todos los dispositivos y no necesita API key de Google.
// La app le manda los marcadores con mensajes y el mapa avisa cuando el usuario lo mueve o toca algo.

import { RegionMapa } from './tiposMapa';

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist';

export function htmlMapa(region: RegionMapa, oscuro: boolean, interactivo: boolean): string {
  const zoom = zoomDesdeDelta(region.latitudeDelta);
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="${LEAFLET}/leaflet.css">
<script src="${LEAFLET}/leaflet.js"></script>
<style>
  html, body, #mapa { margin: 0; padding: 0; height: 100%; width: 100%; background: ${oscuro ? '#0F1620' : '#E9EEF3'}; }
  .leaflet-div-icon { background: transparent; border: none; }
  .marca { display: flex; align-items: center; justify-content: center; border-radius: 50%; box-sizing: border-box;
           font: 800 11px -apple-system, Roboto, sans-serif; color: #1B2734; box-shadow: 0 1px 4px rgba(0,0,0,.35); }
  .leaflet-control-attribution { font-size: 9px; }
</style>
</head><body>
<div id="mapa"></div>
<script>
  var mapa = L.map('mapa', {
    zoomControl: false, attributionControl: true,
    dragging: ${interactivo}, touchZoom: ${interactivo}, scrollWheelZoom: ${interactivo},
    doubleClickZoom: ${interactivo}, boxZoom: false, keyboard: false, tap: ${interactivo}
  }).setView([${region.latitude}, ${region.longitude}], ${zoom});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(mapa);
  var capa = L.layerGroup().addTo(mapa);
  var ubicacion = null;

  function enviar(datos) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(datos));
    else if (window.parent !== window) window.parent.postMessage(Object.assign({ fuente: 'ojoalbondi-mapa' }, datos), '*');
  }
  function region() {
    var b = mapa.getBounds(), c = mapa.getCenter();
    return { latitude: c.lat, longitude: c.lng,
             latitudeDelta: Math.abs(b.getNorth() - b.getSouth()), longitudeDelta: Math.abs(b.getEast() - b.getWest()) };
  }
  function icono(m) {
    var d = m.diametro || 26;
    var html = '<div class="marca" style="width:' + d + 'px;height:' + d + 'px;background:' + (m.fondo || '#fff') +
               ';border:' + (m.borde || '2px solid #173A67') + ';opacity:' + (m.opacidad || 1) + '">' + (m.texto || '') + '</div>';
    return L.divIcon({ html: html, className: '', iconSize: [d, d], iconAnchor: [d / 2, d / 2] });
  }
  var PIN = L.divIcon({ className: '', iconSize: [26, 36], iconAnchor: [13, 36],
    html: '<svg width="26" height="36" viewBox="0 0 26 36"><path d="M13 0C5.8 0 0 5.8 0 13c0 9.8 13 23 13 23s13-13.2 13-23C26 5.8 20.2 0 13 0z" fill="#C62828"/><circle cx="13" cy="13" r="5" fill="#fff"/></svg>' });

  // Mensajes desde la app
  function recibir(msg) {
    if (!msg) return;
    if (typeof msg === 'string') { try { msg = JSON.parse(msg); } catch (e) { return; } }
    if (msg.tipo === 'marcadores') {
      capa.clearLayers();
      msg.marcadores.forEach(function (m) {
        var opciones = m.pin ? { icon: PIN, zIndexOffset: 500, interactive: false }
                             : { icon: icono(m), zIndexOffset: (m.zIndex || 0) * 100 };
        var marca = L.marker([m.latitud, m.longitud], opciones).addTo(capa);
        if (!m.pin) marca.on('click', function (e) { L.DomEvent.stopPropagation(e); enviar({ tipo: 'marcador', id: m.id }); });
      });
    } else if (msg.tipo === 'irA') {
      mapa.flyTo([msg.latitud, msg.longitud], msg.zoom || mapa.getZoom(), { duration: 0.4 });
    } else if (msg.tipo === 'ubicacion') {
      if (ubicacion) { mapa.removeLayer(ubicacion); ubicacion = null; }
      if (msg.latitud != null) ubicacion = L.circleMarker([msg.latitud, msg.longitud],
        { radius: 7, color: '#fff', weight: 2, fillColor: '#1565D8', fillOpacity: 1, interactive: false }).addTo(mapa);
    }
  }
  window.recibir = recibir;
  window.addEventListener('message', function (e) { recibir(e.data); });
  document.addEventListener('message', function (e) { recibir(e.data); });

  mapa.on('moveend', function () { enviar({ tipo: 'region', region: region() }); });
  mapa.on('click', function () { enviar({ tipo: 'toque' }); });
  enviar({ tipo: 'listo', region: region() });
</script>
</body></html>`;
}

/** Equivalencia aproximada entre la apertura en grados y el nivel de zoom de Leaflet. */
export function zoomDesdeDelta(latitudeDelta: number): number {
  return Math.max(3, Math.min(18, Math.round(Math.log2(700 / Math.max(latitudeDelta, 0.0005)))));
}
