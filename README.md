# Mateo Estudio — Dashboard + Portal de Cliente

React + Vite + Tailwind + Framer Motion + Recharts, conectado a PocketBase.

---

## ⚠️ PASO OBLIGATORIO ANTES DE COMPILAR

Hay que actualizar el esquema de PocketBase, si no los campos de moneda no existen y no se guarda nada.

1. Panel de PocketBase → **Settings → Import collections**
2. Cargá el archivo **`pb-schema-currency-update.json`** (está en la raíz de este proyecto)
3. **Marcá la casilla "Merge with the existing collections"** ✅
4. Revisá el diff: solo tienen que aparecer **campos nuevos en verde**. Si aparece algo en rojo (borrar), cancelá y avisame.
5. Confirmá la importación.

### Qué agrega

| Colección | Campos nuevos |
|---|---|
| `transactions` | `currency` (ARS/USD), `fx_rate`, `amount_ars` |
| `projects` | `budget_currency`, `budget_fx_rate`, `budget_ars` |
| `clients` | `estimated_value_currency`, `estimated_value_fx_rate`, `estimated_value_ars` |
| `services` | `price_currency` |
| `tasks` | `client` (relación) + reglas para que el cliente cree solicitudes desde el portal |

---

## Correr el proyecto

```bash
npm install
npm run dev          # desarrollo en http://localhost:5173
npm run build        # genera dist/ para producción
```

La URL de PocketBase se configura en `.env` (`VITE_PB_URL`).

---

## Sistema de moneda (ARS / USD)

**Moneda base: peso argentino.** Todos los totales, KPIs y gráficas se calculan en ARS.

Cuando cargás un monto en **USD**, debajo del campo aparece en letra chica la conversión aproximada a pesos con la cotización del día. Al guardar, esa conversión **se congela**: se almacena el monto original en USD, la cotización usada (`fx_rate`) y el equivalente en pesos (`amount_ars`). Si el dólar sube o baja después, ese registro no se mueve.

En las listas, los montos en USD se ven así:

```
US$1.500
≈ $1.792.500 ARS al registrarse
```

**Cotizaciones** (`src/context/FxContext.jsx`): se piden a dolarapi.com (fuente principal), con fallback a CoinGecko y, si no hay red, valores de referencia claramente etiquetados. Se refrescan cada 5 minutos.

El widget del Dashboard muestra **USDT/ARS**, **USDC/ARS** y el **dólar oficial**.

---

## Rutas

| Ruta | Quién entra | Qué es |
|---|---|---|
| `/` | todos | Login |
| `/app` | admin, equipo | Dashboard, Clientes, Proyectos, Tareas, Finanzas |
| `/portal` | cliente | Portal de Cliente |

El rol `equipo` no ve Finanzas (oculto en el menú y bloqueado por las reglas de PocketBase).

---

## Portal de Cliente

Cuatro pestañas:

- **Resumen** — proyecto activo con anillo de progreso animado, stepper de fases, lista de todos los proyectos, actividad reciente y botón para enviar solicitudes al equipo.
- **Mis datos** — el cliente actualiza su propia información de contacto.
- **Facturas** — historial con montos en su moneda original + conversión congelada. Si hay pendientes o vencidas, aparece un punto rojo parpadeante en la pestaña y un banner arriba con el total a saldar.
- **Credenciales** — bóveda donde el cliente guarda sus accesos (hosting, redes, etc.) para que el equipo los administre. Las contraseñas están ocultas hasta que se toca el ojito. El cliente puede crear y editar, pero no borrar.

---

## Desplegar en el VPS

```bash
npm run build
scp -r dist/* root@TU_IP:/tmp/mateo-dist/
```

Y en el servidor:

```bash
docker exec pocketbase-d4iq-pocketbase-1 sh -c "rm -rf /pb_public/*"
docker cp /tmp/mateo-dist/. pocketbase-d4iq-pocketbase-1:/pb_public/
rm -rf /tmp/mateo-dist
```

Verificá que quedó bien:

```bash
docker exec pocketbase-d4iq-pocketbase-1 ls /pb_public
# tiene que mostrar: assets  index.html
```

---

## Estructura

```
src/
  lib/         api.js (PocketBase + formatos ARS/USD), constants.js
  context/     ToastContext, FxContext (cotizaciones)
  components/  ui.jsx (Modal, Select, MoneyField, Stepper...), Sidebar, AppLayout,
               AuroraBackground, CountUp
  pages/       Login, Dashboard, Clientes, Proyectos, Tareas, Finanzas, Portal
```

---

## Pendiente

Módulos que todavía no están: Servicios, Usuarios, Notificaciones, Configuración.

## Nota

Este entorno no tiene acceso a red, así que no pude ejecutar `npm run build` para probarlo antes de entregarlo. Verifiqué la sintaxis de los 16 archivos con un validador que ignora comentarios y strings, y todos pasan. Si el build tira algún error, pasámelo y lo corrijo.

---

## Cotizador (marca blanca)

Sistema de presupuestos con dos caras, pensado para generar dependencia real sin competir con herramientas que tus clientes ya usan (como un CRM).

**Para vos** (`/app/cotizador`, admin y equipo): armás presupuestos para tu cartera usando tu catálogo de **Servicios**. Elegís cliente, sumás ítems, definís margen de ganancia y moneda — el total se calcula solo y queda congelado al guardar.

**Para tus clientes** (pestaña "Presupuestos" en el Portal): cada cliente tiene:
- **Su propio catálogo** de materiales y mano de obra — privado, nadie más lo ve.
- **Su cotizador**, para armar presupuestos a sus propios clientes con su margen.
- **Su marca**: logo y color propios (los suben desde "Mis datos"), que aparecen en el PDF/vista impresa de cada presupuesto que emiten. Blanco total — no dice "Mateo Estudio" en ningún lado de lo que ellos generan.
- Una pestaña "De Mateo Estudio" donde ven los presupuestos que vos les armaste a ellos.

Todo aislado por cliente vía las reglas de PocketBase (`client.user = @request.auth.id`), igual que el resto del sistema.

### Instalación

Importá **`pb-schema-cotizador.json`** en PocketBase (Settings → Import collections → Merge) antes de compilar. Crea 3 colecciones nuevas: `quote_items`, `quotes`, `quote_lines`.

---

## Actualización: catálogo mixto, MXN, PDF y flujo de envío

### ⚠️ Importante: usá el esquema más nuevo

El archivo **`pb-schema-mxn-catalogo-update.json`** reemplaza a todos los JSON de esquema anteriores (currency-update, services-update, cotizador). Es el estado completo y final — impórtalo con **Merge** y no hace falta correr los anteriores.

### Qué cambia

- **Tercera moneda**: Pesos Mexicanos (MXN), disponible en todos los montos del sistema (Finanzas, Proyectos, Clientes, Servicios, Catálogo y Cotizador). Se congela igual que ARS/USD — la cotización del día queda fija al guardar.
- **Catálogo del cliente**: ahora los ítems pueden ser Material, Mano de obra o **Servicio** (antes solo materiales/mano de obra).
- **Descargar catálogo en PDF**: botón nuevo en "Mi catálogo" del Portal — genera una vista imprimible con su marca (logo + color), agrupada por tipo, lista para mandarle a un cliente potencial.
- **Método de pago** en cada cotización: Efectivo, Transferencia, Cheque u Otro — se define al crearla y se imprime en el PDF.
- **El margen de ganancia nunca se imprime**: en el PDF/impresión, el margen se diluye dentro del precio unitario de cada ítem (matemáticamente exacto), así el que emite la cotización nunca expone su costo real ni su ganancia.
- **Más datos del emisor en el PDF**: cuando lo emite un cliente (marca blanca), aparecen también su teléfono, correo y web si los cargó.
- **Animación de éxito**: al crear una cotización aparece una animación con el color de marca del cliente (o violeta si sos vos) con checkmark y anillos, y dos botones: **Crear otro** (arranca una nueva de cero) o **Enviar** (elige WhatsApp o Correo — abre la app correspondiente con un mensaje precargado).
  - *Aclaración honesta:* como todavía no hay un link público de solo-lectura para compartir la cotización, el mensaje de WhatsApp/Correo es un resumen de texto (título, total, vigencia) — no un link clickeable. Si querés que el destinatario vea el detalle completo, por ahora conviene adjuntar el PDF descargado a mano. Puedo construir un link público más adelante si te sirve.
- **Ícono de descarga** en el listado de cotizaciones (junto al de editar): abre el PDF y dispara la impresión automáticamente.

### Multi-moneda: cómo se congela

`toArs(monto, moneda, cotizaciones)` en `src/context/FxContext.jsx` centraliza la conversión. El USD usa el dólar cripto (USDT) como puente; el MXN se puentea vía USD (USD→ARS y USD→MXN, ambos de fuentes públicas). Todo lo que se guarda en el sistema fija esa conversión en el momento — nunca se recalcula después.

---

## Alta de clientes por invitación

### ⚠️ Paso extra obligatorio (uno solo, y es manual por seguridad)

Además de importar `pb-schema-invites.json` (Merge, igual que siempre), hay que agregar **a mano** una regla en el panel de PocketBase — no se puede hacer por import porque toca la colección de autenticación (`users`), que es más delicada:

1. Panel de PocketBase → **Collections → users → ⚙️ → API rules**
2. En **Create rule**, pegá exactamente esto:
   ```
   @request.auth.id = "" && @request.body.role = "cliente"
   ```
3. Guardá.

Esto es lo que garantiza, a nivel de base de datos, que **nadie pueda crear una cuenta que no sea de tipo cliente** por esta vía — aunque alguien intente manipular la petición a mano, el servidor la rechaza. Sin este paso, el formulario público de alta no va a poder crear usuarios.

### Cómo se usa

1. En **Usuarios** (admin/equipo) → **"Enviar alta de cliente"** → completás nombre/correo/teléfono (todo opcional, solo para personalizar el mensaje).
2. Se genera un enlace único (`tu-dominio/alta/ID`) y aparece la opción de mandarlo por **WhatsApp**, **Correo** o copiarlo.
3. Tu cliente abre el link: ve la animación "Todo comienza aquí", completa sus datos (negocio, contacto, y crea su contraseña) en un wizard de 3 pasos, y al terminar ve la pantalla de bienvenida con tu logo y el botón "Iniciar sesión".
4. Automáticamente queda creado: el usuario (rol cliente), la ficha en tu módulo de Clientes, y vinculados entre sí — vos no tenés que cargar nada a mano.
5. El enlace es de un solo uso: una vez completado, si alguien vuelve a abrirlo ve "Este enlace ya no está disponible".

La página **Usuarios** también lista todas las invitaciones (pendientes/completadas) y tu equipo interno (solo lectura — las cuentas de equipo se siguen creando desde el panel de PocketBase).

---

## Corrección de errores y auditoría responsive completa

### Bugs reales corregidos

1. **Alta de cliente fallaba al finalizar**: faltaba verificación de error en el paso "autenticar tras crear el usuario" — si esa petición fallaba, el resto del proceso se rompía en cascada con un mensaje inútil. Corregido, y ahora los errores muestran el motivo real (y lo dejan en la consola del navegador para diagnóstico).
2. **`ErrorBoundary` global**: si cualquier parte de la app llega a fallar, ahora ves un mensaje en pantalla con el detalle del error (en vez de una página en blanco sin explicación). Si esto aparece alguna vez, una captura de ese mensaje es oro para diagnosticar rápido.
3. **Filtros de búsqueda blindados** (Cotizador, Finanzas, Proyectos, Tareas): antes llamaban `.toLowerCase()` directo sobre campos que, si llegan vacíos desde la base, rompían toda la página.

> Si "Cotizador" seguía sin abrir después de todo esto, el sospechoso número uno es un **despliegue desactualizado** — asegurate de reemplazar `pb_public` por completo con el `dist/` más nuevo y probar en una ventana de incógnito.

### Auditoría responsive (sin scroll horizontal, sin textos superpuestos)

- **CSS Grid con ancho mínimo fijo** (`minmax(300px,1fr)` y similares) desbordaba en pantallas angostas — corregido con `minmax(min(Xpx,100%),1fr)` en los 7 lugares donde aparecía.
- **10 formularios en 6 páginas** tenían una grilla de 2 columnas que no colapsaba a 1 en mobile — era la causa más probable de los textos apretados/superpuestos. Corregido en todos.
- **Zoom automático de iOS**: los campos con letra menor a 16px hacen zoom solo al tocarlos en Safari. Ahora se agrandan a 16px en mobile.
- **Stepper de los wizards**: las etiquetas podían no entrar en pantallas de 320px. En mobile ahora se ve "Paso X de N" en texto, y las etiquetas completas aparecen desde tablet en adelante.
- **`truncate` sin `min-w-0`**: encontramos 3 casos reales donde el texto largo no se recortaba con "…" sino que desbordaba (Dashboard, selector de moneda, credenciales del Portal). Corregidos.
- **Tablas de los PDF imprimibles** (cotización y catálogo): ahora tienen scroll horizontal contenido si no entran, en vez de forzar el desborde de toda la página.
- Blindaje global: `overflow-x: hidden` en toda la app como red de seguridad final.

---

## Módulo de Notificaciones

### Instalación

Importá **`pb-schema-notifications.json`** en PocketBase (Settings → Import collections → **Merge**). Solo cambia la regla de creación de la colección `notifications` (para que cualquier usuario logueado pueda avisarle a otro) — los campos quedan exactamente igual que siempre.

### Qué incluye

- **Página Notificaciones** (`/app/notificaciones`) y pestaña nueva en el Portal del cliente — mismo componente, cada uno ve solo lo suyo (o todo, si es admin).
- **Campanita con contador** en el topbar del admin y en el header del Portal — se actualiza al cambiar de página/pestaña.
- Filtro Todas / No leídas, marcar todas como leídas, eliminar, y "hace X tiempo" en cada una.

### Avisos automáticos ya conectados

| Evento | Quién recibe el aviso |
|---|---|
| Un cliente manda una solicitud desde el Portal (Resumen) | Todo el equipo (admin + equipo) |
| Un cliente completa su alta desde el link de invitación | Todo el equipo |
| Le creás una cotización nueva a un cliente desde el Cotizador | Ese cliente (si tiene acceso al portal vinculado) |

### Limitación honesta

No hay avisos automáticos por *tiempo* (por ejemplo "esta factura venció ayer") — eso requeriría un proceso que corra solo en el servidor (cron/hooks), que no está instalado. Todo lo que sí funciona se dispara **en el momento exacto de la acción** dentro de la app.

---

## Módulo de Reportes

Sin cambios de esquema — solo lee datos que ya existen en `client_invites`, `quotes`, `clients` y `transactions`.

### Qué muestra

| Métrica | De dónde sale |
|---|---|
| Conversión de invitaciones | `client_invites`: completadas / total enviadas |
| Tasa de aprobación | `quotes`: aprobadas / (aprobadas + rechazadas) |
| Ingresos últimos 6 meses | `transactions` (solo admin, usando el monto congelado en ARS) |
| Clientes nuevos por mes | `clients.created` |
| Cotizaciones por estado | Dona: borrador / enviado / aprobado / rechazado |
| Top 5 clientes por ingresos | Suma de `transactions` agrupada por cliente (solo admin) |

Los reportes de dinero (ingresos, top clientes) quedan ocultos para el rol `equipo`, igual que en Finanzas — mismo criterio de privacidad que ya usás en el resto del sistema.

---

## Gestión de equipo, aprobación de cotizaciones y tarjeta de cotizaciones en el Resumen

### ⚠️ Paso manual obligatorio (una vez más, toca la colección `users`)

Para que un admin pueda crear cuentas de equipo **desde la app** (sin entrar al panel de PocketBase), hay que ampliar los permisos de la colección `users`. Es manual por el mismo motivo de siempre: es la colección de autenticación, y ahí no conviene hacer merge-import.

Panel de PocketBase → **Collections → users → ⚙️ → API rules** → pegá exactamente esto en cada campo:

**Create rule:**
```
(@request.auth.id = "" && @request.body.role = "cliente") || @request.auth.role = "admin"
```
*(mantiene la alta pública de clientes como estaba, y además permite que un admin cree cualquier tipo de cuenta desde la app)*

**Update rule:**
```
@request.auth.role = "admin" || id = @request.auth.id
```

**Delete rule:**
```
@request.auth.role = "admin"
```

Sin este paso, el botón "Agregar" del equipo en Usuarios va a fallar.

### Qué se agregó

- **Usuarios → Tu equipo**: ahora el admin puede crear cuentas de equipo/admin directamente (nombre, correo, contraseña, rol) y eliminarlas. No podés eliminar tu propia cuenta desde ahí (por seguridad).
- **Aprobar/Rechazar cotizaciones desde el Portal**: cuando le mandás una cotización a un cliente (estado "enviado"), al abrirla desde su Portal le aparecen los botones **Aprobar** / **Rechazar**. Al decidir, te llega una notificación a vos (y a todo el equipo) con el resultado.
- **Tarjeta "Tus cotizaciones" en el Resumen del Portal**: el cliente ve de un vistazo las últimas cotizaciones que le mandaste, con un punto ámbar parpadeante si tiene alguna pendiente de decisión.
- **Confirmado (sin cambios de código)**: los clientes que se dan de alta por el link de invitación ya aparecían automáticamente en el módulo Clientes — no hacía falta tocar nada ahí, `Clientes.jsx` lista todos los registros sin filtrar por origen.
