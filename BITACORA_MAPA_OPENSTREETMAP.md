# 🗺️ Bitácora Técnica: Incidencia y Migración a OpenStreetMap

Este documento registra la causa del error visual del mapa en dispositivos Android bajo Expo Go, la investigación realizada y la solución implementada para migrar de Google Maps a **OpenStreetMap (OSM)**.

---

## 1. Descripción de la Incidencia

* **Síntoma:** Al abrir el selector de paradas o la pantalla principal de mapa en **Expo Go sobre Android**, el mapa aparecía vacío (grilla gris/beige uniforme con el logo de Google en la esquina inferior izquierda), sin cargar calles, manzanas ni marcadores.
* **Contraste:** En dispositivos **iPhone (iOS)**, el mapa cargaba correctamente y sin inconvenientes.

---

## 2. Diagnóstico y Causa Raíz

### A. Asimetría de proveedores en `react-native-maps`
* **En iOS:** La biblioteca `react-native-maps` usa por defecto **Apple Maps (MapKit)**. Apple Maps es un servicio integrado en iOS que **no requiere API Key**, ni cuenta en la nube, ni autenticación externa. Funciona de inmediato en Expo Go de forma transparente.
* **En Android:** No existe Apple Maps, por lo que la biblioteca recurre a **Google Maps SDK**. Google Maps en Android **exige obligatoriamente una API Key válida** vinculada a un proyecto de Google Cloud con el servicio *Maps SDK for Android* habilitado.

### B. Clave no configurada
* En el archivo `app.json` figuraba un marcador de posición de ejemplo:
  ```json
  ["react-native-maps", { "androidGoogleMapsApiKey": "TU_API_KEY_DE_GOOGLE_MAPS" }]
  ```
* Al intentar autenticar contra los servidores de Google, la solicitud era rechazada por clave inválida, resultando en la típica pantalla beige vacía con el logotipo de Google.

### C. Limitaciones de Expo Go y barreras de Google Cloud
* Expo Go es un ejecutable precompilado que no recompila el `AndroidManifest.xml` nativo con claves particulares.
* Google Cloud exige asociar una tarjeta de crédito o débito internacional a una cuenta de facturación (*Billing Account*) para habilitar la API, aun cuando el mapa móvil nativo tiene costo de $0.00.
* El equipo resolvió **no asociar tarjetas de crédito ni depender de servicios cerrados de Google**, optando por una solución abierta y libre.

---

## 3. Solución Implementada: Migración a OpenStreetMap

Se sustituyó el uso de Google Maps por **OpenStreetMap** servido mediante **Leaflet** dentro de un contenedor web nativo de alto rendimiento (`react-native-webview`).

### Cambios realizados en el código:

1. **Instalación de dependencia nativa compatible:**
   * Se instaló `react-native-webview` (versión compatible con Expo SDK 57):
     ```powershell
     npx expo install react-native-webview
     ```

2. **Creación del componente central `MapaOSM`:**
   * Ubicación: [`ojoalbondi-frontend/src/componentes/mapa/MapaOSM.tsx`](file:///c:/Users/Leo/Desktop/Ojoalbondi-08.10/ojoalbondi-app/ojoalbondi-frontend/src/componentes/mapa/MapaOSM.tsx)
   * Renderiza mosaicos estándar de **OpenStreetMap** (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`).
   * Comunicación bidireccional fluida React Native ⇄ WebView mediante `postMessage` y `injectJavaScript`.
   * Soporta marcadores dinámicos SVG de paradas (estado normal y seleccionado con ícono de colectivo).
   * Soporta marcadores de **mapa de calor** con burbujas de colores escalables y conteo de reclamos.
   * Soporta chincheta de ubicación buscada y animación hacia coordenadas (`animarA(punto)`).
   * Notifica cambios de región al terminar de mover el mapa (`region-change`).

3. **Migración de componentes y pantallas consumidoras:**
   * [`SelectorParada.tsx`](file:///c:/Users/Leo/Desktop/Ojoalbondi-08.10/ojoalbondi-app/ojoalbondi-frontend/src/componentes/mapa/SelectorParada.tsx): Modal de selección de parada para nuevos reportes.
   * [`MiniMapa.tsx`](file:///c:/Users/Leo/Desktop/Ojoalbondi-08.10/ojoalbondi-app/ojoalbondi-frontend/src/componentes/mapa/MiniMapa.tsx): Vista previa chica no interactiva de la parada seleccionada.
   * [`MapaPantalla.tsx`](file:///c:/Users/Leo/Desktop/Ojoalbondi-08.10/ojoalbondi-app/ojoalbondi-frontend/src/pantallas/MapaPantalla.tsx): Pestaña principal de visualización de paradas y mapa de calor de reclamos.

4. **Limpieza de configuración:**
   * Se removió la configuración dummy de `react-native-maps` en [`app.json`](file:///c:/Users/Leo/Desktop/Ojoalbondi-08.10/ojoalbondi-app/ojoalbondi-frontend/app.json).
   * Se actualizó la documentación del proyecto.

---

## 4. Ventajas de la Solución

| Aspecto | Antes (Google Maps) | Ahora (OpenStreetMap) |
|---|---|---|
| **Costo** | Gratis, pero requería tarjeta de crédito en Google Cloud | **100% libre y gratuito**, sin tarjeta |
| **Android en Expo Go** | Pantalla vacía sin build propio | **Funciona de inmediato** sin compilar nada |
| **iPhone en Expo Go** | Apple Maps nativo | **Misma interfaz y comportamiento idéntico** en Android e iOS |
| **Claves / Secretos** | Requería configurar y proteger API Keys | **Cero claves ni credenciales necesarias** |
| **Atribución** | Datos de paradas eran de OSM pero mapa de Google | **Coherencia completa**: datos y mapa bajo OpenStreetMap |

---

## 5. Verificación de Integridad

* Verificación de tipos TypeScript (`npm run tipos`): **0 errores**.
* Control de compatibilidad del SDK de Expo (`npm run revisar-dependencias`): **Dependencias al día**.
