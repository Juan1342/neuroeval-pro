# NeuroEval Pro — instalación y puesta en marcha

Proyecto inicial completo con frontend, servidor Node.js, Firebase Authentication, Firestore, recuperación de contraseña por código de seis dígitos y generación de informes PDF.

## Importante antes de publicar

- No es una herramienta de diagnóstico médico. Los resultados son orientativos y requieren interpretación profesional.
- Se manejan datos personales y respuestas relacionadas con salud. Antes de usar con clientes reales, publica una política de tratamiento de datos, define consentimiento informado, retención/eliminación, controles de acceso y cumplimiento de la Ley 1581 de 2012 y normas aplicables en Colombia. Considera una revisión legal y de seguridad.
- No subas `.env`, `service-account.json` ni credenciales a GitHub.
- La cuenta administrativa no se habilita por conocer el correo: el backend exige un custom claim `admin` y el correo exacto autorizado.
- El checkout de Wompi y el cobro se dejaron fuera de este paquete. No se debe desbloquear contenido por una URL de retorno; para cobrar se debe verificar el evento/webhook firmado desde el backend.

## 1. Crear Firebase

1. Entra a https://console.firebase.google.com/ e inicia sesión con tu cuenta Google.
2. Pulsa **Crear un proyecto** y asígnale un nombre, por ejemplo `neuroeval-pro`.
3. En Authentication > Sign-in method, activa **Correo electrónico/Contraseña** y **Google**.
4. En Firestore Database, crea una base de datos. Para producción selecciona una ubicación cercana a tus usuarios y aplica `firebase.rules`.
5. En Configuración del proyecto > General > Tus aplicaciones, agrega una aplicación web (`</>`). Copia `apiKey`, `authDomain`, `projectId` y `appId`.
6. En Configuración del proyecto > Cuentas de servicio, genera una clave privada para Firebase Admin SDK. Descarga el JSON y guárdalo como `service-account.json` en la raíz del proyecto. No lo compartas ni lo subas a Git.
7. En Firestore > Rules, pega el contenido de `firebase.rules` y publica.

## 2. Configurar el proyecto

Requiere Node.js 20 o superior.

```bash
npm install
cp .env.example .env
```

Edita `.env` y completa los valores Firebase del paso 1. Para `GOOGLE_APPLICATION_CREDENTIALS`, usa `./service-account.json`.

### Correo de recuperación

Para Gmail, activa la verificación en dos pasos en la cuenta emisora y crea una **contraseña de aplicación**. Usa esa contraseña en `SMTP_PASS`, no la contraseña normal de Gmail. Configura `SMTP_USER`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` y `MAIL_FROM`.

## 3. Crear la cuenta administradora

En `.env`, configura:

- `ADMIN_EMAIL=jzamorazapata@gmail.com`
- `ADMIN_PASSWORD`: elige una contraseña larga, única y privada (mínimo 12 caracteres).
- `ADMIN_NAME=Juan Manuel Zamora Zapata`

Después ejecuta una sola vez:

```bash
npm run admin:create
```

El script crea la cuenta si no existe y asigna el permiso administrativo en Firebase. Si la cuenta ya existía, establece el custom claim; si necesitas cambiar la contraseña, hazlo desde Firebase Authentication o actualiza de forma segura el usuario. El correo reservado no puede registrarse como cliente.

**No uses una contraseña que hayas publicado en un chat, documento o repositorio.** Configura una nueva y activa MFA para el administrador cuando sea posible.

## 4. Ejecutar localmente

```bash
npm start
```

Abre http://localhost:3000.

## 5. Publicar en un alojamiento Node.js

Elige un proveedor que permita ejecutar una aplicación Node.js persistente (por ejemplo Render, Railway o VPS).

- Build command: `npm install`
- Start command: `npm start`
- Node: 20+
- Añade todas las variables del `.env` en el panel de variables del proveedor.
- Para Firebase Admin, configura la cuenta de servicio como secreto/archivo seguro. Si el proveedor permite secretos JSON, guarda el contenido del service account en una variable secreta y adapta `server.js` para usar `admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))`. Nunca incluyas el JSON en el frontend.
- Configura `APP_ORIGIN` y `CORS_ORIGINS` con el dominio HTTPS real.
- En Firebase Authentication > Settings > Authorized domains, añade tu dominio de producción.
- Mantén HTTPS habilitado.

## 6. Funciones incluidas

- Registro e inicio de sesión con correo/contraseña.
- Inicio con Google.
- Cuenta administradora con custom claim.
- Perfil de cliente y almacenamiento en Firestore.
- Cuestionario de 15 preguntas, respuestas y puntuaciones por dimensión.
- Panel con total de usuarios y evaluaciones.
- PDF con datos, preguntas, respuestas, puntuaciones y recomendaciones.
- Recuperación por código de 6 dígitos con hash, vencimiento, intentos limitados y uso único.

## 7. Limitaciones y mejoras antes de producción

- El banco de preguntas y los umbrales son demostrativos, no una escala clínica validada. No los presentes como prueba diagnóstica ni como instrumento psicométrico validado.
- La tabla del panel cuenta perfiles creados dentro de esta aplicación; no equivale necesariamente a todas las cuentas de Firebase si existen usuarios externos.
- Configura copias de seguridad, monitoreo, alertas, políticas de retención y eliminación de datos.
- Añade verificación de correo y MFA administrativo antes de abrir el registro al público.
- Para Wompi, integra creación de transacciones y validación de firma del webhook en backend antes de marcar una evaluación como pagada.
- La interfaz debe revisarse con pruebas de seguridad, accesibilidad y privacidad antes de usar datos reales.

## Estructura

```text
neuroeval-pro/
├── public/
│   ├── index.html
│   └── app.js
├── scripts/
│   └── bootstrap-admin.js
├── server.js
├── firebase.rules
├── .env.example
├── .gitignore
├── package.json
└── README.md
```
