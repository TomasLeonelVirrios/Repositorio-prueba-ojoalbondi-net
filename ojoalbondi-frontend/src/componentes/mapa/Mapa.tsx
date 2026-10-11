import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { htmlMapa, zoomDesdeDelta } from './htmlMapa';
import { ControlMapa, MensajeMapa, PropsMapa } from './tiposMapa';

/**
 * Mapa de OpenStreetMap para iPhone y Android (dentro de un WebView).
 * Reemplaza a react-native-maps, que en Android necesita una API key de Google Maps.
 * La versión web está en Mapa.web.tsx.
 */
export const Mapa = forwardRef<ControlMapa, PropsMapa>(function Mapa(props, ref) {
  const { regionInicial, marcadores, oscuro = false, interactivo = true, ubicacionUsuario, onRegion, onMarcador, onToque } = props;
  const web = useRef<WebView>(null);
  const listo = useRef(false);

  // La página se arma una sola vez por tema; después solo se le mandan mensajes
  const html = useMemo(() => htmlMapa(regionInicial, oscuro, interactivo), [oscuro, interactivo]);

  const mandar = (datos: object) => {
    if (listo.current) web.current?.injectJavaScript(`window.recibir(${JSON.stringify(JSON.stringify(datos))}); true;`);
  };

  useImperativeHandle(ref, () => ({
    irA: (p, delta) => mandar({ tipo: 'irA', latitud: p.latitud, longitud: p.longitud, zoom: delta ? zoomDesdeDelta(delta) : undefined }),
  }));

  useEffect(() => { mandar({ tipo: 'marcadores', marcadores }); }, [marcadores]);
  useEffect(() => { mandar({ tipo: 'ubicacion', latitud: ubicacionUsuario?.latitud, longitud: ubicacionUsuario?.longitud }); }, [ubicacionUsuario]);

  const alRecibir = (e: WebViewMessageEvent) => {
    let m: MensajeMapa;
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.tipo === 'listo') {
      listo.current = true;
      mandar({ tipo: 'marcadores', marcadores });
      if (ubicacionUsuario) mandar({ tipo: 'ubicacion', ...ubicacionUsuario });
      onRegion?.(m.region);
    } else if (m.tipo === 'region') onRegion?.(m.region);
    else if (m.tipo === 'marcador') onMarcador?.(m.id);
    else if (m.tipo === 'toque') onToque?.();
  };

  return (
    <View style={{ flex: 1 }} pointerEvents={interactivo ? 'auto' : 'none'}>
      <WebView
        key={html.length + (oscuro ? 'o' : 'c')}
        ref={web}
        source={{ html, baseUrl: 'https://ojoalbondi.local' }}
        originWhitelist={['*']}
        onMessage={alRecibir}
        onLoadStart={() => { listo.current = false; }}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      />
    </View>
  );
});
