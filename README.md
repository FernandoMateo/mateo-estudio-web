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
