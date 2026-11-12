# NeuroEval Pro — lista de cierre legal internacional

**Estado:** documento interno de preparación. No constituye asesoría legal ni certificación de cumplimiento.  
**Fecha:** 2026-11-11  
**Alcance previsto:** servicio mundial, idiomas iniciales español e inglés.

## Hechos técnicos observados

- NeuroEval Pro recoge datos de cuenta, edad, país/ciudad opcionales, respuestas de cuestionarios, resultados y observaciones familiares.
- Las respuestas y resultados pueden revelar o permitir inferir información relacionada con la salud o el bienestar cognitivo.
- La evaluación individual exige una cuenta adulta (18–99 años) en el servidor.
- Existe un flujo de observación familiar que puede referirse a menores; el formulario registra una declaración de autorización del adulto, pero el sistema no verifica documentalmente la identidad ni la autoridad parental.
- La plataforma utiliza Firebase Authentication/Firestore, Render y Wompi. El titular confirmó que Brevo está configurado como proveedor de correo activo y que el envío funciona; siguen pendientes la revisión contractual, los subencargados y la ubicación efectiva del tratamiento.
- En la rama de preparación se retiraron las solicitudes de Google Fonts y Tailwind CDN: se usan fuentes del sistema y estilos locales. El SDK web de Firebase (gstatic.com) y el widget de Wompi (checkout.wompi.co) siguen siendo recursos externos. Falta inspección de red en navegador y en producción.
- La política de privacidad conserva 14 marcadores pendientes de completar o validar y está identificada como borrador no apto para publicación.

## Identificación confirmada del responsable

- [x] Responsable: JUAN MANUEL ZAMORA ZAPATA, persona natural, Colombia (dato confirmado por el titular del proyecto el 11 de noviembre de 2026).
- [x] Dirección oficial para notificaciones judiciales: Carrera 60 # 71-10, Bello, Antioquia, Colombia (confirmada por el responsable y autorizada expresamente para publicación el 11 de noviembre de 2026; la revisión jurídica de su suficiencia continúa pendiente).
- [x] Correo oficial de privacidad, soporte y reclamaciones: soporte.neuroevalpro@gmail.com (facilitado por el responsable; falta probar operatividad y tiempos de respuesta).
- [ ] Definir si se designará un canal separado para derechos de protección de datos.

## Datos reales adicionales que debe aportar el responsable

- [x] Nombre legal del responsable persona natural: JUAN MANUEL ZAMORA ZAPATA.
- [x] País y domicilio informados: Colombia; dirección facilitada en Bello, Antioquia (pendiente validación legal).
- [x] NIT 1007114237-5: el responsable confirmó el 11 de noviembre de 2026 que coincide exactamente con el dato de su RUT. La verificación se basa en esa confirmación; no se ha inspeccionado una copia del RUT.
- [x] Correo oficial para privacidad, consultas y reclamaciones: soporte.neuroevalpro@gmail.com (validar operatividad y procedimiento interno).
- [ ] Responsable interno que atenderá solicitudes y plazos operativos.
- [x] Brevo confirmado por el titular como proveedor de correo activo y funcional. [ ] Revisar contrato, región y subencargados de Brevo.
- [x] Región de Cloud Firestore confirmada en el proyecto: southamerica-east1 (São Paulo, Brasil). La documentación oficial indica que la región de Firestore se fija al crear la base y no puede cambiarse después. [ ] Confirmar por consola/cuenta y contrato las condiciones de Google Cloud y Firebase Authentication.
- [x] Región del servicio de aplicación Render confirmada en el Dashboard: Oregon, Estados Unidos. Render publica Oregon como una de sus regiones disponibles. [ ] Confirmar tratamiento de logs, copias, soporte y subencargados en el DPA.
- [x] Documentación pública de Brevo indica bases de datos en la UE, almacenamiento Google Cloud en Bélgica e infraestructura OVH en Francia/Alemania. [ ] Verificar DPA, subencargados y alcance de la cuenta real.
- [ ] Confirmar ubicación, subencargados, transferencias y contrato aplicable de Wompi.
- [ ] Inventario real de cookies, almacenamiento local, SDK, logs, IP y analítica.
- [ ] Política de retención por categoría de dato, backups y proceso verificable de eliminación.
- [ ] Procedimiento para incidentes y notificación de brechas.
- [ ] Identificación de los mercados donde se prestará efectivamente el servicio y si se dirigirá a menores.

No completar estos campos con datos inventados. Si el responsable es una persona natural, la publicación de su dirección o datos personales debe revisarse jurídicamente antes de decidir qué información se muestra.

## Decisiones de producto y tratamiento

- [ ] Definir la finalidad precisa de cada dato y si cada campo es necesario.
- [ ] Determinar la base jurídica aplicable a datos personales y, por separado, la condición para tratar datos sensibles/de salud en cada mercado.
- [ ] Asegurar que la autorización para datos sensibles sea explícita, previa, informada, específica y separada cuando la ley aplicable lo exija.
- [ ] Explicar que las respuestas sobre datos sensibles son facultativas cuando corresponda.
- [ ] Decidir si se mantiene el flujo de observación de menores, en qué países, con qué edad mínima y qué verificación de autoridad parental será necesaria.
- [ ] Definir si se permitirá a menores crear cuentas o usar directamente el servicio. La configuración técnica actual solo permite evaluación individual a adultos.
- [ ] Determinar si se necesita una evaluación de impacto de protección de datos (DPIA/PIA) por el tratamiento de datos de salud, perfiles y observaciones de menores.
- [ ] Definir los derechos, canales, plazos, excepciones y proceso de respuesta para cada jurisdicción.
- [ ] Establecer reglas de conservación, bloqueo, exportación, rectificación y eliminación, incluidas copias de seguridad.
- [ ] Revisar transferencias internacionales y contratos con encargados/subencargados.
- [ ] Revisar si se requiere representante, delegado de protección de datos, registro o inscripción en cada mercado.

## Documentos preparados en la rama de trabajo

- [x] `public/privacy.html`: política bilingüe con identidad, NIT, dirección y correo del responsable; pendientes proveedores, retención, procedimiento de derechos y validación jurídica.
- [x] `public/terms.html`: términos bilingües con identidad, NIT, dirección y correo del responsable, precio base de $4.000 COP, naturaleza informativa, pago Wompi y derechos de consumidor; pendientes pruebas de compra y revisión jurídica.
- [x] `public/cookies.html`: aviso bilingüe basado en inspección de código; pendiente inventario real de cookies/almacenamiento/terceros en navegador y revisión jurídica.
- [x] Enlaces a los tres documentos añadidos al pie de `public/index.html`.

## Documentos y consentimientos que aún deben cerrarse

- [ ] Validar y publicar la política de privacidad y tratamiento de datos.
- [ ] Validar y publicar los términos de uso/servicio.
- [ ] Validar y publicar el aviso de cookies y tecnologías similares, si corresponde.
- [ ] Consentimiento explícito para datos sensibles, diferenciado del simple acceso/uso del servicio cuando sea necesario.
- [ ] Texto específico de observación familiar y autorización del adulto responsable.
- [ ] Información de precios, moneda COP, conversión del emisor de tarjeta, impuestos, cancelaciones y reembolsos.
- [ ] Aviso claro de que NeuroEval Pro es una herramienta de autorregistro orientativo y no diagnostica TDAH ni sustituye atención profesional.
- [ ] Procedimiento de soporte, reclamaciones y contacto.
- [ ] Versiones en español e inglés alineadas entre sí.

## Puntos regulatorios que requieren revisión profesional

### Colombia

La SIC identifica los datos relativos a la salud como datos sensibles. El tratamiento requiere revisar la autorización explícita y las obligaciones de información; también debe explicarse la facultad de no responder preguntas sensibles. No basta con una casilla genérica de aceptación de términos.

### Unión Europea / EEE

Los datos relativos a la salud son categorías especiales bajo el artículo 9 del RGPD. Deben determinarse tanto una base del artículo 6 como una condición del artículo 9. Si se ofrece un servicio de la sociedad de la información directamente a menores, también deben revisarse las reglas de consentimiento parental y las edades aplicables por Estado miembro.

### Reino Unido

El UK GDPR exige una base jurídica general y una condición separada para categorías especiales. La guía del ICO también destaca la minimización, las salvaguardas y la evaluación de impacto cuando el tratamiento pueda implicar alto riesgo.

### Otros países

No asumir que cumplir en Colombia o la UE habilita automáticamente todos los demás países. Antes de abrir cada mercado se debe revisar privacidad, menores, consumo, pagos, impuestos, transferencias y requisitos locales.

## Criterio de publicación

No publicar los documentos hasta que los campos anteriores estén completos, los flujos de menores estén resueltos y un profesional jurídico con experiencia en privacidad y servicios digitales revise el paquete para los mercados realmente elegidos.

## Fuentes oficiales de proveedores e infraestructura

- Brevo — ubicación de almacenamiento: https://help.brevo.com/hc/en-us/articles/360001005510-Data-storage-location (la documentación declara bases de datos en la UE, almacenamiento Google Cloud en Bélgica e infraestructura OVH en Francia y Alemania; verificar el DPA y subencargados de la cuenta).
- Render — regiones: https://render.com/docs/regions (Oregon figura entre las regiones disponibles); seguridad y subprocesadores: https://render.com/security (revisar el DPA vigente y la cobertura contractual).
- Firebase — ubicaciones de Cloud Firestore: https://firebase.google.com/docs/firestore/locations (la ubicación se elige al aprovisionar y no puede cambiarse después).
- Wompi — política de tratamiento de datos personales, actualizada en octubre de 2026: https://wompi.co/es/co/politica-de-privacidad (descargar y revisar el documento contractual vigente para el comercio).

## Fuentes oficiales de partida

- SIC Colombia — datos sensibles y datos de salud: https://sedeelectronica.sic.gov.co/politica-de-tratamiento-de-datos-personales
- SIC Colombia — tratamiento de datos sensibles relativos a la salud: https://sedeelectronica.sic.gov.co/publicaciones/boletin-juridico/concepto/tratamiento-de-datos-sensibles-relativos-la-salud
- RGPD, artículo 9 y artículo 8: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
- ICO — special category data: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/special-category-data/


## Controles técnicos añadidos en la rama de preparación

- [x] Separar la aceptación del aviso general de la autorización expresa para datos sensibles relacionados con salud/atención.
- [x] Versionar y registrar la autorización expresa por usuario, idioma y fecha.
- [x] Bloquear en el servidor la creación de nuevas evaluaciones si falta la autorización vigente.
- [x] Solicitar una autorización separada del adulto para observación familiar de información sensible de un menor.
- [x] Permitir retirar la autorización de datos sensibles; el retiro bloquea inmediatamente nuevas evaluaciones y registra una solicitud de revisión para los datos históricos.
- [x] Incluir el historial de autorizaciones sensibles en la exportación de datos personales.

Estos controles son medidas técnicas de preparación; no sustituyen la validación jurídica de que el texto, la finalidad, la base legal y el proceso de consentimiento sean adecuados en cada país.


## Estado actualizado de documentos (11 de noviembre de 2026)

La identidad del responsable fue confirmada por el titular del proyecto: **JUAN MANUEL ZAMORA ZAPATA, persona natural, Colombia**. La dirección **Carrera 60 # 71-10, Bello, Antioquia, Colombia** fue confirmada expresamente como dirección oficial para notificaciones judiciales y autorizada para publicación. El correo **soporte.neuroevalpro@gmail.com** fue facilitado como canal oficial. El responsable confirmó que el NIT 1007114237-5 coincide exactamente con su RUT. La cifra se incorporó a las versiones de trabajo de privacidad y términos; la revisión jurídica/contable de su presentación sigue pendiente.

Los tres documentos se prepararon en español e inglés en la rama `feature/global-launch-prep`. Los avisos conservan una advertencia visible de validación pendiente y meta robots noindex. Los enlaces de navegación se añadieron al footer de la aplicación, pero no se ha realizado despliegue ni publicación en producción.

### Pendientes bloqueantes antes de declarar vigencia

- [x] Correo oficial soporte.neuroevalpro@gmail.com recibido.
- [x] Dirección oficial de notificación judicial confirmada y publicación autorizada: Carrera 60 # 71-10, Bello, Antioquia, Colombia.
- [x] El responsable confirmó que el NIT 1007114237-5 coincide exactamente con su RUT. Confirmar en la revisión contable/jurídica la identidad comercial y de facturación que se mostrará al consumidor.
- [x] Proveedor activo confirmado por el titular: Brevo. [ ] Documentar sus condiciones de tratamiento, región y subencargados.
- [ ] Documentar ubicación de datos, subencargados y contratos de Firebase/Google Cloud, Render, Wompi y correo.
- [ ] Definir y configurar periodos de conservación y eliminación, incluyendo respaldos y logs.
- [ ] Inspeccionar cookies, localStorage, sessionStorage, IndexedDB y solicitudes de terceros en los navegadores soportados. La hoja de estilos local y la retirada de Google Fonts/Tailwind CDN se verifican por CI, pero no sustituyen esta inspección.
- [ ] Revisar y ajustar información precontractual, resumen de compra, ejecución del servicio digital, retracto, reversión del pago, garantías y reclamaciones conforme a la Ley 1480 y sus modificaciones.
- [ ] Definir si la observación familiar de menores seguirá disponible en todos los países o se restringirá por jurisdicción; validar autoridad parental y requisitos locales.
- [ ] Revisar el paquete completo con abogado con experiencia en privacidad, consumo digital y operación internacional.
- [ ] Aprobar formalmente versión, fecha de entrada en vigor y procedimiento de notificación de cambios.

**Importante:** la preparación del texto y su incorporación al repositorio no convierten por sí solas los documentos en instrumentos jurídicos validados ni demuestran cumplimiento legal en Colombia o en otros países.
