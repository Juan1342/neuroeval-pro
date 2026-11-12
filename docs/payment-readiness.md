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
- Wompi informa en un artículo de soporte (publicado el 26 de octubre de 2020) que acepta tarjetas internacionales Visa, Mastercard y American Express, con exclusión de tarjetas virtuales. Por la antigüedad de esa publicación y porque la habilitación depende de la cuenta, debe confirmarse con Wompi antes del lanzamiento.
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

## Revisión de alternativas para cobro internacional (11 de noviembre de 2026)

- **Wompi:** mantenerlo como pasarela colombiana actual. Su artículo de soporte indica aceptación de tarjetas Visa, Mastercard y American Express internacionales (con exclusiones) y liquidación al comercio en COP. El artículo es de 2020, por lo que no se debe prometer aceptación global sin confirmación escrita y pruebas con la cuenta real: https://soporte.wompi.co/hc/es-419/articles/360042975693--Puedo-recibir-pagos-internacionales-y-como-realizo-la-conversi%C3%B3n-a-la-moneda-de-mi-cliente
- **Stripe:** no es una opción directa para abrir una cuenta comercial colombiana en este momento; Colombia no aparece en la lista oficial de países admitidos. No intentar resolverlo declarando un país distinto ni creando una entidad ficticia: https://stripe.com/global
- **PayPal:** candidato para una segunda pasarela. PayPal Colombia promociona pagos en más de 200 mercados y más de 100 divisas, pero advierte que la disponibilidad de productos varía por mercado. Su ayuda local indica que recibir fondos requiere asociar la cuenta con un partner local con licencia. Antes de programar la integración, el titular debe confirmar que su cuenta Empresas colombiana puede recibir pagos por Checkout/API, las monedas de cobro y liquidación, comisiones, retiros y restricciones: https://www.paypal.com/co/cshelp/article/%C2%BFqu%C3%A9-es-paypal-checkout-y-c%C3%B3mo-funciona-help302 y https://www.paypal.com/co/business/accept-payments
- **PayU Latam:** alternativa a consultar directamente con el área comercial. La API de Colombia documenta tarjetas y métodos locales; la habilitación de pagos internacionales depende de aprobación y condiciones de la cuenta. No asumir que las opciones documentadas para PayU India aplican a Colombia: https://developers.payulatam.com/latam/es/docs/integrations/api-integration/payments-api-colombia.html

### Decisión técnica provisional

Hasta que el titular confirme las capacidades de su cuenta y entregue credenciales de Sandbox, mantener COP como moneda de cobro y Wompi como proveedor activo. La plataforma puede ofrecer interfaz en español e inglés a usuarios de otros países, pero no debe anunciar precios en USD/EUR ni métodos de pago internacionales como disponibles hasta que el proveedor los habilite y se completen pruebas de autorización, webhook, conciliación, reembolsos e idempotencia.

No agregar llaves, tokens ni secretos a GitHub. Las credenciales de cada proveedor se configurarían únicamente en el gestor de secretos del entorno correspondiente, después de autorización del titular.

