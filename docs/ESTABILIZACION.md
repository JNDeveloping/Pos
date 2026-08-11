# Estabilización del núcleo

## Causa del ciclo de sincronización

La causa principal estaba en `SyncService`: cada ejecución cambiaba `ConnectivityService` a `SYNCING` y luego a
`ONLINE`. El listener interpretaba cada regreso a `ONLINE` como una reconexión y programaba otra sincronización. A
esto se sumaba que `initialize()` podía suscribirse más de una vez durante el montaje de desarrollo con React
StrictMode. No era un problema que debiera ocultarse con demoras.

La corrección separa el estado de conectividad del estado de sincronización, hace `initialize()` idempotente y sólo
dispara sincronización automática ante una transición real desde offline/servidor no disponible hacia online. Las
sincronizaciones de diferentes pestañas compiten por un Web Lock exclusivo y se notifican mediante
`BroadcastChannel`.

## Lectura local-first

Dashboard, productos, categorías, marcas y sucursales consultan IndexedDB antes de iniciar su refresco remoto. La
interfaz mantiene los datos locales visibles si falla la API. IndexedDB versión 2 agrega nombre normalizado, términos
de búsqueda e índices para código interno y barcode. Un barcode exacto se resuelve por índice sin recorrer el
catálogo.

La búsqueda normaliza mayúsculas, acentos y separadores. Se verificó con 50.000 productos sintéticos la búsqueda por
`Coca Cola`, `PROD-42321` y `7791234567890`. La prueba usa `fake-indexeddb`, que es considerablemente más lenta que
IndexedDB nativo y tarda alrededor de 27 segundos principalmente al insertar e indexar el dataset completo.

## Límites de esta estabilización

No se agregaron ventas, caja, pagos, stock actual, compras ni promociones. La sesión offline sigue siendo limitada a
usuarios que iniciaron sesión previamente en el dispositivo. Las escrituras administrativas continúan requiriendo
servidor; el modo offline estabilizado es de consulta hasta incorporar comandos offline específicos de forma segura.
