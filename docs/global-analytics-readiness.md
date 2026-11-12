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

## Auditoría del mapa del panel (11 de noviembre de 2026)

La implementación actual es una visualización SVG esquemática construida con polígonos simplificados y una tabla fija de centroides para un subconjunto de países. No utiliza límites geográficos oficiales y los países sin centroide definido no aparecen en el mapa, aunque sí pueden estar incluidos en las tablas agregadas. Por tanto, debe presentarse como **mapa esquemático**, no como cartografía mundial completa.

### Trabajo necesario para completar el mapa

- Sustituir los polígonos ilustrativos por geometrías de países de una fuente cartográfica con licencia compatible, empaquetada localmente para no depender de un CDN durante el uso.
- Relacionar cada geometría con su código ISO 3166-1 alpha-2.
- Dibujar únicamente países que superen el umbral de privacidad de 10 perfiles.
- Mantener el mapa por país; no añadir marcadores de domicilio, coordenadas ni ubicaciones individuales.
- Añadir leyenda, escala visual accesible, navegación por teclado y etiquetas ES/EN.
- Comprobar que territorios, países pequeños, islas y zonas sin datos se representen sin inducir a error.
- Mantener tablas agregadas como alternativa accesible y para países sin geometría reconocida.

La geometría cartográfica debe ser un recurso estático versionado en el repositorio, con atribución y licencia documentadas. No se debe introducir un proveedor de mapas externo que reciba la IP o consultas de visitantes sin revisar previamente privacidad, contratos y cookies.

