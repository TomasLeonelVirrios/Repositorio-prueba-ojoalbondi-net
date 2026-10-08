# 🚀 Guía de Sincronización y Ejecución · OjoAlBondi

Esta guía contiene todo lo necesario para trabajar entre tu **PC de escritorio** y tu **Netbook**, y cómo probar la app en **Expo Go**.

---

## 1. Puesta en marcha en la Netbook (Solo la primera vez)

1. **Abrir la terminal** en la carpeta donde quieras tener el proyecto (por ejemplo en el Escritorio) y clonar el repositorio:
   ```powershell
   git clone https://github.com/TomasLeonelVirrios/Repositorio-prueba-ojoalbondi-net.git
   cd Repositorio-prueba-ojoalbondi-net
   ```

2. **Abrir la carpeta en Antigravity**:
   - En **Antigravity IDE**, ve a `File > Open Folder` y selecciona la carpeta del proyecto.

3. **Instalar dependencias y configurar variables**:
   En la terminal de Antigravity (o PowerShell):
   ```powershell
   cd ojoalbondi-frontend
   npm install
   copy .env.example .env
   ```

4. **Ejecutar la aplicación**:
   ```powershell
   npx expo start -c
   ```

---

## 2. Cómo abrir la app en tu celular (Expo Go)

1. Abre la app **Expo Go** en tu celular (debe estar en la misma red Wi-Fi).
2. Toca **"Enter URL manually"** y escribe:
   ```text
   exp://TU_IP_LOCAL:8081
   ```
   *(O escanea el código QR que se dibuja en la terminal).*
3. **Si el Wi-Fi no conecta o el firewall bloquea el puerto**, puedes usar el modo túnel:
   ```powershell
   npx expo start --tunnel -c
   ```

---

## 3. Cuentas de prueba disponibles

La base de datos de Supabase ya tiene cargadas 7 líneas, 687 paradas y estas cuentas de prueba:

| Perfil | Correo | Contraseña | ¿Qué permite hacer? |
|---|---|---|---|
| **Ciudadano** | `vecino1@prueba.ojoalbondi` | `Prueba123!` | Reportar problemas, mapa de calor, ver sus reportes |
| **Empresa (Línea 501)** | `tratado@prueba.ojoalbondi` | `Prueba123!` | Bandeja de reclamos línea 501, cambio de estados |
| **Empresa (Línea 510)** | `pilarbus@prueba.ojoalbondi` | `Prueba123!` | Bandeja de reclamos línea 510, cambio de estados |
| **Municipio** | `municipio@prueba.ojoalbondi` | `Prueba123!` | Reclamos de todas las líneas, seguimiento |
| **Administrador** | `admin@prueba.ojoalbondi` | `Prueba123!` | Gestión de suscripciones y asignación de roles |

---

## 4. Rutina diaria de sincronización (PC ⇄ Netbook)

### Al terminar de trabajar en una máquina:
```powershell
git add .
git commit -m "avance del dia"
git push
```
*(O pídele a Antigravity: "subí los cambios a git").*

### Al sentarte a trabajar en la otra máquina:
```powershell
git pull
```
*(O pídele a Antigravity: "traé los cambios de git").*
