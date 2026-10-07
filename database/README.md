# OVERBLACK — cambios incrementales

Estos archivos documentan cambios ya aplicados en Supabase. No ejecutar todos sobre producción: varios crean objetos existentes. `baseline-commerce.sql` solo sirve para una base vacía de desarrollo.

Orden de dependencias para reconstrucción de desarrollo:

1. baseline-commerce
2. admin-product-images, admin-product-visibility
3. admin-roles, profile-avatar, products
4. store-settings, settings-validation, delivery-checkout, cart
5. admin-report, stack-configuration, order-email, operational-recovery
6. content-and-promotions, admin-report-health, admin-customers
7. points-history, customer-points-detail, stack-session-completion
8. product-details, stock-history
9. saved-delivery-addresses, customer-order-history, order-shipping-guard
10. settings-concurrent-edit, promotion-report, order-confirmed-state, checkout-discount-percent

`tests/database.test.cjs` reconstruye estas dependencias en PostgreSQL local aislado (PGlite), con usuarios y datos ficticios. Las 24 pruebas pasaron el 30 de septiembre de 2026. `faq.sql` es contenido opcional, no un requisito del esquema. No volver a aplicar archivos ya registrados en la base existente.

La programación de `order-email` se encuentra activa cada cinco minutos en Supabase. El token del procesador se genera en `private.mail_runtime`; no copiarlo a archivos o clientes. Las credenciales SMTP se guardan exclusivamente en secretos de Edge Functions.

La papelera conserva el mismo producto y sus variantes; no duplica inventario. Restaurar mantiene el producto oculto e inactivo. Los pedidos existentes se conservan. Los reintentos de correo quedan en auditoría y no afectan stock ni puntos.

Pendientes del cierre: probar restauración y venta posterior, roles, cambios de envío, reintentos, entrega de emails y recorrido completo de compra. No activar compras sin productos, tarifas y políticas válidas.
