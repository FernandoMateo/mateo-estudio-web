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
