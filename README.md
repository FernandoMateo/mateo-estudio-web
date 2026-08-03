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

---

## Reestructuración de Servicios + vencimientos recurrentes

### Instalación

Importá **`pb-schema-servicios-recurrentes.json`** (Settings → Import collections → **Merge**).

⚠️ **A diferencia de otras veces, en este import SÍ vas a ver un aviso para borrar campos** (`price`, `price_currency`, `price_fx_rate`, `price_ars` de `services`) — es esperado, confirmalo. Es justamente lo que pediste: sacar el precio del catálogo de Servicios.

### Qué cambió

**Servicios** — ahora solo tiene nombre, categoría, descripción, ícono y si es **Único** o **Recurrente** (mensual/trimestral/anual). El precio ya no vive acá.

**Proyectos** — cada proyecto ahora puede vincularse a un Servicio del catálogo. El precio real (con el sistema de moneda ARS/USD/MXN que ya conocés) sigue siendo el campo `Presupuesto` del proyecto — ahí es donde definís cuánto cobra cada cliente en particular, como pediste.

**Cuando el servicio vinculado es recurrente**, aparece un campo extra: **"Próximo vencimiento"**. Eso dispara dos cosas:
- En el **Portal del cliente**, una tarjeta nueva en el Resumen ("Vencimientos") le muestra todos sus servicios recurrentes con la fecha y los días que faltan — en rojo si es hoy/vencido, en ámbar si es en la próxima semana.
- **2 días antes** (o si ya venció), el cliente recibe una notificación automática avisándole.

### Cómo funciona el aviso automático (léelo, es importante)

No hay ningún proceso corriendo solo en el servidor — la revisión se dispara **cuando vos o tu equipo abren la app** (vive en el layout del admin). Si nadie entra al sistema en un día puntual, el aviso se dispara la próxima vez que alguien entre, aunque sea con un día de atraso. Cada vencimiento se avisa **una sola vez por ciclo** — cuando actualizás la fecha a la próxima renovación, se resetea automáticamente para volver a avisar en el siguiente ciclo.

Si en algún momento querés que esto sea 100% automático sin depender de que alguien abra la app, la única forma real es un proceso en el servidor (PocketBase hooks) — es más delicado de instalar y mantener, pero se puede evaluar más adelante si te hace falta.

---

## Progreso automático por fase + vista individual de proyecto en el Portal

**Sin cambios de esquema** — usa los campos `phase` y `progress` que ya existían.

### Qué cambió

**Progreso automático**: ya no hay slider manual. El % se calcula solo según la fase:

| Fase | Progreso |
|---|---|
| Descubrimiento | 20% |
| Diseño | 40% |
| Desarrollo | 60% |
| Revisión | 80% |
| Entrega | 100% |

**Cambio rápido de fase**: en cada tarjeta de Proyectos (admin/equipo) hay un botón con el nombre de la fase actual — tocalo y aparece un selector para cambiarla ahí mismo, sin abrir el formulario completo. El progreso se actualiza solo.

**Vista individual en el Portal**: cuando un cliente tiene más de un proyecto, la lista "Todos tus proyectos" ahora es clickeable — al tocar cualquiera se abre un modal con el detalle completo (anillo de progreso, stepper de fases, fechas, descripción), igual que el que ya se veía para el proyecto activo, pero para cualquiera de sus proyectos.

---

## Notificaciones por Gmail (EmailJS)

No requiere tocar PocketBase ni el servidor — es 100% configuración externa + 4 variables en `.env`.

### Por qué EmailJS

La app no tiene backend propio (es React + PocketBase, sin código de servidor que controlemos). EmailJS permite mandar correos reales **directo desde el navegador**, conectado a tu propia cuenta de Gmail, sin instalar nada en el VPS. Plan gratis: 200 correos por mes.

### Paso a paso

1. **Creá una cuenta** en [emailjs.com](https://www.emailjs.com) (gratis, con tu Gmail sirve).

2. **Conectá tu Gmail**: en el panel → **Email Services** → **Add New Service** → elegí **Gmail** → autorizá con tu cuenta. Anotá el **Service ID** que te genera (algo como `service_xxxxxxx`).

3. **Creá una plantilla**: panel → **Email Templates** → **Create New Template**. En el cuerpo del mensaje, usá estas variables (respetá los nombres exactos):
   ```
   Para: {{to_email}}
   Asunto: {{subject}}

   {{title}}

   {{message}}

   — Mateo Estudio OS
   ```
   Guardala y anotá el **Template ID** (`template_xxxxxxx`).

4. **Conseguí tu clave pública**: panel → **Account → General** → copiá la **Public Key**.

5. **Autorizá tu dominio**: panel → **Account → Security** → en "Allowed origins" agregá tu dominio (ej. `https://pocketbase-d4iq.srv1851703.hstgr.cloud`). Sin este paso, EmailJS rechaza los envíos por seguridad.

6. **Completá el `.env`** de este proyecto con los 4 datos:
   ```
   VITE_EMAILJS_SERVICE_ID=service_xxxxxxx
   VITE_EMAILJS_TEMPLATE_ID=template_xxxxxxx
   VITE_EMAILJS_PUBLIC_KEY=tu_clave_publica
   VITE_ALERT_EMAIL=tu_correo@gmail.com
   ```

7. `npm run build` y desplegar como siempre.

### Qué te llega por correo

Todo lo que hoy le avisa a "todo el equipo" en la campanita — automáticamente también te llega a `VITE_ALERT_EMAIL`:
- Cliente aprueba o rechaza una cotización
- Cliente manda una solicitud desde el Portal
- Un cliente completa su alta por invitación

Los avisos que van **al cliente** (cotización nueva, recordatorio de vencimiento) siguen siendo solo in-app — no se reenvían a tu correo, porque son avisos *para ellos*, no para vos.

### Honestidad sobre esto

No tengo forma de probar el envío real desde este entorno (no tengo acceso a internet acá). El código sigue exactamente el contrato documentado de la API de EmailJS, pero la primera prueba real la vas a hacer vos. Si al probarlo no llega nada, lo más probable es el paso 5 (dominio no autorizado) — revisá la consola del navegador (F12), ahí debería aparecer el error exacto si EmailJS lo rechaza.

---

## Corrección: notificaciones cruzadas y pestañas del Portal que se trababan

**Sin cambios de esquema** — solo código.

### Bug 1: el admin veía notificaciones que eran de otra persona

La regla de PocketBase le permite al admin **listar** todas las notificaciones (por diseño, para supervisión), pero la campanita y la página de Notificaciones no filtraban por "las mías" — mostraban todo lo que el permiso les dejaba ver. Ahora ambos componentes siempre piden explícitamente solo las del usuario que tiene la sesión abierta, sin importar el rol.

### Bug 2: el contenido de las pestañas del Portal se dejaba de ver

`AnimatePresence mode="wait"` hacía que el contenido nuevo esperara a que la animación de salida del anterior terminara del todo antes de aparecer. Como adentro hay listas con sus propias animaciones (notificaciones, cotizaciones), esa espera a veces no llegaba a completarse nunca, dejando la pantalla vacía. Se sacó ese modo de espera tanto en el Portal como en los wizards (Clientes, Proyectos, Cotizador, Alta) por prevención — ahora el contenido nuevo aparece directo, sin depender de que termine ninguna animación de salida.

---

## PWA instalable

**Sin cambios de esquema** — solo código y archivos estáticos nuevos en `public/`.

### Qué se agregó

- **Ícono propio** (el monograma M violeta, generado en varios tamaños) — en Android/desktop la app queda instalada como cualquier otra, con su ícono en la pantalla de inicio o el dock.
- **Manifest** (`manifest.webmanifest`) — define el nombre, colores, y que se abra en modo "standalone" (sin la barra de direcciones del navegador, como una app real).
- **Service worker** (`sw.js`) — guarda en caché el "cascarón" de la app (HTML/CSS/JS) para que cargue más rápido en visitas siguientes. **Ojo, esto es importante**: las llamadas a la API de PocketBase (tus datos: clientes, proyectos, cotizaciones, todo) están explícitamente excluidas del caché — siempre se piden frescas a la red. Así evitamos el problema clásico de una PWA mal hecha que muestra datos viejos.
- **Banner de instalación**: aparece abajo a la derecha (se puede cerrar) ofreciendo instalar la app. En Android/Chrome/Desktop es un botón que dispara el instalador nativo del navegador. En iPhone (Safari no lo permite por botón), muestra el mensaje "Tocá Compartir → Agregar a pantalla de inicio", que es el único camino que Apple habilita.

### Cómo probarlo

1. Desplegá como siempre.
2. Entrá desde el celular (o Chrome de escritorio) a tu dominio.
3. Debería aparecer el banner de instalación abajo. En Android, tocá "Instalar" y se agrega el ícono a tu pantalla de inicio. En iPhone, seguí las instrucciones del mensaje.
4. Abrí la app desde ese ícono — debería abrir sin la barra de Chrome/Safari, como una app nativa.

### Honestidad sobre las limitaciones

- **Notificaciones push reales del sistema operativo** (las que aparecen aunque la app esté cerrada) requieren un paso técnico extra bastante más grande (un servidor de push + permisos del navegador) que no está incluido acá — lo que armamos hoy es la instalación de la app como ícono. Si más adelante querés push real, es un proyecto aparte que podemos evaluar.
- En iOS, algunas funciones de PWA son más limitadas que en Android por decisión de Apple (por ejemplo, el ícono de instalación con un botón no existe, hay que usar el menú Compartir).

---

## Calendario, archivos por proyecto e historial de cambios

### Instalación

Importá **`pb-schema-archivos-historial.json`** (Settings → Import collections → **Merge**). Crea 2 colecciones nuevas: `project_files` y `activity_log`.

### 1. Calendario (`/app/calendario`)

Vista mensual con todos los vencimientos juntos: entregas de proyecto (violeta), vencimientos recurrentes (ámbar) y facturas pendientes/vencidas (rojo). Tocá cualquier día para ver el detalle en el panel de al lado. Botón "Hoy" para volver rápido a la fecha actual.

### 2. Archivos por proyecto

- **Admin/equipo** (en cada tarjeta de Proyectos, ícono de carpeta): subís archivos con nombre y categoría (Brief/Contrato/Entregable/Otro), los ves listados con su tipo, los descargás o eliminás.
- **Cliente** (Portal → detalle de cualquier proyecto): ve los mismos archivos, solo lectura — puede descargarlos pero no subir ni borrar.
- Tamaño máximo por archivo: 50 MB.

### 3. Historial de cambios (`/app/historial`, solo admin)

Registra automáticamente quién creó, actualizó o eliminó qué, y cuándo. Por ahora cubre las acciones más importantes:

| Módulo | Qué queda registrado |
|---|---|
| Clientes | Crear, editar, eliminar |
| Proyectos | Crear, editar, eliminar, cambio de fase |
| Finanzas | Crear, editar, eliminar transacción |
| Cotizador | Crear, editar, eliminar cotización |
| Portal (cliente) | Aprobar / rechazar una cotización |
| Usuarios | Alta y baja de equipo, invitaciones de clientes |

**No cubre todavía**: Tareas ni Servicios (los dejé afuera por ahora para no inflar el alcance — decime si los querés sumar también, es rápido de agregar siguiendo el mismo patrón).

El historial es visible solo para el rol admin, tanto por diseño (es una herramienta de supervisión) como por el permiso de la base.

---

## Proyecto automático al aprobar, comentarios en tareas, proyectos horizontales y documentos del cliente

### Instalación

Importá **`pb-schema-comentarios-documentos.json`** (Merge). Crea 2 colecciones nuevas (`task_comments`, `client_documents`) y **actualiza el permiso de `projects`** para que el cliente pueda crear su propio proyecto al aprobar una cotización.

### 1. Proyecto automático al aprobar una cotización

Cuando el cliente aprueba una cotización tuya (issuer_type="estudio"), se crea automáticamente un proyecto:
- Nombre = título de la cotización
- Presupuesto = el total de la cotización (con su moneda y conversión ya congelada, tal como estaba en la cotización)
- Fase inicial: Descubrimiento (20%)
- Aparece de inmediato en su Portal, tanto en el Resumen como en "Todos tus proyectos"

Si el cliente **rechaza**, no se crea nada.

### 2. Comentarios en tareas

- **Admin/equipo**: dentro del modal de editar tarea, sección de comentarios abajo.
- **Cliente**: tocando cualquier tarea de "Actividad reciente" en su Resumen, se abre el detalle con los comentarios.
- Cualquiera puede borrar su propio comentario; el admin puede borrar cualquiera.

### 3. Proyectos en tarjetas horizontales (Portal)

"Todos tus proyectos" en el Resumen del cliente ahora es una fila de tarjetas que se desliza hacia el costado (con snap, como en cualquier app de celular) en vez de una lista vertical larga — ahorra espacio en pantallas chicas.

### 4. Documentos de la empresa (Portal → Mis datos)

Nueva tarjeta donde el cliente sube sus propios documentos (contratos, papeles impositivos, lo que sea) — separado de los archivos por proyecto, que son los que sube el estudio. Vos podés verlos y gestionarlos desde **Clientes** → ícono de carpeta en cada fila.

---

## Gastos recurrentes, MRR estimado y meta mensual en Finanzas

### Instalación

Importá **`pb-schema-gastos-recurrentes.json`** (Merge). Crea 1 colección nueva: `recurring_expenses`.

### 1. Gastos mensuales recurrentes

Sección nueva en Finanzas, arriba del listado de transacciones: cargás el concepto, el monto (en ARS/USD/MXN), el método de pago y **el día del mes** en que corresponde. Podés pausar uno sin borrarlo (el switch Activo/Pausado).

**Cómo se generan — importante que lo sepas**: no hay ningún proceso corriendo solo en tu servidor (seguimos el mismo criterio que con los vencimientos recurrentes). Cuando abrís Finanzas, el sistema revisa: para cada gasto recurrente activo, ¿ya se generó este mes? Si no, y si ya llegó su día del mes, se crea automáticamente como un egreso nuevo, fechado ese mismo día. Si no abrís la app justo ese día, se genera apenas la abras después — nunca se duplica ni se salta un mes.

### 2. Meta del mes — $4.000.000 ARS

Tarjeta con barra de progreso: cuánto llevás facturado este mes contra el objetivo. El número está fijo en el código por ahora (`MONTHLY_GOAL_ARS` en `Finanzas.jsx`) — si querés cambiarlo más adelante sin pedírmelo, buscá esa constante.

### 3. Ingresos recurrentes estimados (MRR)

Suma, mes a mes, lo que "debería" entrar según tus **proyectos ligados a un servicio recurrente** (mensual/trimestral/anual, normalizado a valor mensual). Tal como pediste, si el presupuesto de un proyecto está en dólares, se convierte con **la cotización de hoy** (no la que estaba congelada cuando se creó el proyecto) — es una proyección a valor actual, no un monto ya cobrado.

---

## Rediseño visual: Portal con carrusel 3D + Dashboard en mosaico

**Sin cambios de esquema** — solo código.

### Portal del cliente — Resumen reorganizado

Orden nuevo, tal como lo pediste:
1. **Solicitud al equipo** — arriba de todo, siempre visible.
2. **Carrusel 3D de proyectos** — efecto coverflow real con perspectiva CSS: el proyecto del centro queda de frente, los de al lado se inclinan y se atenúan. Tocás una tarjeta lateral para traerla al centro, tocás la del centro para abrirla.
3. **Facturas** — dos tarjetas grandes, pendientes y pagadas, cada una con su total y cantidad.
4. **Más herramientas** — grilla de accesos rápidos al final (Actividad, Cotizaciones, Vencimientos, Credenciales, Notificaciones), cada una con su contador si tiene algo pendiente.

### Pantalla completa al abrir un proyecto

Al tocar un proyecto del carrusel, ya no se abre un modal chico — se abre una **pantalla completa** con su propio fondo, header y 3 pestañas: **Resumen** (progreso, fase, descripción), **Archivos**, y **Tareas** (con comentarios, se puede expandir cada una ahí mismo).

### Dashboard del admin — mosaico real con Grid

Antes eran dos columnas fijas apiladas con flexbox. Ahora es una grilla real de 4 columnas que se reorganiza sola según el ancho:
- **Celular**: todo en una columna, en orden de lectura.
- **Tablet**: 2 columnas parejas.
- **Pantalla ancha**: la gráfica de ingresos ocupa 3/4 del ancho, el dólar cripto el resto arriba; proyectos y tareas se reparten abajo — aprovecha el espacio en vez de dejarlo vacío a los costados.

### Elevado en toda la app (por el efecto cascada)

Actualicé la tarjeta (`.card`) y los botones (`.btn-glass`, `.btn-ghost`) que se usan en **absolutamente todas** las pantallas — más profundidad, un filo de luz sutil arriba, transición más suave al pasar el mouse, y feedback táctil al tocar/hacer clic. Esto eleva la sensación general de todo el admin sin tener que reescribir cada página una por una.

### Honestidad sobre el alcance

Le puse profundidad real a lo que pediste explícitamente (Portal y Dashboard) y elevé los componentes compartidos para que se sienta en todos lados. **No reescribí individualmente cada página del admin** (Clientes, Proyectos, Finanzas, etc.) — ya heredan la mejora de las tarjetas y botones, pero si querés que le dé una pasada de diseño dedicada a alguna en particular, decime cuál te importa más y seguimos por ahí.

---

## Corrección de bugs reales: filas cortadas, ítems del cotizador rotos, arrastre del carrusel, error mejorado

**Sin cambios de esquema** — solo código.

### El bug de los nombres cortados a una letra (Proyectos, Cotizador)

Encontré la causa real: los componentes de fila (`Row`, `QuoteRow`) usaban `flex-wrap` esperando que el título pasara a otra línea si no entraba — pero el navegador prefiere achicar el texto casi a cero antes que envolver, cuando hay varios elementos de ancho fijo al lado (como el nuevo botón de fase). Reestructuré ambos componentes, y las filas de Finanzas, Tareas y Usuarios que tenían el mismo patrón: ahora el título/nombre siempre ocupa **su propia línea completa**, y los controles (precio, estado, botones) van en una segunda línea que sí puede envolver libremente sin robarle espacio al texto.

### Ítems del Cotizador rotos (imagen 1)

Encontré el bug exacto: el grid de 2 columnas no tenía definido cuántas columnas ocupaba cada campo, así que el navegador los repartía solo, de forma impredecible (por eso las cajitas vacías y el total flotando). Lo rehice con una estructura simple y previsible: descripción arriba, unidad/cantidad/costo en una fila de 3, subtotal abajo — siempre en el mismo orden, sin sorpresas.

### El carrusel ahora se mueve con el dedo

Agregué arrastre táctil real (`drag`) al carrusel 3D del Portal — antes solo se podía tocar los costados o las flechitas. Ahora deslizás con el dedo para pasar de un proyecto a otro, con inercia según la velocidad del gesto.

### El error "Cannot read properties of null" — corregido lo que encontré, y mejorado para la próxima

Encontré y corregí un bug real: al mandar un comentario en una tarea, si por algún motivo la sesión no estaba disponible en ese instante, el código intentaba leer `.id` de algo que podía ser `null`. Ya está blindado.

**Sé honesto**: sin el detalle técnico completo del error (solo tenía el mensaje, no la pila de componentes) no puedo garantizar al 100% que esa haya sido la única causa. Por eso mejoré el `ErrorBoundary`: si vuelve a pasar algo, ahora te va a mostrar **qué componente exacto** lo disparó, no solo el mensaje genérico. Si alguna vez lo ves de nuevo, mandame una captura de esa pantalla completa (con el recuadro violeta de abajo) y lo resuelvo al instante, sin adivinar.

---

## Login sin scroll, Proyectos en tarjetas con detalle completo, notificaciones que navegan

**Sin cambios de esquema** — solo código.

### 1. Login sin scroll fantasma

Usaba `min-h-screen` (100vh fijo), que en mobile queda más alto que el espacio real visible cuando el navegador tiene la barra de direcciones desplegada — eso generaba un scroll mínimo pero molesto. Cambiado a la altura dinámica real del viewport.

### 2. Proyectos ahora son tarjetas, no filas

Cada proyecto tiene su propia tarjeta con espacio de sobra: nombre completo (sin cortar), cliente, servicio, barra de progreso, fecha de entrega o vencimiento, y abajo el botón de fase + editar + eliminar. Nada compite por el mismo renglón.

### 3. Detalle completo al tocar la tarjeta

Tocar cualquier tarjeta (fuera de los botones de acción) abre la misma pantalla completa con pestañas que ya tenía el Portal del cliente, pero ahora también para vos: **Resumen** (progreso, fase, presupuesto), **Archivos** (podés subir/borrar), y **Tareas** — desde ahí podés **crear tareas nuevas ligadas al proyecto** directamente, sin salir de la pantalla, y comentarlas.

### 4. Notificaciones que te llevan al lugar correspondiente

Tocar una notificación ahora navega a donde corresponde según de qué se trate:
- Si es sobre una tarea → te lleva a Tareas (admin) o abre esa tarea con sus comentarios (Portal)
- Si es sobre un proyecto → te lleva a Proyectos (admin) o abre ese proyecto (Portal)
- Si es sobre una cotización → te lleva al Cotizador / pestaña Presupuestos
- Si es sobre un cliente → te lleva a Clientes (admin)

En el Portal, como ya tenías tareas y proyectos cargados en memoria, no hace ningún pedido extra al servidor — abre directo.

---

## Select escapando de las tarjetas, cierre de proyecto sin bloqueo, cotizador sin unidades, un proyecto por servicio

### Instalación

Importá **`pb-schema-quote-service-link.json`** (Merge). Agrega un solo campo (`service`) a `quote_lines`.

### 1. El menú desplegable ya no se corta detrás de la siguiente tarjeta

Causa técnica real: las tarjetas usan `backdrop-filter` (el efecto vidrio), y eso crea un "contexto de apilamiento" propio en CSS — el menú quedaba atrapado adentro de su tarjeta sin importar el z-index, y la tarjeta siguiente (que viene después en el HTML) siempre lo tapaba. Lo solucioné con un patrón estándar: el menú ahora se renderiza en un **portal** directo al final del documento, calculando su posición en pantalla — así escapa de cualquier tarjeta y siempre queda por encima de todo.

### 2. Abrir y cerrar un proyecto ya no bloquea los clics

La pantalla completa del proyecto tenía una animación de salida que la dejaba, por un instante, invisible pero todavía **capturando clics** mientras se desvanecía. Le saqué esa animación de cierre — ahora desaparece al instante, sin dejar nada bloqueando la pantalla.

### 3. Cotizador sin unidades

Saqué el campo "Unidad" de los ítems del Cotizador — ahora es solo descripción, cantidad y costo. (El campo sigue existiendo en la base por compatibilidad con cotizaciones viejas, pero ya no se pide ni se muestra en las nuevas.)

### 4. Un proyecto individual por cada servicio activo aprobado

Este es el cambio más importante: cuando armás una cotización agregando ítems **desde tu catálogo de Servicios**, cada ítem queda vinculado a ese servicio. Cuando el cliente la aprueba:

- Por **cada ítem que corresponda a un servicio que sigue activo** en tu catálogo, se crea **su propio proyecto individual** — con su propio presupuesto (el de esa línea, no el total de toda la cotización), y vinculado a ese servicio (así sigue funcionando todo lo de vencimientos recurrentes e ingresos estimados que ya tenías).
- Los **ítems sueltos** (los que escribiste a mano, sin venir del catálogo, o que corresponden a un servicio que ya desactivaste) **no generan ningún proyecto** — quedan solamente registrados en la cotización.
- Si una cotización tiene, por ejemplo, 3 servicios distintos y los 3 siguen activos, al aprobarla se crean **3 proyectos separados**, cada uno con su propia metodología, fase y seguimiento — tal como pediste, porque cada servicio tiene su propio precio y forma de pago.

Esto aplica solo a las cotizaciones que vos armás para tus clientes (no a las de marca blanca que arma un cliente para sus propios clientes, que no tienen ninguna relación con tu catálogo de servicios).

---

## Adjuntar propuesta, botones arriba, motivo de rechazo, contribución del cliente y cotizador separado

### Instalación

Importá **`pb-schema-propuesta-rechazo.json`** (Merge). Agrega 2 campos a `quotes`: `proposal_file` y `rejection_reason`.

### Diagnóstico rápido: por qué no llegan los emails

Revisé el `.env` del proyecto: las 4 variables de EmailJS (`VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID`, `VITE_EMAILJS_PUBLIC_KEY`, `VITE_ALERT_EMAIL`) están **vacías**. No es un bug — falta completar la configuración externa (cuenta en EmailJS, conectar tu Gmail, plantilla, y pegar esas 4 claves). Los pasos completos están en la sección "Notificaciones por Gmail" más arriba en este mismo README. Si ya las completaste y sigue sin llegar nada, revisá especialmente el paso de "Allowed origins" (dominio autorizado) — es la causa más común de fallos silenciosos.

### 1. Adjuntar una propuesta a la cotización

En el Cotizador (tuyo), nuevo campo para subir un PDF/Word/imagen con la propuesta completa. El cliente la ve con un botón "Ver propuesta" tanto arriba de la cotización como al lado del título.

### 2. Aprobar/Rechazar arriba de la cotización

Los movimos de abajo del todo a justo debajo del encabezado — se ven apenas se abre, sin tener que bajar.

### 3. Motivo de rechazo

Al tocar "Rechazar", se abre un cuadro pidiendo el motivo antes de confirmar — no se puede rechazar sin escribir algo. Ese motivo queda guardado y se muestra **debajo de la cotización correspondiente** en tu Cotizador, con un aviso en rojo bien visible.

### 4. El cliente puede sumar tareas y archivos dentro de sus proyectos

Antes, dentro del detalle de un proyecto en el Portal, el cliente solo podía ver tareas y descargar archivos. Ahora también puede **crear tareas nuevas** (quedan marcadas como "del cliente", igual que las solicitudes) y **subir sus propios archivos** al proyecto — vos las seguís viendo todas desde tu propio detalle del proyecto en el admin.

### 5. Cotizador propio separado de las cotizaciones de Mateo Estudio

Eran 3 pestañas mezcladas dentro de "Presupuestos". Ahora son dos cosas separadas y claras:
- **"Cotizaciones"**: lo que vos le mandás — pestaña propia, sin mezclar con nada más.
- **"Mi Cotizador"**: su propia herramienta de cotizar a sus clientes (antes "Presupuestos") — ahí solo están sus cotizaciones y su catálogo, nada tuyo de por medio.

### 6. Botón flotante para sumar cotización

Dentro de "Mi Cotizador", un botón circular con el signo "+" queda flotando abajo a la derecha todo el tiempo — un toque y arranca una cotización nueva, sin tener que buscar el botón en el medio de la pantalla.

---

## Contraseña de invitación en mobile + plantilla de cotización rediseñada

**Sin cambios de esquema** — solo código.

### 1. El paso de contraseña en la Alta de cliente

Encontré la causa: ese paso usaba un límite de pantalla distinto (`480px`) al que ya había estandarizado en el resto de la app (`640px`, el estándar `sm:` de Tailwind). En teléfonos de pantalla un poco más ancha (390-480px, bastante comunes), seguía mostrando los dos campos de contraseña lado a lado, aplastados. Unifiqué los 3 pasos de la Alta — y de paso encontré el mismo desajuste en 3 lugares más (Cotizador y dos formularios del Portal) y los corregí todos con el mismo criterio.

### 2. Plantilla de cotización rediseñada

Tomé la idea de la referencia (bloque de contacto destacado, tabla de ítems como barras oscuras, total en píldora) pero la rehice con los colores de tu marca — violeta a rosa, como el resto de la app — en vez de copiar la ilustración de la imagen (es arte de stock, con derechos de autor; no la reproduje, hice un diseño propio con la misma idea de estructura).

Qué incluye:
- Encabezado partido: tu logo + título grande "Presupuesto" a la izquierda, una tarjeta con degradé violeta-rosa con términos, método de pago y contacto a la derecha.
- **Código QR real** — pero solo aparece cuando hay un sitio web de verdad al que apuntar (el del cliente, en las cotizaciones de marca blanca). Preferí no mostrar un QR decorativo que no lleve a ningún lado.
- Cada ítem como su propia barra oscura (en vez de una tabla clásica), más parecido a la referencia.
- Total en una píldora con el degradé de marca, bien visible al final.

Se ve igual tanto en pantalla como al imprimir/descargar en PDF.

---

## El bug de verdad: el Service Worker estaba sirviendo versiones viejas

**Sin cambios de esquema** — solo código.

### La causa real de "el arreglo no se nota"

El Service Worker de la PWA (instalado en la v18) usaba una estrategia "caché primero": si ya tenías algo guardado en el celular, te lo mostraba **al instante tal como estaba**, y recién en segundo plano pedía la versión nueva para la *próxima* vez. Resultado: cada corrección que subía después de eso podía tardar una o más visitas en notarse — o directamente no notarse nunca si la pestaña se queda abierta mucho tiempo (como pasa seguido en el celular).

Lo di vuelta a **"red primero"**: ahora la app siempre pide la versión más nueva primero, y el caché queda solo como respaldo para cuando no hay conexión. También subí la versión del caché para forzar que se borre cualquier cosa vieja que haya quedado guardada.

**Un paso único después de este despliegue**: como el Service Worker viejo puede seguir controlando la pestaña que ya tenías abierta, hacé **un refresco manual completo** (o cerrá del todo la app/PWA y volvela a abrir) una sola vez después de este deploy. De ahí en adelante, cada actualización futura se va a ver sola, sin este problema.

### Además, blindé el paso de contraseña

Más allá de la causa raíz, dejé el paso de contraseña de la Alta de cliente **sin ningún breakpoint responsivo** — ahora es una sola columna siempre, sin excepciones, para que sea imposible que un problema de caché (o cualquier otra cosa) lo vuelva a mostrar mal.

---

## Adjuntar archivos, logo único, colores en modales, y gráfico de tareas

### Instalación

Importá **`pb-schema-permisos-cliente.json`** (Merge). No agrega colecciones nuevas — corrige 2 permisos: que el cliente pueda subir archivos a su proyecto, y que pueda editar las tareas de su proyecto.

### 1. El error al adjuntar un archivo

Causa real encontrada: el permiso de la base (`project_files`) nunca se actualizó cuando habilité la subida para el cliente hace unas entregas — le daba el botón en la app, pero PocketBase seguía rechazando la petición. Ya corregido. De paso, ajusté quién puede **borrar** cada archivo: admin/equipo pueden borrar cualquiera, pero un cliente solo puede borrar los que subió él mismo (no los que subiste vos).

### 2. Logo único para toda la app

Agregué `public/logo.png` (por ahora con el mismo monograma violeta de siempre, como placeholder) y un componente `Logo` que se usa en **todos** los lugares donde aparecía el ícono de la marca: pantalla de inicio de sesión, menú lateral, encabezado del Portal, alta de clientes, aviso de instalación de la app, y las cotizaciones que emitís vos.

**Para poner tu logo real**: reemplazá el archivo `public/logo.png` por el tuyo (cuadrado, fondo transparente si es posible, mínimo 512×512px) y volvé a compilar — no hace falta tocar ni una línea de código, se actualiza solo en todos los lugares a la vez.

*Nota: los íconos de la PWA (el que queda en la pantalla de inicio del celular al instalarla) son archivos aparte, ya generados — si más adelante querés que también salgan de tu logo nuevo, decímelo y los regenero.*

### 3. Más color en las etiquetas de los campos

Las etiquetas de los inputs (el textito chico arriba de cada campo, como "NOMBRE", "CONTRASEÑA", etc.) pasaron de un violeta apagado a un degradé violeta-rosa bien vivo. Como es una sola clase compartida, se ve así en **todos** los formularios y modales de la app sin haber tocado cada uno por separado.

### 4. Gráfico de estado de tareas + edición del cliente

Dentro de cualquier proyecto (Portal y admin) → pestaña Tareas:
- Arriba, un donut con la cantidad y el porcentaje de tareas pendientes / en progreso / completadas.
- Cada tarea se puede **editar** (título, descripción y estado) tocando "✎ Editar tarea" al expandirla — tanto vos como el cliente, dentro de su propio proyecto.

---

## Por qué no se veía el logo nuevo

**Sin cambios de esquema** — solo código.

Dos causas posibles, y ahora las dos están cubiertas:

1. **`public/logo.png` necesita un `npm run build` para copiarse** a lo que se despliega — si lo reemplazaste pero no volviste a compilar, seguía viéndose el viejo.
2. **Caché del navegador en la imagen** (esto es distinto del Service Worker que ya arreglamos): como el archivo siempre se llama `logo.png`, el navegador puede quedarse con la versión vieja guardada aunque el servidor ya tenga la nueva — es el mismo tipo de problema, pero a nivel de imagen, no de la app entera.

Ya lo resolví de raíz: cada vez que compilás (`npm run build`), el logo ahora se pide con una marca de tiempo en la URL (`/logo.png?v=...`) que cambia en cada build — así el navegador jamás lo confunde con una versión anterior, sin que tengas que hacer nada manual.

**Para aplicar:** reemplazá `public/logo.png` por tu logo real (si no lo hiciste todavía), `npm run build`, desplegar. Con esto ya no debería hacer falta ningún refresco especial.

---

## Roles y permisos: proyectos asignados, equipo acotado, y el nuevo rol Colaborador

### ⚠️ Dos pasos obligatorios antes de que esto funcione

**1. Importar el esquema** — `pb-schema-roles-asignacion.json` (Merge). Agrega `assigned_to` a proyectos, `collaborator` a clientes, y reescribe los permisos de 6 colecciones.

**2. Paso manual — agregar el rol nuevo** (no se puede hacer por import, es la colección de autenticación):
1. PocketBase → **Collections → users → Fields**
2. Abrí el campo **`role`**
3. En "Select values", agregá una línea nueva: **`colaborador`**
4. Guardá

Sin este paso, no vas a poder crear cuentas de colaborador — el sistema va a rechazar ese valor.

### Qué cambió

**Proyectos asignados**: cada proyecto ahora tiene un campo "Asignar a" (solo vos lo ves/editás). Un usuario de equipo **solo ve los proyectos que tiene asignados** — ni un cliente ni un proyecto más.

**Equipo acotado a 3 módulos**: en el menú, un usuario de equipo ahora solo ve **Proyectos, Tareas y Calendario**. Todo lo demás (Clientes, Finanzas, Servicios, Cotizador, Usuarios, Notificaciones, Reportes, Historial, y el Dashboard) desaparece del menú — y si intenta entrar por la URL directa, lo mandamos de vuelta a Proyectos. Tampoco ve el presupuesto de los proyectos, ni las facturas en el Calendario: eso quedó exclusivo para admin.

**Rol nuevo: Colaborador** — pensado para alguien que trabaja para uno de tus clientes (no es tu empleado) y necesita entrar con su propio usuario, pero **solo al portal de ese cliente puntual**, nada más. Se crea igual que un miembro de equipo (Usuarios → Agregar al equipo), eligiendo el rol "Colaborador de un cliente" y el cliente correspondiente.

### Tareas: prioridad, asignación, animación y aviso

Dentro de cualquier proyecto → pestaña Tareas, al crear una tarea nueva ahora se puede:
- Elegir la **prioridad** (baja/media/alta/urgente)
- **Asignarla a alguien del equipo**
- Al crearla, aparece una **animación de confirmación** llamativa
- Se **notifica automáticamente** a la persona asignada y a todos los admin

### Honestidad sobre el alcance de "Colaborador"

Le di el mismo trato que al dueño de la cuenta del cliente en lo más usado del Portal: ver/editar su ficha, sus proyectos, sus tareas, subir archivos y documentos, comentar tareas. **No llegué a extender esa paridad al Cotizador** (`quotes`, `quote_items`) — si un colaborador necesita aprobar cotizaciones o usar el cotizador propio del cliente, esa parte todavía no lo reconoce y puede fallarle. Si lo necesitás, decímelo y lo sumo en la próxima vuelta — es aplicar el mismo patrón (`|| client.collaborator = @request.auth.id`) a esas dos colecciones.

---

## El logo ahora vive en `public/img/logo.png`

**Sin cambios de esquema** — solo código.

Actualicé el componente `Logo` para que apunte a `public/img/logo.png` en vez de `public/logo.png`.

**Importante — dónde tiene que estar el archivo**: en un proyecto Vite, solo se sirven en la web los archivos que están **dentro de la carpeta `public/`**. Si la carpeta `img` que creaste no está dentro de `public/` (por ejemplo, si quedó en la raíz del proyecto, al lado de `package.json`), el navegador no va a poder acceder a ella y el logo no se va a ver.

**Ruta correcta**: `public/img/logo.png`

Si tu carpeta `img` quedó en otro lugar, simplemente movela para que quede dentro de `public/`. El resto (que se vea en toda la app, que no se quede pegada la versión vieja en caché) ya está resuelto de antes y sigue funcionando igual.

---

## Planificador semanal de contenido (para proyectos de Manejo de Redes)

### Instalación

Importá **`pb-schema-planificador-redes.json`** (Merge). Crea 2 colecciones nuevas: `content_plans` (las tarjetas de semana) y `content_posts` (cada publicación).

### Cómo se activa

La pestaña **"Planificador"** aparece automáticamente dentro de un proyecto cuando el **servicio vinculado** a ese proyecto tiene la palabra "red" en su nombre o categoría (por ejemplo "Manejo de Redes Sociales", "Redes"). Si tenés un servicio así en tu catálogo y lo asignás al proyecto, la pestaña aparece sola — no hace falta nada más.

*Si tu servicio se llama distinto y la pestaña no aparece, decime el nombre exacto y ajusto la detección.*

### Cómo funciona

**Vos (admin/equipo):**
1. Adentro del proyecto → pestaña Planificador → "Nueva semana": le ponés un nombre y elegís el primer día — se arma la tarjeta con los 7 días.
2. Tocás cualquier día vacío para cargar una publicación: **título, copy, hashtags, imagen con vista previa antes de subir**.
3. Podés guardarla como borrador, o mandarla directo con **"Enviar para aprobación"**.

**El cliente, en su Portal:**
- Ve la misma tarjeta semanal. Los días con contenido muestran la miniatura y el estado (esperando aprobación / aprobado / rechazado).
- Al tocar una publicación que le mandaste, le aparecen los botones **Aprobar / Rechazar**.
- Si rechaza, se abre un cuadro pidiendo el motivo — no puede rechazar sin explicar por qué.
- Esa publicación rechazada queda con el motivo bien visible; vos la editás y volvés a mandarla con el mismo botón "Enviar para aprobación" cuando esté lista.

Como siempre, te avisamos por notificación cuando el cliente aprueba o rechaza algo.

---

## Corrección: planificador semanal no dejaba crear (400) + bug real en el Service Worker

### ⚠️ Hay que reimportar el esquema del planificador

Este archivo **reemplaza por completo** el `pb-schema-planificador-redes.json` de antes (incluso la versión corregida sin `collaborator`). Importalo de nuevo con Merge — va a pedir confirmar el borrado de las reglas viejas de `content_plans`/`content_posts`, es esperado.

### Causa real del error al crear una semana

Las reglas de permisos que armé encadenaban demasiados saltos de relación (`publicación → semana → proyecto → cliente → usuario`, 4 niveles) — PocketBase no lo tolera bien y devuelve error 400 en vez de simplemente permitir o denegar. Lo solucioné agregando el **cliente directo** en cada semana (en vez de tener que "subir" por el proyecto para encontrarlo) — el mismo patrón de 2 saltos que ya usamos con éxito en el resto de la app (cotizaciones, tareas, etc.).

### Bug real encontrado en el Service Worker

Cuando la red fallaba y no había nada guardado en caché todavía para ese pedido en particular, el Service Worker devolvía "nada" en vez de una respuesta válida — eso es lo que decía el error "Failed to convert value to Response", y podía dejar la pestaña sin poder cargar nada más. Ya está corregido: ahora siempre devuelve algo válido, haya red o no.

### Para aplicar

1. Importá el `pb-schema-planificador-redes.json` de este mensaje (Merge, confirmando el reemplazo de reglas)
2. `npm install && npm run build`
3. Desplegar como siempre
4. El paso de siempre: cerrá del todo la app una vez y volvela a abrir, para que el Service Worker corregido tome control
