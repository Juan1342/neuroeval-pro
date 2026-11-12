# NeuroEval Pro — propuesta operativa de conservación y eliminación

**Estado:** propuesta interna para decisión del responsable; no es todavía una política aprobada ni una función implementada.  
**Fecha:** 11 de noviembre de 2026.

## 1. Principios
1. Conservar cada dato solo mientras sea necesario para la finalidad informada o exista una obligación legal válida.
2. Separar los datos de evaluación que pueden revelar salud de los registros contables, de seguridad y de soporte.
3. Aplicar acceso restringido, trazabilidad y eliminación segura o anonimización irreversible al vencer el plazo.
4. No conservar datos de menores que no sean estrictamente necesarios; evitar nombres, colegios, documentos y otros identificadores en observaciones familiares.
5. Un bloqueo por obligación legal debe ser específico, documentado, con acceso restringido y fecha de revisión.
6. Una solicitud de supresión no debe borrar evidencia contable obligatoria ni impedir la defensa de reclamaciones; cualquier excepción debe tener fundamento documentado y comunicarse al titular.

## 2. Matriz inicial propuesta (requiere aprobación)

| Categoría | Propuesta operativa para evaluar | Acción al vencer |
|---|---|---|
| Cuenta y perfil | Mientras la cuenta esté activa. Si permanece inactiva 24 meses, enviar aviso y revisar cierre; no borrar automáticamente sin aviso ni análisis de obligaciones. | Eliminar identificadores y credenciales, salvo datos sujetos a retención legal. |
| Respuestas e informes | 12 meses desde la generación del informe como plazo inicial de minimización, sujeto a que el producto confirme que no necesita historial más largo. | Borrado de respuestas e informes o anonimización irreversible de agregados. |
| Observación familiar de menores | Mismo plazo o menor que las respuestas; no conservar identificadores directos del menor. | Supresión prioritaria; mantener solo evidencia mínima de consentimiento cuando proceda. |
| Referencias y comprobantes de pago | Durante el plazo contable, fiscal, contractual y de defensa de reclamaciones que determine el contador/abogado para el comercio colombiano. No aplicar el plazo de los informes a los soportes contables. | Conservar únicamente el soporte exigible, separado de respuestas e informes. |
| Registros de seguridad | 90 días como objetivo inicial, ampliable de forma documentada ante incidentes, fraude o requerimiento legal. Verificar límites reales de Render y otros proveedores. | Borrado o anonimización; preservar solo evidencia necesaria de un incidente. |
| Soporte y solicitudes de derechos | 24 meses desde el cierre como objetivo inicial, sujeto a revisión de términos de reclamación y defensa legal. | Eliminar contenido innecesario y conservar evidencia mínima de atención cuando proceda. |
| Consentimientos y versiones de avisos | Mientras exista tratamiento y durante el periodo necesario para demostrar la autorización y atender reclamaciones. El plazo exacto debe aprobarse con asesoría legal. | Archivo restringido y minimizado; no borrar mientras sea necesario acreditar la base del tratamiento. |
| Copias de seguridad | Objetivo técnico: rotación máxima de 90 días, si el proveedor y la arquitectura lo permiten. | Expiración automática; una supresión debe propagarse al ciclo de rotación y quedar documentada. |

**Advertencia:** 12 meses, 24 meses y 90 días son objetivos propuestos para discusión, no plazos impuestos por ley ni periodos ya configurados. El plazo de soportes contables debe fijarse con asesoría contable y jurídica según la naturaleza de cada documento.

## 3. Flujo de eliminación requerido
1. Recibir solicitud por soporte.neuroevalpro@gmail.com o por el mecanismo autenticado de la plataforma.
2. Verificar identidad y autoridad de quien solicita; para datos de menores, verificar representación/autorización según la ley aplicable.
3. Clasificar registros: cuenta Firebase Auth, perfil Firestore, evaluaciones/respuestas, PDFs o archivos, referencias de pago, consentimientos, logs, soporte y copias.
4. Identificar obligaciones de conservación, reclamaciones abiertas o investigaciones. Registrar la excepción y restringir el dato retenido.
5. Eliminar o anonimizar los datos que no deban conservarse. Revocar credenciales/sesiones y borrar archivos derivados donde existan.
6. Propagar la eliminación a proveedores y respaldos conforme a sus contratos y ciclos; no prometer eliminación inmediata de copias si el proveedor opera rotación.
7. Registrar resultado, fecha, categorías eliminadas, excepciones, responsable y evidencia técnica mínima.
8. Responder al solicitante dentro del plazo legal aplicable y comunicar cualquier dato retenido y su fundamento.

## 4. Implementación técnica pendiente
- Inventariar todas las colecciones Firestore, subcolecciones, índices, archivos y referencias externas que contengan datos personales.
- Implementar una rutina idempotente de supresión por usuario y por evaluación, con borrado en lotes y reintentos.
- Eliminar la cuenta de Firebase Authentication solo después de completar la supresión de datos y conservar, si procede, una evidencia mínima no identificable.
- Separar pagos/contabilidad de respuestas e informes para poder conservar los primeros sin retener innecesariamente datos sensibles.
- Crear un trabajo programado para revisar fechas de expiración; usar borrado lógico temporal solo si tiene una finalidad y plazo claros.
- Documentar y probar la política de retención de Render, Firebase/Google Cloud, Brevo y Wompi; revisar logs, copias y subencargados.
- Añadir pruebas para borrado parcial, completo, reintentos, usuario inexistente, solicitud repetida, excepciones legales y propagación de copias.
- Mantener una auditoría mínima sin copiar respuestas, informes, datos de salud ni credenciales.

## 5. Pruebas de aceptación
- Un usuario puede solicitar eliminación y recibir un número/acuse de solicitud.
- Un administrador autorizado puede revisar el estado sin ver más datos de los necesarios.
- La rutina borra datos del usuario en todas las ubicaciones inventariadas.
- Los registros contables sujetos a conservación quedan separados y restringidos.
- Una solicitud repetida no produce errores ni resucita datos.
- La exportación y la supresión son coherentes: después de completar la eliminación no aparecen datos eliminados en nuevas exportaciones, salvo excepciones documentadas.
- Las copias expiran dentro del ciclo contractual y técnico publicado.
- El procedimiento genera evidencia mínima y no retiene el contenido sensible por duplicado.

## 6. Decisiones necesarias del responsable
Antes de convertir esta propuesta en política vinculante, aprobar:
- 12 meses para respuestas e informes.
- 24 meses para inactividad de cuenta y expedientes de soporte, con avisos y revisión.
- 90 días para logs de seguridad y rotación de respaldos, si los proveedores lo permiten.
- El plazo legal contable/fiscal aplicable a soportes de pago, validado por contador.
- El tratamiento de cuentas inactivas y solicitudes de supresión con reclamaciones pendientes.

No desplegar ni activar tareas automáticas de borrado hasta completar el inventario, validar excepciones legales y probar consistencia en una copia de datos no productiva.
