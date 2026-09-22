# Agente Mateo Estudio

Servicio Node que corre 24/7 al lado de PocketBase y hace tres cosas:

1. **Bot de Telegram** — le escribís y te responde estados, crea/actualiza tareas, marca facturas
   pagadas, etc. Con comandos (`/tareas`, `/resumen`...) y opcionalmente en lenguaje natural.
2. **Emails automáticos** — resumen diario (días hábiles), resumen semanal (lunes), y alerta cuando
   hay tareas o facturas vencidas.
3. **Alertas por Telegram** — lo mismo que el email, pero directo a tu chat.

No crea colecciones nuevas en PocketBase: lee y escribe sobre `tasks`, `projects`, `clients`,
`invoices`, `transactions` y `notifications`, que ya existen en el dashboard.

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
PB_ADMIN_EMAIL=fernandomateo23@gmail.com
PB_ADMIN_PASSWORD=tu_contraseña_de_admin
```

## 4. (Opcional) Activar el modo lenguaje natural

Sin esto, el bot funciona igual pero solo entiende comandos `/`. Con una API key de Anthropic
(https://console.anthropic.com), además le podés escribir en texto libre y el agente decide qué
consultar o qué proponer crear/modificar (siempre pide confirmación antes de escribir nada):
```
ANTHROPIC_API_KEY=sk-ant-...
```

## 5. Probarlo local antes de subirlo al VPS

```bash
cd agent-service
cp .env.example .env   # y completá los valores de arriba
npm install
npm start
```

Escribile a tu bot en Telegram. Si tu chat_id todavía no está en `TELEGRAM_ALLOWED_CHAT_IDS`, el
bot te va a contestar con tu chat_id exacto para que lo copies al `.env`.

## 6. Desplegarlo en el VPS (junto a PocketBase)

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
```

## Notificaciones al teléfono (reenvío por Telegram)

Cada ~20s (`NOTIFY_PHONE_POLL_MS`), el agente revisa la colección `notifications` del dashboard
(la misma que alimenta la campanita) buscando avisos nuevos dirigidos al usuario admin y sin
reenviar todavía, y te los manda por Telegram apenas aparecen — así te enterás en el momento,
no solo con el resumen diario/semanal. Usa un campo nuevo `telegram_sent` en `notifications`
para no repetir un aviso ya mandado (ver `pb-schema-notif-telegram.json` en la raíz del repo:
hay que importarlo una vez en el panel de PocketBase, `Configuración → Importar colecciones`).
No es push real de navegador (eso necesitaría VAPID + service worker aparte) — es un reenvío al
bot, pero llega igual de rápido al teléfono porque el bot ya está probado y funcionando.

## Generador de propuestas con IA

El módulo "Propuestas" del dashboard (`/app/propuestas`) arma una propuesta comercial completa
con un click: Fer completa el objetivo del cliente, elige servicios del catálogo, tono y moneda,
y el agente (cada ~15s, `PROPOSAL_POLL_MS`) toma esa solicitud, arma un prompt con la info real
del estudio + el catálogo + los datos cargados, y le pide al mismo proveedor de IA que ya usa el
bot (Anthropic > Groq > Gemini) que redacte la propuesta completa en JSON estructurado. El
dashboard la muestra con un diseño premium (hero, servicios, timeline, cierre), y apenas está
lista se manda un aviso por Telegram con el link para verla. Usa una colección nueva `proposals`
(no había ninguna existente que sirviera para esto — se evaluó reusar `quotes`, pero esa es para
presupuestos con ítems y totales, no para propuestas narrativas) — hay que importar
`pb-schema-propuestas.json` (raíz del repo) una vez en el panel de PocketBase.

Las "Instrucciones adicionales" que cargues en el módulo "Herramienta IA" del dashboard (colección
`ai_settings`) ahora también se usan acá, además de en el bot de Telegram — así tenés un solo
lugar para ajustarle el tono/criterio a la IA del estudio en general.

## Seguridad

- Solo los `chat_id` en `TELEGRAM_ALLOWED_CHAT_IDS` pueden usar el bot — cualquier otro mensaje se
  ignora (y queda logueado).
- Ninguna acción que modifique datos (crear tarea, cambiar estado, marcar factura pagada) se
  ejecuta sin que vos confirmes explícitamente ("sí") cuando viene del modo lenguaje natural.
- El `.env` con las credenciales reales nunca se sube al repo (está en `.gitignore`).

## WhatsApp (no incluido todavía)

Arrancamos por Telegram porque es gratis e inmediato. Si más adelante querés sumar WhatsApp, el
camino es la API de WhatsApp Business (vía Meta directo o un proveedor como Twilio/360dialog) —
tiene aprobación y costo por conversación, así que conviene evaluarlo aparte cuando este primer
agente ya esté probado en uso real.
