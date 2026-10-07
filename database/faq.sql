update public.ob_settings set value=jsonb_set(value,'{faq}',to_jsonb($faq$¿Cómo elijo mi talla?
Selecciona una talla disponible en la ficha del producto. El stock se controla por talla. Consulta por WhatsApp si necesitas medidas antes de comprar.

¿Cómo entregan en Lima Metropolitana?
La modalidad es contraentrega. El resumen del pedido muestra la tarifa configurada antes de confirmar.

¿Cómo envían a provincias?
Por Shalom. Indica destino, agencia, nombre y celular. El resumen muestra el adelanto requerido y el saldo; el flete se coordina aparte.

¿Cómo confirmo el adelanto?
Coordina el pago con OVERBLACK. ADMIN confirma su recepción y actualiza el estado del pedido.

¿Dónde veo mi pedido?
En Mi Cuenta → Mis pedidos encontrarás el número, productos, tallas, total, estado y referencia de envío cuando esté disponible.

¿Cómo funcionan los puntos STACK?
Inicia sesión para jugar. La pantalla muestra tus intentos diarios y recompensas vigentes. Los puntos se guardan en tu cuenta y puedes elegir usarlos al comprar. Los descuentos por puntos no se acumulan con cupones ni con la promoción general.

¿Qué sucede al cancelar un pedido?
Cuando ADMIN cancela un pedido, el sistema devuelve su stock y los puntos usados una sola vez. Cualquier devolución de dinero se coordina con OVERBLACK.

¿Puedo solicitar un cambio?
Consulta por WhatsApp antes de comprar. Las condiciones comerciales de cambios y devoluciones todavía están pendientes de definición.$faq$::text)) where coalesce(value->>'faq','')='';
