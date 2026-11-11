# NeuroEval Pro — revisión de pagos Wompi

**Estado:** revisión de código completada; verificación operativa pendiente.  
**Fecha de revisión:** 2026-11-11  
**Rama:** `feature/global-launch-prep`  
**No desplegar hasta completar las variables y pruebas descritas aquí.**

## Flujo que implementa el servidor

1. El servidor obtiene la evaluación del usuario autenticado y confirma su propiedad.
2. El importe se calcula en el servidor. El precio base permanece fijado en **$4.000 COP**.
3. El servidor genera la referencia y la firma de integridad para el widget.
4. El navegador puede regresar a la plataforma, pero esa redirección no confirma el pago.
5. Wompi envía `transaction.updated`; el servidor valida el checksum SHA-256 usando `X-Event-Checksum` o `signature.checksum` y el secreto de eventos.
6. El servidor consulta el ID de transacción en la API autenticada de Wompi con la llave privada.
7. Solo la respuesta autenticada de Wompi determina referencia, importe, moneda y estado. El registro se marca pagado si la referencia corresponde a una evaluación pendiente, el importe coincide y el estado verificado es `APPROVED`.

## Variables requeridas

- `WOMPI_PUBLIC_KEY`
- `WOMPI_PRIVATE_KEY`
- `WOMPI_INTEGRITY_SECRET`
- `WOMPI_EVENTS_SECRET`

Las llaves pública y privada deben pertenecer al mismo ambiente: `pub_test_` con `prv_test_`, o `pub_prod_` con `prv_prod_`. La llave privada solo se configura como secreto del servidor; nunca se envía al navegador ni se guarda en GitHub.

Si falta la llave privada, o Wompi no puede confirmar la transacción mediante su API, el webhook responde sin aprobar el pago y permite que Wompi reintente. No debe eliminarse esta verificación para “hacer funcionar” el checkout.

## Alcance internacional confirmado por la documentación de Wompi

- La integración de checkout utilizada por NeuroEval Pro cobra en **COP**; Wompi documenta COP como moneda disponible para esa integración.
- Wompi informa que acepta tarjetas internacionales Visa, Mastercard y American Express, con exclusión de tarjetas virtuales, sujeto a las condiciones de la cuenta del comercio.
- El comercio recibe el abono en COP. La conversión que vea el comprador depende del emisor de su tarjeta; NeuroEval Pro no está convirtiendo ni cobrando en la moneda local de cada país.
- PSE, Nequi y otros métodos locales no deben presentarse como disponibles mundialmente. La disponibilidad efectiva depende de los métodos habilitados para la cuenta del comercio.

## Verificaciones externas pendientes

- [ ] Confirmar en el Dashboard de Wompi que la cuenta del comercio tiene habilitadas tarjetas internacionales.
- [ ] Confirmar qué franquicias, países y tipos de tarjeta acepta la cuenta real.
- [ ] Configurar `WOMPI_PRIVATE_KEY` en Render como secreto, con el mismo ambiente de las demás llaves.
- [ ] Confirmar que la URL de eventos de Sandbox y la URL de eventos de Producción estén configuradas por separado en Wompi.
- [ ] Ejecutar en Sandbox una transacción aprobada, una rechazada y una notificación repetida.
- [ ] Confirmar que una redirección sin webhook aprobado nunca desbloquea el informe.
- [ ] Comprobar el registro de pago y el informe después de la confirmación.
- [ ] Verificar el procedimiento de conciliación de transacciones pendientes o eventos agotados.

**No se ha realizado ningún cobro real ni se ha modificado la configuración de Render o Wompi.**

## Referencias oficiales

- Eventos y firma del webhook: https://docs.wompi.co/docs/colombia/eventos/
- Ambientes, prefijos de llaves y URLs base: https://docs.wompi.co/docs/colombia/ambientes-y-llaves/
- Consulta autenticada de transacciones: https://docs.wompi.co/docs/colombia/transacciones/
- Métodos de pago: https://docs.wompi.co/docs/colombia/metodos-de-pago/
- Pagos con tarjetas internacionales: https://soporte.wompi.co/hc/es-419/articles/360042975693--Puedo-recibir-pagos-internacionales-y-como-realizo-la-conversi%C3%B3n-a-la-moneda-de-mi-cliente
