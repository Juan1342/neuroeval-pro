# NeuroEval Pro — configuración y puesta en marcha

Plataforma de autorregistro cognitivo con Firebase Authentication, Firestore, recuperación de contraseña por código de seis dígitos, informes PDF y preparación de pagos con Wompi.

## Antes de utilizarla con personas

- NeuroEval Pro es una herramienta de autorregistro orientativo; **no diagnostica TDAH ni ninguna otra condición**, y sus preguntas y porcentajes no constituyen una escala clínica validada.
- Se procesan datos personales y respuestas que pueden revelar información sensible. Antes de abrir el servicio al público, publica política de privacidad y tratamiento de datos, consentimiento informado, canales para ejercer derechos, plazos de conservación/eliminación y controles de acceso. Solicita revisión legal y de seguridad conforme a la normativa aplicable.
- No subas archivos `.env`, claves privadas, JSON de cuentas de servicio ni contraseñas a GitHub.
- La administración requiere el custom claim `admin: true` asignado desde Firebase Admin SDK. El correo reservado por sí solo **no** concede privilegios.
- Los pagos solo deben considerarse confirmados mediante el webhook firmado de Wompi; una URL de retorno no demuestra que exista un pago.

## 1. Preparar Firebase

1. Crea o abre el proyecto en [Firebase Console](https://console.firebase.google.com/).
2. En Authentication, activa los proveedores **Correo electrónico/Contraseña** y **Google**.
3. Crea Firestore Database y aplica las reglas de `firebase.rules`.
4. Registra una aplicación web y copia sus valores `apiKey`, `authDomain`, `projectId` y `appId`.
5. Para el servidor, configura Firebase Admin mediante una cuenta de servicio guardada como secreto. En desarrollo puedes usar Application Default Credentials. Nunca publiques el JSON.

## 2. Configurar variables de entorno

Se incluye `.env.example` como plantilla. Copia el archivo a `.env` en tu entorno de desarrollo y completa los valores reales. En Render, añade las mismas variables desde el panel **Environment**; no subas el archivo `.env`.

Variables principales:

- Firebase público: `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID`.
- Firebase Admin: `FIREBASE_SERVICE_ACCOUNT_JSON` (secreto JSON completo) o credenciales ADC; opcionalmente `GOOGLE_APPLICATION_CREDENTIALS` en un entorno que permita montar un archivo seguro.
- Correo: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`.
- Aplicación: `APP_ORIGIN`, `CORS_ORIGINS`, `NODE_ENV`, `PORT`.
- Administrador: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`.
- Wompi: `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`.
- Pruebas: `ALLOW_DEMO_PAY=false` fuera de entornos locales controlados.

Para Gmail, utiliza una contraseña de aplicación si tu cuenta y política de seguridad lo permiten. No uses la contraseña normal de la cuenta. La recuperación de contraseña requiere SMTP correctamente configurado; el endpoint de estado informa si el servidor detectó la configuración.

## 3. Preparar la cuenta administradora

El correo reservado actual es `jzamorazapata@gmail.com`. Configura `ADMIN_EMAIL` con ese valor y establece `ADMIN_PASSWORD` solo si necesitas crear la cuenta o cambiar expresamente su contraseña. Usa una contraseña única de al menos 12 caracteres.

En la raíz del proyecto ejecuta:

```bash
npm install
npm run admin:create
```

El script está en la raíz como `bootstrap-admin.js`. Conserva otros custom claims de Firebase y asigna `admin: true`. Al terminar, cierra sesión y vuelve a entrar para obtener un token actualizado.

## 4. Ejecutar el servidor

Requiere Node.js 20 o superior:

```bash
npm start
```

Abre `http://localhost:3000`. Para verificar el estado básico del servidor, consulta `/api/health`. Ese endpoint informa si SMTP y Wompi parecen configurados; no sustituye una prueba real de envío o pago.

## 5. Publicación en Render u otro proveedor Node.js

- Build command: `npm install`
- Start command: `npm start`
- Runtime: Node.js 20 o superior.
- Añade las variables de entorno anteriores en el panel seguro del proveedor.
- Configura `APP_ORIGIN` con el dominio HTTPS de la aplicación y `CORS_ORIGINS` con los orígenes autorizados separados por comas.
- Añade el dominio de producción a los dominios autorizados de Firebase Authentication.
- Configura la cuenta de servicio Firebase Admin como secreto. No la incluyas en el repositorio ni en archivos públicos.
- Mantén `ALLOW_DEMO_PAY=false` en producción.

## 6. Wompi

Configura las tres variables del servidor con las credenciales del mismo entorno (sandbox o producción): clave pública, secreto de integridad y secreto de eventos. Registra el webhook:

`https://TU-DOMINIO/api/payments/wompi-webhook`

Suscribe el evento `transaction.updated`. Prueba primero con credenciales sandbox y verifica que el webhook llega y que la firma coincide antes de activar cobros reales. El valor de evaluación está definido actualmente en el servidor: **$4.000 COP**. No cambies el entorno ni actives producción sin pruebas y aprobación.

## 7. Funciones presentes

- Registro e inicio de sesión por correo y Google.
- Perfil de usuario.
- Cuestionario dinámico de 15 preguntas seleccionadas de un banco.
- Registro de respuestas y resultados orientativos.
- Flujo de pago Wompi y confirmación mediante webhook.
- Informe PDF del usuario y consulta administrativa.
- Panel administrativo protegido por custom claim.
- Recuperación de contraseña mediante código de seis dígitos, con vencimiento y límite de intentos.

## 8. Estructura principal

```text
neuroeval-pro/
├── public/
│   ├── index.html
│   └── app.js
├── bootstrap-admin.js
├── server.js
├── package.json
├── firebase.rules
├── .env.example
├── .gitignore
└── README.md
```

## 9. Pendientes antes de producción

- Ejecutar pruebas funcionales y de seguridad de extremo a extremo.
- Verificar el envío real de correo y el flujo completo de recuperación.
- Probar Wompi sandbox, webhook, duplicados, rechazos y reintentos.
- Revisar la validación de puntuaciones en el servidor: no confiar en resultados calculados únicamente por el navegador.
- Incorporar verificación de correo, MFA administrativo, monitoreo, copias de seguridad y procedimientos de respuesta a incidentes.
- Completar revisión de accesibilidad, internacionalización, privacidad y tratamiento de datos.
