# OjoAlBondi · Paso a paso para el equipo

La base de datos (Supabase) **ya está instalada y con datos de prueba**. Para usar la app solo hay que
preparar la computadora y levantarla. Son unos 15 minutos la primera vez.

---

## Antes de empezar (una sola vez)

1. **Node.js 18 o superior:** descargarlo de https://nodejs.org (versión LTS). Para verificar, en una terminal: `node -v`.
2. **VS Code:** https://code.visualstudio.com
3. **Expo Go actualizado** en el celular (Play Store o App Store).
4. El celular y la computadora tienen que estar **en la misma red WiFi**.

---

## Paso 1 · Descomprimir

1. Crear la carpeta `C:\dev` (en Mac o Linux, cualquier carpeta propia).
2. Descomprimir el zip ahí. Queda `C:\dev\ojoalbondi-app`.
3. **No usar el Escritorio ni Documentos si están dentro de OneDrive**: con OneDrive aparecen errores de rutas largas al instalar.

## Paso 2 · Abrir el proyecto

1. Abrir VS Code → **File → Open Folder** → elegir `C:\dev\ojoalbondi-app`.
2. Verificar que dentro de `ojoalbondi-frontend` esté el archivo **`.env`** (viene en el zip; tiene la conexión a Supabase).

## Paso 3 · Instalar

1. En el panel de la izquierda, clic derecho sobre la carpeta **`ojoalbondi-frontend`** → **Open in Integrated Terminal**.
2. Escribir:
   ```
   npm install
   ```
   Tarda unos minutos. Los avisos amarillos ("npm notice", "deprecated") son normales.

## Paso 4 · Levantar la app

En la misma terminal:
```
npx expo start -c
```
Aparece un **código QR**.

## Paso 5 · Abrirla en el celular

1. Cerrar Expo Go del todo (sacarlo de las apps abiertas) y volver a abrirlo.
2. **Android:** en Expo Go, "Scan QR code". **iPhone:** con la cámara del celular.
3. La primera vez tarda un poco en cargar.

## Paso 6 · Entrar con las cuentas de prueba

Contraseña de todas: **`Prueba123!`**

| Perfil | Cuenta | Qué ve |
|---|---|---|
| Ciudadano | `vecino1@prueba.ojoalbondi` (hasta `vecino8`) | Reportar, Mapa, Mis reportes, Ajustes |
| Empresa | `tratado@prueba.ojoalbondi` | Bandeja de la línea 501, Mapa, Ajustes |
| Empresa | `pilarbus@prueba.ojoalbondi` | Bandeja de la línea 510, Mapa, Ajustes |
| Municipio | `municipio@prueba.ojoalbondi` | Bandeja de todas las líneas, Mapa, Ajustes |
| Administración | `admin@prueba.ojoalbondi` | Suscripciones, Cuentas, Mapa, Ajustes |

Para cambiar de cuenta: **Ajustes → Cerrar sesión**.

---

## ⚠️ Qué NO hacer

La base de datos es **compartida por todo el equipo**. Si alguien hace lo siguiente, borra los datos de todos:

- **No** correr en Supabase `reiniciar_base.sql`, `instalacion_completa.sql` ni las migraciones.
- **No** correr `npm run datos-prueba` ni `npm run datos-prueba:borrar` (carpeta `ojoalbondi-backend`).
- **No** subir el archivo `.env` a GitHub ni publicarlo.

Esas tareas las hace una sola persona: el responsable de la base de datos.

---

## Si algo falla

| Qué aparece | Qué hacer |
|---|---|
| `supabaseUrl is required` | Falta el archivo `.env` en `ojoalbondi-frontend` o se llama distinto (por ejemplo `.env.txt`). Revisarlo y reiniciar con `Ctrl+C` y `npx expo start -c`. |
| `Native module is null` | Expo Go desactualizado, o instalación incompleta. Actualizar Expo Go; si sigue, borrar `node_modules` (ver abajo) y repetir el paso 3. |
| El celular no se conecta al QR | Revisar que estén en la misma WiFi. Si no se puede, usar `npx expo start -c --tunnel` (la primera vez pide instalar un complemento: aceptar). |
| Errores de "ruta de acceso" al instalar o borrar | El proyecto está dentro de OneDrive: moverlo a `C:\dev`. |
| `npm` no se reconoce | Node.js no está instalado o hay que reiniciar VS Code después de instalarlo. |
| El mapa aparece vacío | Acercar el mapa a Pilar: las paradas se muestran con zoom. |

**Borrar `node_modules`** (cuando hay que reinstalar), con la terminal en `ojoalbondi-frontend`:
```
node -e "require('fs').rmSync('node_modules', { recursive: true, force: true })"
npm install
```

---

## Solo para el responsable de la base de datos

Todo lo de Supabase está explicado en el `README.md` (sección "Base de datos") y en la
**Documentación de base de datos** (PDF). Resumen:

- Base nueva: `supabase/utilidades/reiniciar_base.sql` → `supabase/instalacion_completa.sql` → `paradas_seed.sql`.
- Datos de prueba: desde `ojoalbondi-backend`, `npm install` y luego, con la clave **secreta** cargada solo en la terminal:
  ```
  $env:SUPABASE_URL="https://bmtzespsvdafhlrwnpjp.supabase.co"
  $env:SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
  npm run datos-prueba
  ```
- La clave secreta **nunca** va en el `.env`, en el código, en GitHub ni en capturas de pantalla.
