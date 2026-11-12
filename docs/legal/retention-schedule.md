# NeuroEval Pro — matriz de conservación y supresión

**Estado:** propuesta operativa para revisión jurídica y contable. No activa borrados automáticos ni modifica la infraestructura.

| Categoría | Datos | Regla propuesta | Evento de inicio / acción |
|---|---|---|---|
| Cuenta | Nombre, correo, edad, idioma y preferencias | Mientras la cuenta esté activa. Supresión al completar una solicitud verificada, salvo obligación vigente. | Última actividad / solicitud de supresión |
| Evaluaciones | Respuestas, puntajes, perfiles, recomendaciones e informes | Mientras exista cuenta y finalidad válida. Eliminar o anonimizar tras solicitud aprobada si no hay deber legal de conservación. | Solicitud aprobada |
| Pagos | Referencia Wompi, estado, importe, moneda, fechas y soporte mínimo | Conservar solo los campos necesarios durante el término contable/tributario que realmente aplique. La regla general de libros y papeles comerciales puede llegar a 10 años (Ley 962/2005, art. 28); validar con contador según la calidad y obligación del responsable. | Fecha del comprobante / último asiento |
| Soporte | Tickets y mensajes | Hasta 24 meses después del cierre, salvo reclamación o deber de conservación. | Fecha de cierre |
| Recuperación | Hash y sal de código, correo y vencimiento | Código válido por 10 minutos; borrar al usarlo, al vencerlo o al reemplazarlo. | expiresAt |
| Seguridad y auditoría | Eventos administrativos y técnicos | Propuesta: 12 meses, con acceso restringido; revisar antes de configurar purga. | Fecha del evento |
| Solicitudes de privacidad | Tipo, estado, fechas y evidencia mínima de gestión | Conservar evidencia mínima anonimizada durante el plazo aprobado por asesoría legal; no conservar detalles sensibles innecesarios. | Cierre de solicitud |
| Copias de respaldo | Copias administradas por proveedores | Aplicar el ciclo de retención configurado por el proveedor. No prometer borrado inmediato en copias; re-aplicar supresiones si se restaura una copia. | Ciclo del respaldo |

## Reglas de ejecución

1. Verificar identidad del solicitante de forma proporcional.
2. Registrar la solicitud y su fecha; responder dentro de los plazos legales aplicables.
3. Antes de borrar, identificar obligaciones legales, contables, tributarias, litigios o pagos pendientes.
4. Si hay un pago confirmado que deba conservarse, eliminar respuestas, puntajes, edad, perfil, nombre y correo de la evaluación; conservar únicamente el mínimo soporte transaccional exigible, sin vincularlo a la cuenta cuando sea viable.
5. Eliminar documentos de cuenta, evaluaciones no sujetas a retención, tickets y credenciales de recuperación; eliminar la cuenta de Firebase Authentication al final del proceso.
6. Anonimizar la evidencia de la solicitud y registrar quién la procesó, cuándo y el resultado, sin guardar el UID del titular en el registro anonimizado.
7. La revocatoria de consentimiento sensible impide nuevas evaluaciones que dependan de ese tratamiento, pero no equivale por sí sola a borrar registros anteriores.
8. La supresión del sistema activo no elimina instantáneamente copias de respaldo ni los datos que el proveedor de pagos deba conservar conforme a sus propias obligaciones.

## Controles pendientes antes de activar automatización

- Confirmar con abogado/contador los plazos aplicables a la actividad, comprobantes, facturación y pagos.
- Revisar y documentar la configuración real de backups y TTL de Firestore.
- Confirmar los términos de tratamiento, subencargados y transferencias internacionales de Firebase/Google, Render, Wompi y Brevo.
- Implementar un proceso programado y auditable de purga para tickets cerrados y logs, después de aprobar los plazos.
- Probar la eliminación en una base de datos de prueba antes de permitirla en producción.

## Fuentes normativas de referencia

- Ley 1581 de 2012, especialmente los derechos de los titulares y el tratamiento de datos sensibles.
- Decreto 1074 de 2015, artículos 2.2.2.25.2.3 y 2.2.2.25.2.8.
- Ley 962 de 2005, artículo 28, para libros y papeles de comercio cuando resulte aplicable.
- Resolución 839 de 2017, únicamente si la operación llega a constituir custodia de historias clínicas bajo el régimen de prestadores de salud; no asumir que aplica automáticamente a un autorregistro digital.
