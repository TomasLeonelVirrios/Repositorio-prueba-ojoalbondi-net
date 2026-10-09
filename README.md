# OjoAlBondi

Gestor de reclamos del transporte público de colectivos de Pilar.
El **ciudadano** registra reclamos desde la app eligiendo la parada en un mapa; la **empresa de transporte**
(con suscripción a la línea) o el **municipio** los revisa, les da seguimiento y cambia su estado.

Aplicaciones Móviles 2026 · Universidad Nacional de Pilar · Especificación vigente v10.

---

## Estructura

```
ojoalbondi-app/
├── README.md
├── ojoalbondi-backend/                 Base de datos (Supabase) y scripts
│   ├── package.json                    npm run armar-instalacion | paradas | datos-prueba | datos-prueba:borrar
│   ├── scripts/
│   │   ├── armar-instalacion.mjs       une supabase/esquema/*.sql en instalacion_completa.sql
│   │   ├── importar-paradas-osm.mjs    paradas desde OpenStreetMap → supabase/paradas_seed.sql
│   │   └── datos-prueba.mjs            cuentas, suscripciones y reclamos de prueba
│   └── supabase/
│       ├── instalacion_completa.sql    ★ base nueva: correr este único archivo
│       ├── esquema/                    fuente del esquema, separado por tema
│       │   ├── 01_tablas.sql
│       │   ├── 02_funciones.sql        reglas de negocio y triggers
│       │   ├── 03_vistas.sql
│       │   ├── 04_seguridad.sql        RLS, permisos y fotos
│       │   └── 05_datos_iniciales.sql  empresas, líneas, lugares, ramales y motivos reales
│       ├── migraciones/                historial para bases ya creadas (001 → 005)
│       └── utilidades/reiniciar_base.sql
│
└── ojoalbondi-frontend/                App Expo (React Native + TypeScript)
    ├── app/                            pantallas (Expo Router: cada archivo es una ruta)
    │   ├── _layout.tsx                 proveedores y navegación según el rol
    │   ├── index.tsx                   Bienvenida
    │   ├── (auth)/                     login, registro
    │   ├── ciudadano/                  pestañas: inicio, mapa, mis-reclamos, ajustes
    │   ├── nuevo-reclamo.tsx
    │   ├── reclamo-enviado.tsx
    │   ├── institucion/                pestañas: bandeja, mapa, ajustes (empresa y municipio)
    │   ├── gestion/[id].tsx            detalle y cambio de estado
    │   └── admin/                      pestañas: suscripciones, cuentas, mapa, ajustes
    └── src/                            todo lo que no es una ruta (se importa con @/…)
        ├── componentes/
        │   ├── ui/                     Boton, Campo, Selector, Tarjeta, Insignia, Aviso, …
        │   ├── formulario/             CampoFecha, CampoHora
        │   ├── mapa/                   SelectorParada, MiniMapa
        │   └── reclamos/               TarjetaReclamo, LineaDeTiempo
        ├── contextos/                  SesionContexto, TemaContexto, ConexionContexto
        ├── servicios/                  acceso a datos: supabase, catalogo, reclamos, borradores, gestion, mapa, administracion, paradas, geocodificacion
        ├── pantallas/                  pantallas compartidas entre perfiles (MapaPantalla, AjustesPantalla)
        ├── constantes/                 estados, motivos, textos, claves de almacenamiento
        ├── tipos/                      tipos del dominio
        ├── utilidades/                 fechas, errores
        └── tema/                       paleta de colores (claro y oscuro)
```

---

## 1. Base de datos

### Base nueva
1. Supabase → **SQL Editor** → New query → pegar `ojoalbondi-backend/supabase/instalacion_completa.sql` → **Run**.
2. Authentication → Sign In / Providers → Email → desactivar **Confirm email** mientras dure el desarrollo.
3. Paradas: `npm run paradas` (desde `ojoalbondi-backend`) y correr el `supabase/paradas_seed.sql` generado.
4. Datos de prueba (opcional): ver más abajo.

Verificación: `select (select count(*) from lineas), (select count(*) from ramales), (select count(*) from motivos);` → 7, 30, 8.

### Base que ya tiene las migraciones 001 a 003 (la del proyecto)
1. Borrar los datos de prueba: `npm run datos-prueba:borrar` (con el script **nuevo** de esta versión).
2. Correr `supabase/migraciones/004_nombres_y_duplicidades.sql`. Si quedan reclamos con el formato viejo, se detiene y avisa.
3. Correr `supabase/migraciones/005_mapa_y_administracion.sql` (mapa de calor y administración).
4. Volver a cargar los datos de prueba: `npm run datos-prueba`.

La migración 004 y la instalación completa dejan **la misma estructura** (verificado comparando ambas bases).

### Modificar el esquema
Editar el archivo que corresponda de `supabase/esquema/` y regenerar la instalación completa con
`npm run armar-instalacion`. Para la base del proyecto, agregar además una migración nueva en `migraciones/`.

### Datos de prueba
```powershell
cd ojoalbondi-backend
npm install
$env:SUPABASE_URL="https://xxxx.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."     # clave secreta: nunca en archivos ni en git
npm run datos-prueba          # o: npm run datos-prueba:borrar
```
Cuentas (contraseña `Prueba123!`): `tratado@prueba.ojoalbondi` (línea 501), `pilarbus@prueba.ojoalbondi`
(línea 510), `municipio@prueba.ojoalbondi` (todas), `admin@prueba.ojoalbondi` (administración) y
`vecino1` … `vecino8@prueba.ojoalbondi`.
La 503 queda sin suscripción a propósito: sus reclamos los ve solo el municipio (RF-25).

### Perfiles de la app
| Perfil | Ve | Cuenta de prueba |
|---|---|---|
| Ciudadano | Reportar, Mapa (paradas y calor), Mis reportes, Ajustes | `vecino1@prueba.ojoalbondi` |
| Empresa / Municipio | Bandeja, Mapa, Ajustes; detalle y cambio de estado | `tratado@`, `pilarbus@`, `municipio@prueba.ojoalbondi` |
| Administración | Suscripciones por línea, Cuentas (roles), Mapa, Ajustes | `admin@prueba.ojoalbondi` |

El primer administrador se crea desde el SQL Editor: `update perfiles set rol = 'admin', organizacion_id = null where id = '<id>';`.
Después, el administrador asigna roles desde la pestaña Cuentas.

### Suscripciones (RF-25)
Una empresa ve los reclamos de una línea solo con una suscripción **activa** (una por línea). Se administran
desde la pestaña Suscripciones del perfil Administración, o con SQL:
```sql
insert into suscripciones (linea, organizacion_id, estado) values ('501', 'tratado', 'activa');
update suscripciones set estado = 'suspendida' where linea = '501' and estado = 'activa';
```

---

## 2. App

```powershell
cd ojoalbondi-frontend
npm install
copy .env.example .env      # completar URL y clave pública (sb_publishable_…)
npx expo start -c
```
Requiere Node 18+ y **Expo Go actualizado** (SDK 57). Recomendado: tener el proyecto fuera de OneDrive
(por ejemplo en `C:\dev`) para evitar problemas de rutas largas.

- `npm run tipos`: verificación de tipos de TypeScript.
- `npm run revisar-dependencias`: controla que las librerías coincidan con el SDK de Expo.
- Librerías nativas nuevas: instalarlas con `npx expo install nombre`, nunca con `npm install`.
- Mapas: utiliza OpenStreetMap (libre y sin API key ni configuración en Google Cloud). Ver detalles y resolución de la incidencia en [BITACORA_MAPA_OPENSTREETMAP.md](file:///c:/Users/Leo/Desktop/Ojoalbondi-08.10/ojoalbondi-app/BITACORA_MAPA_OPENSTREETMAP.md).

---

## 3. Convenciones de nombres

| Concepto | Base de datos | Código |
|---|---|---|
| Reclamo | tabla `reclamos` | `ReclamoResumen`, `ReclamoDetalle`, `NuevoReclamo` |
| Ciudadano que lo creó | `ciudadano_id` | `ciudadanoId` |
| Fecha y hora del hecho | `fecha_hora_hecho` | `fechaHoraHecho` |
| Fecha de registro | `creado_en` (en todas las tablas) | `creadoEn` |
| Foto | `foto_ruta` (bucket `fotos-reclamos`) | `fotoRuta`, `fotoUri` (local) |
| Motivo | código en `reclamos.motivo`, descripción en la tabla `motivos` | `motivo`, `motivoDescripcion` |
| Sentido | `sentido_lugar_id` → `lugares` | `sentidoLugarId` |
| Quién cambió un estado | `responsable_id`, `responsable_nombre` | `responsableNombre` |
| Empresa que opera una línea | `lineas.empresa_operadora_id` (informativo) | — |

- Base de datos en `snake_case`; código en `camelCase`; componentes en `PascalCase`. Todo en español.
- Los textos visibles conservan los del diseño original ("Crear reporte", "Mis reportes").
- Las listas de líneas, sentidos y motivos **solo** viven en la base: la app las lee y guarda una copia local.
