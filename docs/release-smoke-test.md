# NeuroEval Pro — plan de pruebas integrales y salida controlada

**Estado:** plan preparado; pruebas de navegador, Firebase real y Wompi no ejecutadas desde esta rama.  
**Regla:** no hacer merge ni despliegue hasta aprobar los controles de este documento.

## 1. Antes de desplegar

- [ ] Confirmar que Render Auto-Deploy permanece OFF.
- [ ] Confirmar que el servicio Render sigue conectado a `mejoras/neuroeval-pro`, no a la rama de preparación.
- [ ] Confirmar que el último workflow de GitHub Actions termina en `success`.
- [ ] Confirmar que `WOMPI_PUBLIC_KEY` y `WOMPI_PRIVATE_KEY` pertenecen al mismo ambiente.
- [ ] Configurar `WOMPI_PRIVATE_KEY` en Render como secreto, si no está configurada.
- [ ] Confirmar que `WOMPI_INTEGRITY_SECRET` y `WOMPI_EVENTS_SECRET` corresponden al mismo ambiente.
- [ ] Revisar variables y proveedor de correo sin revelar secretos en capturas ni registros.

## 2. Cuenta, idioma y consentimiento

Usar cuentas de prueba propias; no utilizar datos clínicos de clientes reales.

- [ ] Crear una cuenta con correo/contraseña y otra con Google.
- [ ] Crear una cuenta sin marcar la autorización de datos sensibles; debe poder crear la cuenta, pero no iniciar una evaluación hasta autorizar.
- [ ] Aceptar el aviso general y la autorización expresa de datos sensibles; verificar que el servidor registra ambas versiones, idioma y fecha.
- [ ] Iniciar sesión con una cuenta existente; confirmar que solo vuelve a pedir consentimiento cuando falta o está desactualizado.
- [ ] Cambiar Español ↔ English y comprobar formularios, cuestionario, mensajes, resultados, PDF, correos y fechas.
- [ ] En observación familiar, comprobar que se requieren autorización del adulto y autorización expresa separada para los datos sensibles del menor.
- [ ] Retirar autorización sensible desde el perfil; comprobar que la API bloquea nuevas evaluaciones.
- [ ] Exportar datos y verificar que incluye historial de consentimientos sensibles.

## 3. Evaluación e informe

- [ ] Completar evaluación individual con cuenta adulta.
- [ ] Confirmar que cada usuario solo puede leer sus propias evaluaciones.
- [ ] Confirmar que el retorno del navegador no desbloquea el informe.
- [ ] Confirmar que el informe se mantiene bloqueado mientras no exista una transacción aprobada verificada por el servidor.
- [ ] Descargar PDF en español e inglés y revisar caracteres, etiquetas, datos y franja de edad.
- [ ] Comprobar que los informes familiares nunca muestran la edad exacta del menor.

## 4. Wompi — Sandbox

No usar una tarjeta real en este bloque.

- [ ] Configurar llaves de Sandbox y URL de eventos de Sandbox.
- [ ] Ejecutar una transacción de prueba aprobada.
- [ ] Ejecutar una transacción de prueba rechazada.
- [ ] Reenviar la misma notificación para verificar idempotencia.
- [ ] Modificar una copia de prueba del campo `reference` del webhook manteniendo el checksum original; el servidor no debe desbloquear otra evaluación porque consulta la referencia auténtica en la API de Wompi.
- [ ] Simular que falta `WOMPI_PRIVATE_KEY`; el webhook debe responder sin marcar el pago como aprobado.
- [ ] Simular error/timeout de la API de Wompi; el webhook debe responder para permitir reintento.
- [ ] Confirmar que importe y moneda se comparan con el valor almacenado en la evaluación.
- [ ] Confirmar que el informe solo se desbloquea con estado API `APPROVED`.

## 5. Panel administrativo y analítica

- [ ] Entrar con el administrador principal.
- [ ] Entrar con un colaborador que tenga `dashboard.view` pero no `clients.view`; confirmar que no recibe nombres, correos, UID ni edad individual.
- [ ] Entrar con un colaborador sin `dashboard.view`; confirmar que no accede a analítica.
- [ ] Verificar que país, ciudad, edad e idioma se agregan y que grupos con menos de 10 personas no aparecen.
- [ ] Verificar que los nombres de países se consolidan aunque el usuario introduzca variantes en español, inglés o código ISO.
- [ ] Comprobar el aviso `truncated` al superar el límite de 50.000 perfiles.

## 6. Producción

- [ ] No hacer una transacción real hasta aprobar Sandbox, configuración de Wompi y documentación legal.
- [ ] Si se autoriza un cobro real controlado, utilizar una cuenta de prueba propia y acordar previamente el procedimiento de conciliación/reembolso.
- [ ] Revisar logs de Render sin copiar secretos ni respuestas sensibles.
- [ ] Confirmar que no hay pagos duplicados y que el registro de evaluación corresponde a la transacción auténtica.
- [ ] Mantener Auto-Deploy OFF hasta aprobar el despliegue manual.
- [ ] Desplegar solo después de aprobar explícitamente el cambio.

## Alcance de pruebas ya automatizadas

GitHub Actions ejecuta Node.js 22, instala dependencias y corre pruebas unitarias/regresiones. Esto no reemplaza pruebas reales en navegador, Firebase conectado ni Wompi Sandbox. Esas verificaciones siguen pendientes.
