# OjoAlBondi · Cómo correr el Plan de pruebas

El plan (`documentacion/OjoAlBondi_Plan_de_Pruebas.xlsx`) tiene 75 casos. Se reparten en tres partes según
dónde se pueden probar:

| Parte | Casos | Quién | Estado al 11/10/2026 |
|---|---|---|---|
| A. Base de datos | 17 | Claude, en el SQL Editor de la beta | 15 Pasa, 0 Falla. Quedan CA-RNF01-7 (va por la API) y CA-RNF10-3 (se corre al final) |
| B. API, desde VS Code | 2 propios + repite 8 de seguridad | Cualquiera, con Claude en VS Code | Sin correr |
| C. App en el celular | 58 | Los 4 integrantes, en Expo Go | Sin correr (CA-RF02-5 y 6 bloqueados: confirmación de correo pospuesta) |

Cuando termines un caso, completá en el Excel las celdas amarillas: **Resultado** (Pasa, Falla o Bloqueado),
**Observaciones** (si falla, qué pasó), **Probado por** y **Fecha**. La hoja "Resumen" cuenta sola.

---

## A. Base de datos (ya corrida)

`pruebas/pruebas_base_beta.sql` corre todos los casos de tipo "Base de datos" en nombre de la cuenta de cada caso
y **deshace todo al final**: no cambia reclamos, suscripciones ni el contador de tickets. Se puede volver a correr
cuando quieras, por ejemplo después de cada migración:

1. Supabase → proyecto **beta** → SQL Editor → New query.
2. Pegar el archivo completo → **Run**.
3. Comparar la columna `resultado` con `esperado`. Si alguna no coincide, es una falla: anotarla en el plan.

## B. Desde VS Code con Claude

Sí, Claude en VS Code puede correr lo que necesita la API real de Supabase (desde la nube no hay red hacia
Supabase). No toca el código de la app.

### B1. Pruebas por la API (CA-RF01-6, CA-RNF01-7 y repaso de seguridad)

En la terminal de VS Code, parado en la carpeta `ojoalbondi-app`:

```
node pruebas/probar-api.mjs
```

Usa la URL y la clave publicable de `ojoalbondi-frontend/.env` y las cuentas de prueba. Muestra una línea por
comprobación (✔ Pasa / ✘ FALLA). No deja datos: lo que intenta crear tiene que ser rechazado; si algo no se
rechaza, avisa qué quedó para borrarlo.

O pegale esto a Claude en VS Code:

> Abrí `pruebas/GUIA_PRUEBAS.md` y corré `node pruebas/probar-api.mjs` desde la carpeta `ojoalbondi-app`.
> Con la salida, completá en `documentacion/OjoAlBondi_Plan_de_Pruebas.xlsx` (hoja "Plan de pruebas") las
> columnas Resultado, Observaciones, Probado por ("Claude en VS Code") y Fecha de CA-RF01-6 y CA-RNF01-7. Si en
> Observaciones ya hay texto, agregá el tuyo después de " | ". Si algo falla, no cambies código: contame qué falló.

### B2. Revisión de tipos (no está en el plan, pero conviene antes de probar)

```
cd ojoalbondi-frontend
npm run tipos
```

Si no muestra nada, no hay errores de TypeScript.

### B3. Opcional: probar algunas pantallas en el navegador

La app también abre en web (`npx expo start --web`). Claude en VS Code puede intentar automatizar ahí los casos
de validación de formularios, pero **no reemplaza al celular** (mapa, cámara, ubicación y modo avión son
nativos). Prompt sugerido:

> En `ojoalbondi-frontend`, levantá la app con `npx expo start --web`. En una carpeta aparte fuera del proyecto,
> instalá Playwright y escribí una prueba que, con vecino1@prueba.ojoalbondi / Prueba123!, verifique CA-RF02-2
> (contraseña incorrecta), CA-RF02-1 (entra a Reportar) y CA-RF03-2 (enviar el formulario vacío muestra qué falta).
> No crees cuentas ni envíes reclamos: la base es compartida. Contame qué pasó en cada caso.

---

## C. En el celular (Expo Go) · reparto para los 4 integrantes

Cada uno usa **su** vecino (integrante 1 → vecino1, etc.). Las cuentas de empresa, municipio y admin son
compartidas: si cambiás un estado o una suscripción, los demás lo ven. Contraseña de todas: `Prueba123!`.
Los números son la columna N° del plan.

### Integrante 1 · Registro, sesión, ajustes y accesibilidad (vecino1)
- 1 a 5: registro (para el 1 y el 4 usá un correo tuyo; anotá cuál en Observaciones).
- 6 a 9: inicio y cierre de sesión. El 8 necesita un correo real que reciba el mail.
- 23: Mis reportes vacío, con la cuenta que creaste en el 1.
- 24 a 26 y 68: Ajustes.
- 55 y 56: accesibilidad (letra grande del celular y tamaño de los botones).
- 57 y 58: no se prueban por ahora (marcados Bloqueado).

### Integrante 2 · Reclamos del ciudadano (vecino2)
- 11 a 18: crear reclamo y validaciones (el 18 es el mapa de paradas).
- 19 a 22: confirmación, inicio y Mis reportes.
- 27, 28 y 66: sin conexión (modo avión), también con foto.
- 69: borrador rechazado. Necesita que el responsable de la base desactive un ramal en el SQL Editor y después
  lo vuelva a activar: coordinarlo antes.

### Integrante 3 · Bandeja de empresa (tratado, pilarbus y vecino3)
- 29 a 32: acceso y Bandeja de tratado.
- 34 a 39, 41 y 42: detalle, cambios de estado e historial. Usá reclamos de la 501 en estado Recibido.
- 43: con vecino3 creá un reclamo de la 501 y fijate que lo ve tratado y no pilarbus.
- 64: tratado sin conexión.

### Integrante 4 · Municipio y administración (municipio, admin, rutabus y vecino4)
- **Primero** 33: rutabus tiene la Bandeja vacía (en la beta la 511 está pendiente).
- 44, 46 y 65: municipio. Para el 46 usá la 520 o la 511, que no tienen suscripción activa.
- 45: en la beta se prueba con rutabus (ver Observaciones del caso).
- 71 a 74: administración. En el 72 asignale el rol a vecino4 y al terminar volvelo a ciudadano. En el 74, al
  terminar, dejá la 511 como estaba.
- 54: necesita crear una cuenta en Supabase → Authentication: lo hace el responsable de la base.

### Al final (responsable de la base)
- 75 (CA-RNF10-3): recién cuando el equipo terminó, porque borra todos los datos de prueba.

---

## D. Qué herramientas usan las pruebas y por qué

| Herramienta | Versión | Para qué | Por qué esta | Qué se descartó y por qué |
|---|---|---|---|---|
| SQL de Postgres (PL/pgSQL) en el SQL Editor de Supabase | La de la base (Postgres de Supabase) | `pruebas_base_beta.sql`: casos de tipo "Base de datos" | No hay que instalar nada. Corre cada caso con `set local role authenticated` y la cuenta en `request.jwt.claims`, que es lo mismo que hace la API de Supabase con cada pedido de la app: se prueban las políticas reales (RLS, triggers, funciones). Cada caso va en una subtransacción que se deshace, así la base compartida no cambia. | **pgTAP** (framework de pruebas para Postgres): hay que habilitar una extensión en la base y aprender otra sintaxis, para 17 casos. **Supabase CLI con base local**: necesita Docker en cada computadora; es mucho para el equipo. |
| Node.js con `fetch` (incluido desde Node 18) | 18 o superior (el mismo que pide PASO_A_PASO.md) | `probar-api.mjs`: alta de cuentas, Storage, RPC y lecturas por la API | Ya está instalado para la app y `fetch` viene con Node: **no usa ninguna biblioteca** ni `npm install`. Habla directo con las mismas direcciones que usa la app (Auth, REST, Storage), así se ven los códigos HTTP reales. Los límites de Storage (tipo y tamaño) los aplica la API, no la base, por eso no alcanza con el SQL Editor. | **@supabase/supabase-js** dentro del script: necesitaría un `package.json` y `npm install` en la carpeta de pruebas, y oculta el código HTTP. **Jest o Vitest**: son frameworks para cientos de pruebas; para 13 comprobaciones suman dependencias sin ganar nada. |
| Expo Go en el celular | La del SDK 57 | Los 58 casos de App | Es como el equipo ya usa la app. Mapa, cámara, ubicación, modo avión y letra grande son del celular y solo se prueban ahí. | **Detox**: necesita una build propia (EAS), que todavía no hay. **Maestro** sí funciona con Expo Go en el emulador de Android; se puede sumar más adelante (ver F). |
| TypeScript (`npm run tipos`) | ~6.0.3, ya en el proyecto | Revisión de tipos antes de probar | Ya está en el proyecto; encuentra errores sin abrir la app. | — |
| Playwright (opcional, B3) | La última estable | Probar algunas pantallas en el navegador | Maneja Chromium solo y la app tiene versión web. Se instala en una carpeta aparte para no tocar el `package.json` de la app. No reemplaza al celular. | No se suma al proyecto hasta ver si sirve. |
| Excel del Plan de pruebas | — | Registrar resultados | Es el documento del proyecto; la hoja Resumen cuenta sola. Claude lo completa con Python (openpyxl), igual que el resto de la documentación. | — |

## E. Otras decisiones

- **Se probó en la beta y no en desarrollo:** la beta es la única base a la que llega Claude (por el conector de
  Supabase) y ya tiene las migraciones 006 a 009 y los datos de prueba. Desarrollo todavía no tiene la 006 a la 009,
  así que varios casos ahí fallarían por falta de migración y no por un error.
- **Nada se borra ni se cambia:** cada caso se deshace. Se comprobó después de la corrida: siguen 150 reclamos,
  el contador de tickets en 150 y las suscripciones igual.
- **Casos adaptados a la beta:** el plan se escribió con los datos de desarrollo, donde la 503 no tiene
  suscripción. En la beta sí tiene, así que los casos de "línea sin suscripción" usan la 511 (pendiente) o la 520.
- **Altas simuladas en la base:** CA-RN02-1 y CA-RF01-6 crean una cuenta de mentira directo en `auth.users`
  (dentro de la subtransacción) para disparar el trigger de registro. La respuesta de la API se confirma aparte
  con `probar-api.mjs`.
- **Por qué no corre todo Claude:** desde el entorno de Claude no hay red hacia `*.supabase.co` (el proxy lo
  bloquea), solo el conector de Supabase, que ejecuta SQL. Por eso lo de la API se corre desde VS Code.
- **CA-RNF10-3 queda al final:** borra todos los datos de prueba del equipo.

## F. Probar la app en el emulador de Android con Claude en VS Code

Claude en VS Code puede manejar el emulador desde la terminal con `adb`: saca capturas de pantalla, las mira,
toca la pantalla y escribe. Así puede recorrer casos de App sin celular. Es más lento que una persona y no
reemplaza la prueba en un celular real (cámara, rendimiento, letra grande del sistema).

Qué hace falta (una vez): Android Studio con un emulador (Device Manager → crear un Pixel con Android reciente)
y `adb` en el PATH. En Windows está en `%LOCALAPPDATA%\Android\Sdk\platform-tools`; para agregarlo una vez:
`[Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path", "User") + ";$env:LOCALAPPDATA\Android\Sdk\platform-tools", "User")`
en PowerShell y reabrir VS Code del todo (no usar `setx PATH`: puede cortar el PATH). Se prueba con `adb devices`.

Pasos:
1. Abrir el emulador. En `ojoalbondi-frontend`: `npx expo start -c` y tocar `a`: instala Expo Go en el emulador
   y abre la app.
2. Pegarle a Claude en VS Code:

> La app OjoAlBondi está abierta en Expo Go en el emulador de Android. Leé `pruebas/GUIA_PRUEBAS.md` y el plan
> `documentacion/OjoAlBondi_Plan_de_Pruebas.xlsx`. Probá los casos de App del integrante que te diga, usando
> adb: `adb shell screencap -p /sdcard/captura.png` y `adb pull /sdcard/captura.png` para ver la pantalla (en Windows no uses `exec-out ... >`: PowerShell rompe la imagen), `adb shell input tap X Y` para tocar,
> `adb shell input text` para escribir y `adb shell input keyevent` para volver. Para sin conexión usá
> `adb shell cmd connectivity airplane-mode enable/disable` y para ubicación `adb emu geo fix -58.91 -34.46`.
> Por cada caso, guardá la captura del resultado en `pruebas/capturas/<ID>.png` y completá Resultado,
> Observaciones, Probado por ("Claude en VS Code, emulador") y Fecha. No crees cuentas salvo las que pide el caso
> y no cambies código: si algo falla, describilo.

Más adelante, si se quieren pruebas que se repitan solas, Maestro (https://maestro.dev) corre flujos escritos en
YAML sobre Expo Go en el emulador. No se sumó todavía: primero conviene ver cómo funciona la prueba guiada.
