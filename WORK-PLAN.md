# OVERBLACK — continuidad del encargo
## Cierre de implementación — 28 septiembre

Esta sección actualiza los pendientes de los registros históricos anteriores.

- Implementados catálogo/carrito/checkout, Lima/Shalom, puntos, roles, perfil/foto, productos, configuración, contenido/promociones, clientes, dashboard, cupones, auditoría, recuperación y centro de errores.
- 19 pruebas automáticas de base de datos aprobadas. JavaScript comprobado sin errores de sintaxis.
- Sesión real del ADMIN GENERAL: panel, configuración (guardado confirmado), directorio y salud de correo comprobados en navegador local.
- Migraciones adicionales de validación, clientes/salud de correo, recuperación, contenido/promociones y FAQ aplicadas. Procesador de correo versión 5 activo.
- Limpieza del carrito antiguo completada; email-preview trasladado a internal y excluido de publicación. Fondos optimizados a WebP; caja y jugabilidad STACK conservadas.
- Publicación de esta versión en preparación por solicitud expresa del propietario.
- Pendientes reales: entrega de correo con pedido y recorrido completo de compra en producción; productos/stock/tarifa Lima y políticas comerciales (el propietario confirma que todavía no existen). Compras deshabilitadas hasta configurar estos datos.
- Protección de contraseñas filtradas depende de plan Pro o superior; no se contrató un plan. Advertencia pg_net documentada arriba.

Requisitos: conversación «Comprar dominio barato», listado de 395 puntos y mensaje inicial de este chat. Conservar la web, diseño negro/urbano y sistemas existentes. Migrar, verificar y solo entonces retirar reemplazos antiguos. No cargar mercancía ni inventar precios.

## Orden y estado

Indicación vigente del propietario: continuar implementación y dejar las pruebas completas para el último bloque. No volver a detener el avance para pedir inicio de sesión. Mantener solo comprobaciones técnicas mínimas necesarias para no introducir errores al editar o aplicar cambios.

1. STACK/puntos: conexión preparada en la rama de trabajo; motor Supabase existente probado. Pendiente publicar y prueba con sesión real.
2. SUPER ADMIN: migración aplicada y cuenta del propietario confirmada como ADMIN GENERAL; sección de gestión preparada. Mantener otro ADMIN existente.
3. Mi Cuenta/foto: migración de avatares privados aplicada; interfaz de perfil, historial y pedidos preparada. Pendiente validación autenticada y publicación.
4. ADMIN productos: completar crear/editar/eliminar, categorías, colecciones y tallas; conservar editor de imagen/stock existente.
5. Catálogo/carrito/checkout: conectar interfaz con datos reales y operaciones atómicas existentes.
6. Lima contraentrega / provincias Shalom y adelanto 50%: adaptar formularios, estados, cancelación y devoluciones.
7. Correos de pedidos y estados: conexión SMTP y procesador verificados. **PENDIENTE por indicación del propietario: comprobar recepción mediante un pedido de prueba.** Continuar con el siguiente punto sin bloquearse por esta prueba.
8. Configuración ADMIN: formulario organizado por tienda/contacto, compras/entregas, productos, firma de correo, STACK/recompensas y contenido/políticas. Avisos, mantenimiento, enlaces sociales y políticas conectados a la web. Clientes, productos y promociones tienen sus secciones ADMIN. Validación de configuración aplicada en Supabase. Interfaz preparada y probada localmente; publicación y sesión ADMIN real pendientes.
9. Cupones/dashboard/clientes/stock bajo/auditoría/recuperación/errores/manual privado. Directorio de clientes con búsqueda/paginación y ficha de pedidos/puntos implementado; acceso restringido a ADMIN probado. Centro de errores incluye estado y última revisión del correo, sin secretos. Migración `overblack_admin_customers_and_mail_health` aplicada. Recuperación operativa sigue pendiente.
10. Seguridad/legal/SEO/rendimiento/responsive: RLS, Storage, contraseñas filtradas, secretos, sitemap, robots y metadatos. Sitemap, robots, canonical, Open Graph y Twitter Card preparados; Mi Cuenta marcada noindex. Políticas editables, pero contenido legal definitivo sigue pendiente; no inventar datos comerciales. Supabase indica contraseñas filtradas desactivadas; documentación oficial limita esa función a Pro o superior. No cambiar plan ni contratar servicios.
11. Limpieza final solo con reemplazos probados: WhatsApp carrito antiguo, reglas locales, zonas antiguas, email-preview y páginas de sección.
12. Pruebas completas: usuario/ADMIN/SUPER ADMIN; cinco partidas, premios, pedidos, stock concurrente, cancelaciones, correos, móvil y PC.

## Requisito añadido por el propietario — 27 septiembre

Mejorar solo el fondo móvil de STACK: ambiente urbano oscuro, textura de concreto/metal/grafiti sutil, acentos rojos suaves, profundidad y desenfoque suave del fondo, plataforma/sombra bajo la torre y halo detrás de las cajas. Las cajas y la mecánica deben permanecer idénticas. No distraer ni perjudicar rendimiento móvil. Preferir capas estáticas ligeras.

## Verificación registrada

- Diecisiete pruebas locales de base de datos pasan (28 septiembre): permisos, puntos, cinco intentos, geometría del servidor, descuentos, stock, reintentos, cancelación, avatares, roles, Shalom, cupones, cola de correo, carrito privado, configuración segura y directorio privado de clientes.
- Inicio anónimo y login solo al intentar jugar comprobados en navegador local.
- Migraciones aplicadas: `overblack_super_admin_roles`, `overblack_profile_avatars`, `overblack_product_management`, `overblack_store_operations` y `overblack_order_email_scheduler`.
- Verificación en Supabase: cuenta confirmada devuelve `super_admin=true`, se conservan dos administradores.
- Protección de contraseñas filtradas sigue desactivada: pendiente resolver.
- No se modificó SMTP de cuentas, no se cargaron productos reales ni se publicó todavía la interfaz nueva.
- Correo de pedidos: secretos guardados personalmente por el propietario. Conexión y autenticación SMTP verificadas desde Edge Function; respuesta HTTP 200 y estado «Conexión SMTP verificada. Procesado: 0 correos». Programación cada cinco minutos activa. Falta prueba de entrega real con pedido; no confundir conexión con recepción.
- Mejoras de fondo móvil STACK implementadas con capas estáticas y verificadas visualmente a 390 × 844; pendiente publicación junto con interfaz.
- Catálogo, carrito, checkout Lima/Shalom, configuración, cupones y reportes implementados en rama; siguen pendientes validación autenticada integral, recuperación operativa y publicación. Compras permanecen deshabilitadas.
- Correcciones de recuperación: fallos de refresco posteriores al guardado no eliminan el avatar guardado ni ocultan la confirmación del pedido; cierre de sesión vacía la cesta de la cuenta anterior.
- Centro de configuración: prueba de interfaz local con datos simulados confirma guardado, actualización de aviso/mantenimiento y políticas como texto sin ejecutar HTML. No sustituye una prueba con sesión ADMIN real. Migración `overblack_settings_validation` aplicada y verificada, compras siguen deshabilitadas.
- Directorio y ficha de cliente comprobados en navegador con datos simulados; funciones del directorio/reporte verificadas en Supabase bajo rol autenticado ADMIN. Corregido bloqueo indebido de Mis pedidos para clientes; su consulta conserva filtro por propietario y RLS.
- Por instrucción del propietario se continúa la lista sin esperar inicio de sesión. Quedan pendientes prueba del panel con sesión real, publicación de interfaz y recepción de correo de pedido.
- Recuperación operativa implementada: papelera de productos sin pedidos, restauración oculta y sin activar venta, conservación de tallas/foto/stock, auditoría; reintentos de correos fallidos desde Centro de errores sin reenviar los marcados como enviados ni interferir con un envío en curso. Migración `overblack_operational_recovery` aplicada. Pendiente comprobar en el bloque final.
- Pedidos ADMIN incorpora formulario de código/referencia de envío mediante la operación existente `ob_tracking` y su notificación automática.
- Seguridad: aviso pg_net instalado en public; extensión no reubicable. No eliminar/reinstalar durante operación del correo; evaluar en cierre sin perder peticiones pendientes. Tablas privadas sin políticas RLS son intencionalmente inaccesibles directamente.
- Las 17 pruebas anteriores corresponden al estado previo a recuperación/SEO/envío. No se han vuelto a ejecutar, siguiendo la instrucción de dejarlas al final.

## Publicación — 29 septiembre
Interfaz y recursos publicados en main (70ad29d). Corrección de empaquetado de GitHub Pages en e930c74: el cliente público ahora se sirve como vendor-supabase.js; las exclusiones se limitan a directorios. Las migraciones y el procesador ya estaban aplicados en Supabase. Los archivos fuente database/, tests/, supabase/ e internal/ permanecen conservados localmente; todavía no se subieron al repositorio por restricciones del conector. La vista de correo antigua queda excluida de la web pública.

## Avance incremental — 29 septiembre, lista de 200 puntos
- Supabase: historial con saldo anterior/cambio/saldo final; ficha ADMIN con intentos; registro de final de partida y eliminación del límite de 300 cajas. Migración aplicada sin tablas duplicadas.
- Interfaz: actualización compartida del saldo, protección contra respuestas antiguas, historial paginado y Mis descuentos con recompensas utilizadas/devueltas por pedido.
- Verificación técnica mínima de JavaScript correcta. Las 21 pruebas de base de datos previas corresponden al bloque anterior; pruebas completas y recorrido de compra reservados para el final por indicación del propietario.
- Acceso al navegador restablecido; publicación de este bloque en curso. No equivale a completar toda la lista.

- Publicación confirmada: d773ada, Mi Cuenta/Mis descuentos visible en OVERBLACK.store. Fotos de productos: optimización WebP hasta 1600 px preparada; conserva original si la conversión no reduce peso o no es compatible. Verificación de sintaxis realizada; prueba visual de carga reservada al cierre.

## ADMIN Productos — 29 septiembre
- Ampliación de ob_products (sin tablas nuevas): descripción y fotos adicionales; categorías nuevas desde el formulario existente.
- Galería ADMIN: hasta 8 fotos, principal seleccionable, quitar de galería sin borrar originales, compresión al subir y prevención de sobrescritura si otra persona cambió las fotos.
- Catálogo: categorías sincronizadas, descripción, galería y ampliación dentro de la interfaz actual.
- Migración overblack_product_descriptions_categories_gallery aplicada. Comprobación mínima con transacción revertida: guardar descripción/categoría y galería mediante rol ADMIN funciona; no se modificó mercancía existente.
- Sintaxis JS correcta; pruebas completas de carga, concurrencia y móvil pendientes del bloque final. Asesores de seguridad sin avisos nuevos; se mantienen los dos avisos previamente documentados.

## Stock por talla — 29 septiembre
- Historial privado de stock reutiliza admin_audit, sin duplicar tablas de inventario: cantidad anterior, variación, cantidad final, talla, fecha, responsable y pedido cuando corresponde.
- Registro automático en creación/ajuste/eliminación de talla, compra confirmada y restauración por cancelación. No se inventó historial anterior.
- Consulta paginada protegida para ADMIN e interfaz Historial de stock preparada.
- Catálogo distingue tallas agotadas y última unidad.
- Migración overblack_stock_movements_existing_audit aplicada; comprobación mínima de tres movimientos dentro de transacción revertida correcta. No se alteró stock real. Asesores sin avisos nuevos. Pruebas completas al final.

## Carrito — 29 septiembre
- Foto, talla, precio unitario, importe y subtotal; opción Vaciar carrito con filtro por propietario en Supabase.
- Incrementar/descontar/eliminar actualiza la pantalla solo tras guardar correctamente; operaciones de la misma pestaña serializadas y cuenta comprobada antes de mostrar resultado.
- Cantidades superiores al stock o productos ya no disponibles muestran instrucciones claras; botón + deshabilitado al alcanzar stock/límite.
- No se cambian descuentos ni validación de checkout. Sintaxis correcta; recorrido con mercancía y compra reservado para pruebas finales.

- Publicación confirmada en OVERBLACK.store: interfaz con shop.js y commerce.css versión 26; stock-history.js versión 25. Último bloque de carrito en main: 522989911a0a2df7261265f33c3e050a010e6800. Fuentes nuevas product-details.sql, stock-history.sql y las tres mejoras de puntos/STACK respaldadas en database/. Pendiente prioritario siguiente: direcciones guardadas del checkout y validación geográfica Lima/Shalom; pruebas completas al final.

## Direcciones y validación de entrega — 29 septiembre
- Se reutiliza ob_addresses para guardar hasta 10 destinos por cuenta, editarlos/eliminarlos y elegirlos al comprar. RLS por propietario conservada; escrituras por función autenticada validada.
- Provincia de Lima: selección entre 43 distritos oficiales, modalidad contraentrega. Otros destinos: Shalom, con ciudad/agencia y adelanto configurado (actualmente 50%). Las provincias fuera de Lima se introducen como texto; no se verifica disponibilidad real de la agencia.
- Fuente geográfica: https://www.gob.pe/institucion/pcm/campa%C3%B1as/4355-lima-metropolitana-informacion-territorial y listado de distritos de CENEPRED/INEI.
- Checkout conserva datos al volver desde el resumen y guarda direcciones solo si el cliente lo solicita. Pedido conserva departamento y provincia.
- Migración overblack_saved_addresses_and_delivery_validation aplicada. Comprobación mínima de Lima/Shalom en transacción revertida: dos destinos válidos; no quedaron direcciones de prueba. Sintaxis correcta, recorrido completo al final.

## Historial de pedidos — 29 septiembre
- Consulta privada del diario existente order_events para cliente propietario y ADMIN, con fechas de Perú y paginación. No duplica tablas ni publica identificadores del personal.
- Listado de pedidos paginado en bloques de 25 para conservar acceso a pedidos antiguos; protege respuestas tardías al cambiar de cuenta.
- Migración overblack_customer_order_history aplicada. Sintaxis correcta y acceso sin sesión rechazado; pruebas completas con pedidos reservadas para el final.
- Direcciones publicadas: respaldo main a1e9b70dbaadaaf5b919cbcb320c2b6d7997c8fe. Mi Cuenta muestra Mis direcciones.


- Publicación final confirmada en OVERBLACK.store: login.js?v=28, delivery-addresses.js?v=27. Respaldo main a3267a8d156cfba04533bec9059e37c564368106. Formulario público de cuenta abre correctamente con departamentos/provincias/distritos.
- Para el cierre: cargar saved-delivery-addresses.sql y customer-order-history.sql en el entorno de pruebas; actualizar datos de prueba Shalom con departamento/provincia; probar aislamiento entre clientes, guardado/edición/eliminación, ida/vuelta del resumen, historial y paginación con pedidos reales de prueba controlados. Las pruebas completas no se ejecutaron en este bloque por instrucción del propietario.


## Gestión operativa — 30 septiembre
- Pedidos: filtros de estado, modalidad y número; importes de adelanto/saldo; confirmación explícita antes de registrar adelanto y entrega/cobro. Conserva historial y paginación.
- Supabase exige referencia Shalom antes de marcar enviado. Guardar la misma referencia no duplica eventos. Se conservan cancelación y reposición atómicas.
- Correo order-email versión 6 desplegada: motivo del aviso separado del estado actual, importes y cancelación sin prometer devolución monetaria automática. SMTP sin cambios; recepción real pendiente para pruebas finales.
- Configuración: guardar solo cambios, rechazo de ediciones simultáneas del mismo ajuste, lista de datos por completar y vista previa de textos del correo. Migración aplicada; comprobación en transacción revertida, sin cambios persistentes.
- Pruebas completas de pedidos/entregas/correos pendientes al cierre por indicación del propietario.


- Cupones y dashboard: uso por cupón con pedidos sin cancelar, entregados y cancelados; descuento de entregados; puntos restituidos y canjes netos. Usa pedidos y movimientos existentes, sin nuevas tablas. Migración overblack_promotion_report aplicada.


- Lista 200: estado Confirmado añadido entre recibido/adelanto confirmado y preparación; se mantienen transiciones antiguas por compatibilidad. Reglas de entrega en catálogo y carrito. Checkout muestra porcentaje exacto calculado por servidor.
- Correo versión 7 activa con estado Confirmado. Sintaxis JS comprobada. Seguridad sin avisos nuevos; pendientes históricos de pg_net y contraseñas filtradas siguen documentados.


## Validación y respaldo — 30 septiembre
- 24/24 pruebas de base de datos pasaron en PGlite aislado; cargan todas las migraciones nuevas. Cobertura: puntos, límites de STACK, stock, descuento, idempotencia, cancelación, roles, privacidad, direcciones, historial, referencia Shalom y configuración concurrente. No se crearon pedidos de prueba en producción.
- Fuente del correo v7 respaldada en GitHub (4ae5ea9244493b0160ac5f8e29a0b4a9e3563306). Respaldo integral de SQL y pruebas preparado.
- Pendientes reales: recepción de correo, recorrido de compra/navegador con stock controlado, revisión móvil completa; datos y políticas comerciales todavía no facilitados. No equivale a tienda lista para ventas ni a todas las pruebas end-to-end aprobadas.


## Reanudación — 7 octubre
- GitHub main sigue en 4ae5ea9244493b0160ac5f8e29a0b4a9e3563306. Respaldo integral aún no confirmado: navegador autenticado como Marquinhobarbieri sin permiso de escritura. Se solicitó autenticación con el propietario; no se modificaron permisos.
- Revisión visual móvil con viewport 390x844: ancho de contenido 375 px, sin desbordamiento horizontal; canvas de 347 px dentro de pantalla. Cajas y controles visibles. No se inició ninguna partida ni se consumieron intentos.
- Carrito vacío muestra correctamente Lima contraentrega y Shalom 50% con flete aparte. Sin datos ni pedidos de prueba añadidos en producción.


- Acceso del propietario restablecido el 7 de octubre; GitHub permite nuevamente publicar. Se retoma el respaldo integral sin cambiar la base de datos en producción.


- Respaldo de 31 archivos de database confirmado en GitHub: bad9fb9aac737ac7e7aa382da5a0ab6166689ba5. Archivo de pruebas aisladas incorporado a tests/database.test.cjs; no se ejecutaron migraciones nuevamente en producción.


## Foto de perfil — 7 octubre
- Vista previa de foto actual y archivo seleccionado antes de guardar; avatar OB por defecto conservado.
- Guardar y eliminar comparten bloqueo para evitar operaciones simultáneas; se comprueba la sesión antes de guardar y limpiar la foto anterior.
- Validación de formato/tamaño y sintaxis JavaScript comprobadas. No se alteraron perfiles ni archivos de usuarios para probar.


- Mejora del perfil publicada: b9c4ef2b217ac04adedc6ac5ea54b577ce6fbf2d. Vista previa confirmada en overblack.store/account.html.
- 26/26 pruebas aisladas aprobadas: se añadieron galería (propiedad, duplicados, cambios simultáneos) e historial de stock (cancelación devuelve una sola vez). Comprobación adicional de bloqueo simultáneo del editor de perfil aprobada.


## Ayuda operativa ADMIN — 7 octubre
- Manual organizado en 10 temas con búsqueda sin distinguir tildes, instrucciones de pedidos Confirmados, Shalom, cancelaciones, galería, stock y recuperación.
- Centro de errores: actualización manual, diferencia entre espera y fallo, aviso de revisión antigua, fechas de Perú y explicación de recuperación sin duplicar pedidos.
- Reutiliza permisos, reporte y reintento existentes; no añade tablas ni cambia SMTP. Revisado en navegador local con datos simulados. Recepción real de correo sigue pendiente.


- Publicación confirmada en GitHub: 08ce7b29b480d97636c3316bf42cb83ca28cf83a. overblack.store/account.html carga admin-center.js?v=32 sin errores de consola en la revisión. Manual y estados revisados con datos simulados; sesión ADMIN real de estas nuevas vistas pendiente.
- Correo: última conexión SMTP verificada el 7 octubre a las 18:40 Perú; 0 pendientes, 0 fallidos. Esto no confirma recepción real de pedidos.


## Catálogo y confirmación — 7 octubre
- La ficha de fotos/detalles permite elegir talla y añadir al carrito; agotadas deshabilitadas.
- Carrito señala cantidades inválidas y ventas desactivadas antes de continuar.
- Confirmar pedido bloquea edición simultánea y doble confirmación; permite reintentar tras un fallo usando la misma solicitud.
- Verificación local con producto simulado: talla agotada, última unidad, paso desde ficha al carrito, límite de cantidad y bloqueo de compras. Prueba de concurrencia de confirmación aprobada; no se crearon pedidos reales.

