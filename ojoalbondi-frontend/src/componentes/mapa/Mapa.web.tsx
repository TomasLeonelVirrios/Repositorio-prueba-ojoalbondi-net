import { createElement, forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { htmlMapa, zoomDesdeDelta } from './htmlMapa';
import { ControlMapa, MensajeMapa, PropsMapa } from './tiposMapa';

/** Versión web del mapa: la misma página de Leaflet, dentro de un iframe. */
export const Mapa = forwardRef<ControlMapa, PropsMapa>(function Mapa(props, ref) {
  const { regionInicial, marcadores, oscuro = false, interactivo = true, ubicacionUsuario, onRegion, onMarcador, onToque } = props;
  const marco = useRef<HTMLIFrameElement | null>(null);
  const listo = useRef(false);
  const ultimo = useRef(props);
  ultimo.current = props;

  const html = useMemo(() => htmlMapa(regionInicial, oscuro, interactivo), [oscuro, interactivo]);

  const mandar = (datos: object) => {
    if (listo.current) marco.current?.contentWindow?.postMessage(datos, '*');
  };

  useImperativeHandle(ref, () => ({
    irA: (p, delta) => mandar({ tipo: 'irA', latitud: p.latitud, longitud: p.longitud, zoom: delta ? zoomDesdeDelta(delta) : undefined }),
  }));

  useEffect(() => {
    const alRecibir = (e: MessageEvent) => {
      if (e.source !== marco.current?.contentWindow || e.data?.fuente !== 'ojoalbondi-mapa') return;
      const m = e.data as MensajeMapa;
      const p = ultimo.current;
      if (m.tipo === 'listo') {
        listo.current = true;
        mandar({ tipo: 'marcadores', marcadores: p.marcadores });
        if (p.ubicacionUsuario) mandar({ tipo: 'ubicacion', ...p.ubicacionUsuario });
        p.onRegion?.(m.region);
      } else if (m.tipo === 'region') p.onRegion?.(m.region);
      else if (m.tipo === 'marcador') p.onMarcador?.(m.id);
      else if (m.tipo === 'toque') p.onToque?.();
    };
    window.addEventListener('message', alRecibir);
    return () => window.removeEventListener('message', alRecibir);
  }, []);

  useEffect(() => { mandar({ tipo: 'marcadores', marcadores }); }, [marcadores]);
  useEffect(() => { mandar({ tipo: 'ubicacion', latitud: ubicacionUsuario?.latitud, longitud: ubicacionUsuario?.longitud }); }, [ubicacionUsuario]);

  return (
    <View style={{ flex: 1 }} pointerEvents={interactivo ? 'auto' : 'none'}>
      {createElement('iframe', {
        key: html.length + (oscuro ? 'o' : 'c'),
        ref: marco,
        srcDoc: html,
        title: 'Mapa',
        style: { border: 'none', width: '100%', height: '100%' },
      })}
    </View>
  );
});
