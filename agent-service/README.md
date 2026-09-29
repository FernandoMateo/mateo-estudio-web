# Agente Mateo Estudio

Servicio Node que corre 24/7 al lado de PocketBase. Es un equipo de agentes, cada uno con su
rol, todos coordinados por **Fabian** (el orquestador) y visibles/administrables desde el
módulo **Agentes** del dashboard (`/app/agentes`) o con `/agentes` en Telegram:

| Agente | Rol |
|---|---|
| **Toto** | Asistente general: bot de Telegram (comandos + lenguaje natural), resúmenes y emails automáticos. Siempre activo. |
| **Renzo** | Detecta clientes sin actividad reciente y avisa para retomar el contacto. |
| **Facundo** | Avisa facturas por vencer ANTES del vencimiento (recordatorio preventivo de cobranza). |
| **Bruno** | Detecta tareas del Kanban estancadas (sin moverse hace días) y avisa al responsable. |
| **Nahuel** | Prospección de clientes nuevos en Google Maps (Miami, Ciudad de México, Panamá), priorizando negocios sin sitio web. |
| **Lautaro** | Arma propuestas comerciales "innovadoras" (diseño poco convencional, tono de cerrador de ventas) a partir de una nota de voz por Telegram. |
| **Fabian** | Orquesta a todos: los registra, guarda su estado y te deja pausarlos/reanudarlos. Siempre activo. |

No crea colecciones nuevas para lo que ya existía: sigue leyendo y escribiendo sobre `tasks`,
`projects`, `clients`, `invoices`, `transactions`, `notifications`, `services` y `users`. Para
lo nuevo sí hacen falta 2 colecciones (`agents`, `leads`) y unos campos nuevos en `proposals` —
ver "Colecciones a importar" más abajo.

## 1. Configurar Telegram

1. Hablale a **@BotFather** en Telegram → `/newbot` → elegí un nombre (ej. "Mateo Estudio Agente")
   y un usuario que termine en `bot` (ej. `mateoestudio_agente_bot`).
2. Te da un **token** — copialo.
3. Hablale a **@userinfobot** para que te diga tu `chat_id` numérico (el tuyo, para que solo vos
   puedas usarlo).
4. Completá en `.env`:
   ```
   TELEGRAM_BOT_TOKEN=el_token_de_botfather
   TELEGRAM_ALLOWED_CHAT_IDS=tu_chat_id
   ```
   Si en algún momento sumás a alguien del equipo, agregá su chat_id separado por coma.

## 2. Configurar el email (Gmail)

1. Activá verificación en 2 pasos en la cuenta `fernandomateo23@gmail.com` (si no la tenés ya).
2. Andá a https://myaccount.google.com/apppasswords y generá una "contraseña de aplicación".
3. Completá en `.env`:
   ```
   GMAIL_USER=fernandomateo23@gmail.com
   GMAIL_APP_PASSWORD=la_contraseña_de_16_caracteres
   ALERT_EMAIL_TO=fernandomateo23@gmail.com
   ```

Esto es independiente del EmailJS que ya tenés stubbeado en el frontend (`.env` del dashboard) —
ese es para avisos disparados desde el navegador; este es para lo que corre en el servidor.

## 3. Configurar PocketBase

Usá el mismo superusuario con el que entrás a `/_/`:
```
PB_URL=https://pocketbase-d4iq.srv1851703.hstgr.cloud
PB_ADMIN_EMAIL=tu_admin_real_de_pocketbase
PB_ADMIN_PASSWORD=tu_contraseña_de_admin
```

## 4. (Opcional) Activar el modo lenguaje natural

Sin esto, el bot funciona igual pero solo entiende comandos `/`. Con una API key de Anthropic
(https://console.anthropic.com), además le podés escribir en texto libre y el agente decide qué
consultar o qué proponer crear/modificar (siempre pide confirmación antes de escribir nada):
```
ANTHROPIC_API_KEY=sk-ant-...
```

## 5. Colecciones a importar en PocketBase

Cada uno de estos archivos vive en la raíz del repo. Se importan una sola vez desde el panel de
PocketBase, `Configuración → Importar colecciones` (subís el `.json` y confirmás):

- `pb-schema-notif-telegram.json` — notificaciones al teléfono (ya la tenías pendiente).
- `pb-schema-propuestas.json` — módulo Propuestas estándar (ya la tenías pendiente).
- **`pb-schema-agents.json`** (nuevo) — registro de los 7 agentes (Fabian). Sin esto, los agentes
  siguen corriendo igual (nunca se bloquean por esto) pero no vas a poder verlos ni pausarlos
  desde el dashboard ni con `/agentes`.
- **`pb-schema-leads.json`** (nuevo) — donde Nahuel guarda los prospectos que encuentra en
  Google Maps. Sin esto, Nahuel no tiene dónde guardar lo que encuentra.
- **`pb-schema-proposals-lautaro.json`** (nuevo) — agrega a la colección `proposals` que ya
  existe los campos que usa Lautaro (`style`, `source`, `audio_transcript`, `branding_colors`,
  `branding_fonts`, `branding_notes`). Importalo aunque `proposals` ya exista: PocketBase
  actualiza la colección existente (mismo id) sumando los campos nuevos, no borra nada de lo
  que ya tenías.

## 6. (Nuevo) Google Maps para Nahuel

1. Entrá a https://console.cloud.google.com, creá (o usá) un proyecto, y activale facturación
   (hace falta tarjeta cargada — Google da uso gratis mensual para Places API, pero el proyecto
   tiene que tener facturación habilitada igual).
2. En ese proyecto, `APIs y servicios → Habilitar APIs` → buscá y habilitá **"Places API"**.
3. `Credenciales → Crear credenciales → Clave de API` — copiala.
4. Completá en `.env`:
   ```
   GOOGLE_MAPS_API_KEY=la_key_de_google
   ```
Sin esta key, Nahuel queda pausado solo (avisa el motivo en el panel de Agentes) — el resto del
sistema sigue funcionando normal. Los rubros y ciudades que busca son configurables por
`NAHUEL_CITIES` / `NAHUEL_CATEGORIES` en el `.env` — la lista que viene por defecto es un punto
de partida genérico, ajustala a lo que mejor te convierta.

## 7. Probarlo local antes de subirlo al VPS

```bash
cd agent-service
cp .env.example .env   # y completá los valores de arriba
npm install
npm start
```

Escribile a tu bot en Telegram. Si tu chat_id todavía no está en `TELEGRAM_ALLOWED_CHAT_IDS`, el
bot te va a contestar con tu chat_id exacto para que lo copies al `.env`.

## 8. Desplegarlo en el VPS (junto a PocketBase)

Mismo patrón que ya usás para el dashboard: subís la carpeta al VPS y la corrés con Docker.

```bash
# desde tu compu, subí la carpeta agent-service al VPS (ajustá la ruta destino)
scp -r agent-service usuario@179.197.238.20:/ruta/donde/tenes/tu/stack/

# en el VPS
ssh usuario@179.197.238.20
cd /ruta/donde/tenes/tu/stack/agent-service
cp .env.example .env && nano .env   # completá los valores reales ahí, NUNCA los subas al repo
docker build -t mateo-estudio-agent .
docker run -d --name mateo-estudio-agent --restart unless-stopped --env-file .env mateo-estudio-agent
```

Si preferís sumarlo a tu `docker-compose.yml` existente (recomendado para que reinicie junto con
todo lo demás), mirá `docker-compose.snippet.yml` — es el bloque para pegar en tu compose real.

Para ver logs en vivo: `docker logs -f mateo-estudio-agent`.

## Comandos de Telegram

```
/tareas               tus tareas pendientes
/tareas todas          todas las tareas
/vencidas              tareas y facturas vencidas
/facturas [estado]     enviada, pagada, vencida, borrador
/pagar <número>        marca una factura como pagada
/proyecto <nombre>     estado de un proyecto
/cliente <nombre>      resumen de un cliente
/resumen               resumen del día
/resumen semana        resumen semanal
/crear tarea <título> | proyecto: X | responsable: Y | fecha: YYYY-MM-DD | prioridad: alta
/agentes               estado de todo el equipo (Toto, Renzo, Facundo, Bruno, Nahuel, Lautaro, Fabian)
/pausar <agente>       pausa un agente, ej. /pausar renzo
/reanudar <agente>     lo vuelve a activar
/prospectar            manda a Nahuel a buscar leads en Google Maps ahora mismo
/actualizar            refresca lo que el agente sabe del sistema
/reiniciar             borra el contexto de la charla actual
```

## Renzo, Facundo y Bruno (agentes proactivos diarios)

Corren de lunes a viernes a la mañana (horarios configurables por `.env`, ver arriba) y solo
avisan por Telegram cuando encuentran algo — no generan ruido si no hay nada que reportar. Los
tres son de solo lectura: nunca crean, modifican ni borran nada de negocio.

- **Renzo** cruza `clients` contra `projects`/`invoices`: si un cliente no tiene ningún proyecto
  activo (o en etapa de propuesta) ni factura reciente, lo marca como inactivo pasados
  `RENZO_INACTIVE_DAYS` días (45 por defecto).
- **Facundo** revisa las facturas con estado "enviada" y avisa las que vencen dentro de
  `FACUNDO_DUE_SOON_DAYS` días (3 por defecto) — antes de que se conviertan en vencidas.
- **Bruno** revisa las tareas no completadas y avisa las que no cambiaron de estado hace
  `BRUNO_STALLED_DAYS` días (5 por defecto), con quién es el responsable.

Los tres se pueden pausar/reanudar individualmente desde el panel de Agentes del dashboard o con
`/pausar` y `/reanudar` en Telegram, sin tocar código ni redeployar.

## Nahuel (prospección en Google Maps)

Corre una vez por semana (lunes 10:00 por defecto, `NAHUEL_CRON`) — o al toque con `/prospectar`
en Telegram. Cada corrida busca una combinación de ciudad + rubro (rota sola por las que
configuraste en `NAHUEL_CITIES`/`NAHUEL_CATEGORIES`), trae hasta `NAHUEL_MAX_RESULTS` resultados
nuevos de Google Places, y por cada uno consulta si tiene sitio web cargado — los que NO tienen
quedan marcados (🔴 en el aviso de Telegram) porque son el perfil de cliente más fácil de cerrar
para un estudio de desarrollo web. Todo se guarda en la colección `leads` (nunca toca `clients`)
para que puedas revisar y convertir manualmente los que te sirvan.

## Lautaro (propuestas innovadoras por audio)

Mandale una nota de voz al bot pidiendo algo como *"armame una propuesta innovadora para tal
cliente, necesita..."* — el agente la transcribe (mismo Whisper de Groq que ya usás), reconoce
que es un pedido para Lautaro, y te pide confirmación antes de crear la propuesta. A diferencia
del flujo estándar del dashboard, Lautaro redacta con un system prompt de "cerrador de ventas
experto" y un enfoque de diseño deliberadamente poco convencional. Si en el dashboard ya
cargaste la identidad visual del cliente (colores, tipografías, notas — campos
`branding_colors`/`branding_fonts`/`branding_notes` en `proposals`, a completar cuando quieras
desde el módulo Propuestas o directamente en PocketBase), Lautaro la usa para alinear el tono;
si no, avisa en el cierre de la propuesta que falta definir el branding. El aviso de "propuesta
lista" en Telegram viene firmado por Lautaro para diferenciarla de las estándar.

## Notificaciones al teléfono (reenvío por Telegram)

Cada ~20s (`NOTIFY_PHONE_POLL_MS`), el agente revisa la colección `notifications` del dashboard
(la misma que alimenta la campanita) buscando avisos nuevos dirigidos al usuario admin y sin
reenviar todavía, y te los manda por Telegram apenas aparecen — así te enterás en el momento,
no solo con el resumen diario/semanal. Usa un campo `telegram_sent` en `notifications` para no
repetir un aviso ya mandado (`pb-schema-notif-telegram.json`).

## Generador de propuestas con IA (estándar)

El módulo "Propuestas" del dashboard (`/app/propuestas`) arma una propuesta comercial completa
con un click: Fer completa el objetivo del cliente, elige servicios del catálogo, tono y moneda,
y el agente (cada ~15s, `PROPOSAL_POLL_MS`) toma esa solicitud, arma un prompt con la info real
del estudio + el catálogo + los datos cargados, y le pide al mismo proveedor de IA que ya usa el
bot (Anthropic > Groq > Gemini) que redacte la propuesta completa en JSON estructurado. El
dashboard la muestra con un diseño premium (hero, servicios, timeline, cierre), y apenas está
lista se manda un aviso por Telegram con el link para verla.

Las "Instrucciones adicionales" que cargues en el módulo "Herramienta IA" del dashboard (colección
`ai_settings`) se usan tanto acá como en el bot de Telegram y en Lautaro — un solo lugar para
ajustarle el tono/criterio a la IA del estudio en general.

## Panel de Agentes (dashboard)

`/app/agentes` muestra los 7 agentes con su rol, horario, último resultado y un switch para
pausar/reanudar los que no son núcleo (Toto y Fabian están siempre activos). Se alimenta de la
colección `agents` — si todavía no la importaste, la página avisa que no hay agentes registrados
y se completa sola apenas el servicio arranca con la colección ya importada.

## Seguridad

- Solo los `chat_id` en `TELEGRAM_ALLOWED_CHAT_IDS` pueden usar el bot — cualquier otro mensaje se
  ignora (y queda logueado).
- Ninguna acción que modifique datos (crear tarea, cambiar estado, marcar factura pagada, crear
  una propuesta) se ejecuta sin que vos confirmes explícitamente ("sí") cuando viene del modo
  lenguaje natural. Renzo, Facundo y Bruno son de solo lectura — nunca escriben nada.
- El `.env` con las credenciales reales nunca se sube al repo (está en `.gitignore`).

## WhatsApp (no incluido todavía)

Arrancamos por Telegram porque es gratis e inmediato. Si más adelante querés sumar WhatsApp, el
camino es la API de WhatsApp Business (vía Meta directo o un proveedor como Twilio/360dialog) —
tiene aprobación y costo por conversación, así que conviene evaluarlo aparte cuando este primer
agente ya esté probado en uso real.
