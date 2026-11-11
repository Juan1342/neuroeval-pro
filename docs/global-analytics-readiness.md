# NeuroEval Pro — estado de analítica global

**Estado:** listo para una primera etapa de hasta 50.000 perfiles; no es aún una arquitectura de millones de usuarios.  
**Fecha:** 2026-11-11

## Datos que se agregan

La ruta administrativa lee únicamente estos campos de perfil:

- País declarado.
- Ciudad declarada.
- Código de país detectado por el proxy, cuando exista.
- Edad, convertida a bandas de edad antes de generar resultados.
- Idioma preferido.

No consulta ni agrega nombres, correos, respuestas, puntuaciones, recomendaciones ni informes de evaluación.

## Protecciones actuales

- Acceso exclusivo a personal con permiso `dashboard.view`.
- Consulta Firestore paginada y proyección de campos.
- Límite de 50.000 perfiles por cálculo; la respuesta indica `truncated: true` si hay más.
- Umbral de privacidad de 10 personas por grupo en país, ciudad, edad e idioma.
- Máximo de 1.000 grupos por dimensión.
- Caché local y compartida en Firestore con vigencia de cinco minutos.
- Normalización de nombres de países en inglés/español y códigos alpha-2 mediante `Intl.DisplayNames`.
- Los grupos pequeños se excluyen, no se muestran como filas de una sola persona.

## Límites que deben conocerse

- Si la base supera 50.000 perfiles, la respuesta representa solo el conjunto escaneado y marca el truncamiento.
- La consulta vuelve a recorrer perfiles al vencer la caché; no es adecuada como solución permanente para millones de cuentas.
- Los nombres de ciudades son texto declarado por los usuarios; pueden existir variantes ortográficas.
- El mapa del panel usa una representación esquemática y centroides disponibles; no es un mapa cartográfico completo ni cubre necesariamente todos los códigos de país.

## Evolución para escala mayor

Antes de superar el límite operativo, migrar a agregados incrementales o rollups programados por país/ciudad/banda de edad/idioma, con controles de privacidad que mantengan el umbral mínimo de 10. Debe evitarse almacenar dimensiones clínicas o respuestas de cuestionarios en analítica global.

## Verificación

La cobertura automatizada comprueba normalización de países, consolidación de variantes, bandas de edad, umbral mínimo, límite de grupos, etiquetas bilingües y protección de la ruta administrativa. Las pruebas de integración contra Firestore real y revisión de costos deben ejecutarse antes de aumentar el volumen.
