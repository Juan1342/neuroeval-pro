# Lista de aprobación previa al lanzamiento

**Última actualización:** 11 de noviembre de 2026  
**Responsable del servicio:** Juan Manuel Zamora Zapata.  
**Revisión jurídica:** el responsable informa que un abogado colombiano revisó la política de privacidad, los términos, el tratamiento de datos sensibles, el flujo de menores, pagos, derechos de titulares y transferencias internacionales, y le comunicó que la documentación está en orden. Se registra como revisión reportada por el responsable; no se publica nombre del abogado ni se atribuye a este documento una certificación independiente.

## Verificaciones completadas

- [x] Revisión jurídica colombiana reportada por el responsable; se actualizaron las cuatro páginas públicas ES/EN a versión 1.2 y se retiraron las marcas de versión preliminar.
- [x] Domicilio y contacto que se publican confirmados por el responsable: Carrera 60 # 71-10, Bello, Antioquia, Colombia; soporte.neuroevalpro@gmail.com.
- [x] Consentimiento de datos sensibles separado, expreso, versionado y revocable implementado y cubierto por pruebas.
- [x] Flujo de observación familiar exige declaración de facultad del adulto, consentimiento expreso y confirmación de que el menor fue informado y escuchado según su edad y madurez; cubierto por pruebas.
- [x] Exportación de datos y solicitudes de acceso, corrección, revocatoria y supresión implementadas; controles revisados en pruebas.
- [x] Salvaguardas de supresión de datos de evaluación y conservación mínima de registros de pago implementadas en el código.
- [x] Pruebas automatizadas de Node.js: 63/63 aprobadas en la ejecución registrada.
- [x] Pruebas de navegador Playwright: 3/3 aprobadas en GitHub Actions, ejecución 43147909915.

## Verificaciones operativas aún pendientes

- [ ] Contador confirma qué documentos de pago/contabilidad deben conservarse y por cuánto tiempo.
- [ ] Confirmar contratos, condiciones y acuerdos de tratamiento/subencargados de Firebase/Google, Render, Wompi y Brevo.
- [ ] Confirmar y documentar la región efectiva de Firestore y Render, la configuración de copias de respaldo y el ciclo real de eliminación en cada proveedor.
- [ ] Verificar el procedimiento de pagos sandbox, correos transaccionales y permisos administrativos en el entorno de lanzamiento. Las pruebas de navegador simulan autenticación y checkout; no sustituyen las verificaciones externas de proveedores.
- [ ] Aprobar con contador los plazos definitivos de conservación y, después, configurar purgas programadas auditables. La matriz actual es una propuesta operativa; no activa borrados automáticos.
- [ ] Desplegar manualmente con Auto-Deploy apagado y comprobar producción. Este paso corresponde al responsable del lanzamiento.

## Límites y notas de implementación

- La revisión jurídica se registra según lo informado por el responsable; no se inventan identidad, firma ni fecha de emisión de un concepto escrito.
- La supresión en la base activa no garantiza borrado instantáneo de copias de respaldo administradas por proveedores.
- La conservación de soportes de pago debe limitarse a los campos y plazos realmente exigibles.
- El mapa presenta únicamente estadísticas agregadas por país y oculta grupos inferiores a diez perfiles; no utiliza GPS ni presenta ubicaciones individuales.
- Las evaluaciones son de autorregistro orientativo y no constituyen diagnóstico clínico.
- No se ejecutaron pagos reales ni se modificaron secretos o configuración de infraestructura durante esta fase.
