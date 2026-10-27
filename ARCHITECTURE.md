# ARCHITECTURE.md — Mapa de convergencia de SeeControl

Este documento explica **dónde vive cada cosa** y, sobre todo, **qué archivos hay que tocar
juntos** cuando se ajusta el backend o el frontend, para que un cambio no quede a medias. Es
la referencia para mantener backend y frontend sincronizados.

> Guía de setup y arranque: ver `start.md`.
> Convenciones de trabajo (git, límites, IA): ver `AGENTS.md`.

---

## 1. Panorama general

```
Usuario ─▶ Frontend (React+Vite, :5173)
             │  REST /api/*   +  WebSocket /ws/*
             ▼
          Backend (FastAPI, :8000)
             │
   ┌─────────┼───────────────┬──────────────┬───────────────┐
   ▼         ▼               ▼              ▼               ▼
 SQLite/   LLM service    WebSocket mgr   Seed inicial   Orquestación
 Postgres  (proveedores)  (tiempo real)   (admin+agentes) + Delegación
             │                                              │
             ▼                                              ▼
   Proveedores LLM (Groq, Mistral, Vercel, OpenRouter,   Artefactos en disco
   NVIDIA, Cloudflare, Gemini, …)                        backend/_workspace/<project>/
```

- **Frontend**: SPA con React Router. Todo el estado vivo converge en un único hook:
  `frontend/src/hooks/useLiveOffice.ts`.
- **Backend**: FastAPI. El punto de arranque y orquestación de servicios es
  `backend/app/main.py` (lifespan).
- **BYOK real**: las API keys viven en `backend/.env` (primera siembra) y/o se gestionan
  desde la UI (`/proveedores`), persistidas en la DB como `ProviderCredential`. La ejecución
  real de modelos usa la **key efectiva** (override de UI con prioridad, `.env` de respaldo).
- **Orquestación multi-agente**: el agente "boss" descompone una petición de generación de
  código, delega subtareas a agentes especializados (pixel, max), cada uno deja su devolución
  en una **carpeta de artefactos por proyecto**, y boss ensambla el entregable final.

---

## 2. Puntos de convergencia (dónde "se juntan" las cosas)

| Concepto | Backend (fuente de verdad) | Frontend (consumo) |
|---|---|---|
| Estado vivo de agentes/tareas | `GET /api/agents/`, `GET /api/tasks/` | `useLiveOffice.ts` (sync inicial + polling 6s en PROD + polling ligero de tareas en DEMO + `refreshTasksFromBackend` tras una misión) |
| Detección de proveedor → modo | `GET /api/agents/providers` | `useLiveOffice.ts` `providersReady`: si hay ≥1 habilitado fuerza `mode='prod'`; `App.tsx` oculta el selector DEMO |
| Chat / ping a un agente | `POST /api/agents/{id}/ping` → `llm_service.chat_effective()` | `api.ts pingAgent()` usado por `sendAgentMessage`, `followUpDoc`, y `sendChat` (ruta no-código) |
| **Orquestación/Delegación** | `POST /api/agents/orchestrate/code` → `delegation_service.generate_code()` | `api.ts orchestrateCode()` usado por `sendChat` (ruta código) |
| **Agrupación por proyecto** | columnas `project_id/project_name/project_brief/role_label` en `tasks` | `useLiveOffice` mapea a `projectId/projectName/projectBrief/roleLabel`; Kanban y Oficina agrupan por `projectId` |
| **Artefactos de agentes** | `services/artifacts.py` → `backend/_workspace/<project_id>/` | lista expuesta en la respuesta de `orchestrate/code` y en `result_data` de la tarea ENTREGA |
| Proveedores LLM y llaves | `config/settings.py` + `config/llm.py` + `.env` + `ProviderCredential` | catálogo vía `GET /api/agents/providers` (`useProviders.ts`) + panel BYOK |
| Importar skills (SKILL.md) | `POST /api/skills/import` (descarga server-side, sin CORS) | `api.ts importSkillFromUrl()` usado por `SkillsPanel.tsx` |
| Agentes por defecto (ROSTER) | `services/seed.py` (siembra en DB) | `data/demo.ts` ROSTER (nombres deben coincidir) |
| Vínculo front↔backend de un agente | el agente existe en DB con el mismo **nombre** | `useLiveOffice` asigna `backendId` haciendo match por nombre |
| Tiempo real | `config/websocket.py` emite eventos | `api.ts connectOfficeWS` (feed) + polling para estado |

**Regla de oro del vínculo:** un agente del frontend solo puede ejecutar modelos reales
si tiene `backendId`. Ese `backendId` se asigna cuando existe en la DB un agente con el
**mismo nombre** (case-insensitive). Por eso el seed (`services/seed.py`) crea el ROSTER:
sin seed, los agentes quedan "locales" y el chat responde "agente local sin backend".

---

## 3. Orquestación y delegación (flujo central)

El corazón de SeeControl: convertir una petición en lenguaje natural en un entregable de
código completo, repartiendo el trabajo entre agentes y dejando trazabilidad en disco.

### 3.1 El flujo (`services/delegation.py` → `generate_code`)

```
POST /api/agents/orchestrate/code { request, provider?, model? }
   │
   ▼
1) Boss PLANIFICA el proyecto  → _plan_project()
      · 2 llamadas de TEXTO PLANO (título corto + brief), más fiable que pedir JSON
      · _clean_title() limpia markdown/comillas; heurística local de respaldo
      · crea project_id (uuid) y escribe brief.md en la carpeta del proyecto
2) Crea la tarea "paraguas"  → "Misión · <proyecto>" (status IN_PROGRESS)
      · garantiza que el proyecto aparece en el Kanban aunque un paso falle
3) BOSS genera la ESTRUCTURA HTML            → boss_html.html
4) Según agent_cap y tailwind:
      · 3 agentes (sin Tailwind): PIXEL → pixel_css.css ; MAX → max_js.js
      · 2 agentes (o con Tailwind): MAX hace diseño+JS → max_full.html
5) BOSS ENSAMBLA leyendo los artefactos de disco → final.html
      · _assemble() + _finalize_doc() garantizan documento BIEN FORMADO
        (DOCTYPE, cierre </body></html>, inyección del CDN de Tailwind si aplica)
6) Cierra la tarea "Misión" (COMPLETED) y guarda la lista de artefactos en result_data
   │
   ▼
Devuelve { ok, final, steps[], artifacts[], workspace_dir, project_id, project_name,
           delegated[], agent_cap, tailwind, skills_used[], partial, partial_error }
```

Cada paso que delega crea su propia `Task` con `role_label` (HTML / CSS / JS / DISEÑO+JS /
CSS+JS / ENTREGA / MISIÓN), su `provider`/`model` realmente usados, y el `project_id` común.

### 3.2 Robustez (por qué ya no se "congela")

Implementado en `delegation.py` + `services/llm.py`:

- **Tope duro por llamada** (`HARD_CALL_TIMEOUT = 75s`, `asyncio.wait_for`): si un proveedor
  no responde, se corta; nunca congela la misión.
- **Timeout granular httpx** en `chat_effective` (`connect=10s`, `read=timeout`, etc.).
- **Reintentos + FALLBACK entre proveedores** (`_run` con `fallbacks=_fallback_chain(...)`):
  si el proveedor elegido falla, cuelga o **devuelve contenido vacío** (caso real de Groq
  `gpt-oss-20b`), reintenta con backoff y luego pasa a otro proveedor habilitado
  (orden: mistral → vercel → nvidia → openrouter → cloudflare → groq → gemini).
- **Errores reintentables** en `chat_effective`: 429 (rate limit), 5xx, timeouts/cortes de
  red y "respuesta vacía" se marcan `retryable=True`.
- **Entrega parcial**: si un paso tardío falla, se ensambla y entrega lo disponible
  (`partial=True`, `partial_error`), sin perder el proyecto ni los artefactos previos.

### 3.3 Override de modelo desde el Studio

El selector de proveedor/modelo del `StudioPanel` viaja en el POST (`provider`/`model`) y, si
viene, **se impone** al provider/model configurado en cada agente para esa misión
(`_resolve_model`). Si no viene, cada agente usa el suyo (reparte carga entre proveedores).

### 3.4 Detección de intención y destinatario (frontend)

`sendChat` en `useLiveOffice.ts` decide **a quién** y **por qué ruta** ejecutar:

1. **Destinatario (mención de agente).** Si el texto nombra a un agente activo distinto de
   Boss (`@scout`, "dile a scout", "que scout…"), **ese agente** pasa a ser el ejecutor
   (`orch = mentioned`) y responde él mismo con `pingAgent()`. Así se respeta la delegación
   pedida y **no** se fuerza el flujo Pixel/Max.
2. **Intención de investigación** (`isResearch`): verbos como investiga/compara/análisis/
   "qué es mejor"/"tabla comparativa"/pros y contras → tiene **prioridad** sobre "código"
   (evita que "compara servicios de backend" dispare el flujo HTML/CSS/JS).
3. **Código** (`isCode`): solo si el ejecutor es **Boss**, no es investigación, hay un
   sustantivo claramente front-end (html/css/js/landing/dashboard/componente/…) **y** un verbo
   de crear (crea/genera/diseña/…) o la palabra "landing".

Rutas resultantes:
- **código** → `orchestrateCode()` (delegación real; el backend crea las tareas del proyecto).
  No se crea placeholder local (lo crea el backend como "Misión"), evitando duplicados.
- **no-código / investigación / agente nombrado** → `pingAgent()` sobre el `backendId` del
  ejecutor (una sola llamada LLM, más robusta).

**Manejo de errores:** si la ruta falla, el `catch` muestra el **mensaje real** del error en el
feed y el chat (ya no un genérico "red local") y marca la tarea como `blocked`.

---

## 4. Artefactos por proyecto (carpeta temporal)

`services/artifacts.py` → `ArtifactStore(project_id)` gestiona `backend/_workspace/<project_id>/`:

```
_workspace/<project_id>/
   brief.md          · el "paper" general (Boss) — objetivo + cómo encajan las partes
   boss_html.html    · devolución de Boss (estructura)
   pixel_css.css     · devolución de Pixel (modo 3 agentes)
   max_js.js         · devolución de Max  (modo 3 agentes)
   max_full.html     · devolución de Max  (modo 2 agentes: diseño+JS)
   final.html        · entregable ensamblado por Boss
   manifest.json     · índice de auditoría (agente, rol, archivo, bytes, timestamp)
```

- Cada agente **escribe** su devolución (`write_return`); Boss las **lee de vuelta** (`read`)
  para ensamblar → cierra el ciclo de delegación con trazabilidad real en disco.
- La carpeta está en `.gitignore` (`_workspace/`, `backend/_workspace/`).
- La lista de rutas relativas se expone en la respuesta (`artifacts`, `workspace_dir`) y se
  guarda en `tasks.result_data` de la tarea ENTREGA.

---

## 5. Skills: importar desde GitHub y "usarlas"

### 5.1 Importador (`POST /api/skills/import`, en `api/skills.py`)
- Descarga el `SKILL.md` **desde el backend** (evita CORS del navegador).
- `_normalize_skill_url()` acepta y normaliza enlaces de GitHub `blob/`, `tree/` (carpeta) o
  `raw.githubusercontent.com` → resuelve la URL raw del `SKILL.md`.
- `_parse_skill_md()` extrae frontmatter (name/description) + cuerpo y **adivina la categoría**
  (prioriza diseño sobre código). Devuelve los campos para prellenar el formulario (no guarda).
- **Orden de rutas importante:** `/import` se declara **ANTES** de `/{skill_id}`; si no, un
  `POST /import` queda capturado por el patrón `/{skill_id}` y devuelve `405 Method Not Allowed`.
- Frontend: `api.ts importSkillFromUrl()` → `SkillsPanel.tsx` (botón Importar).

### 5.2 Uso real de skills en la delegación
- Un agente tiene `skills: [nombre, …]` (asignadas desde `SkillsPanel`/`AgentEditor`).
- En `delegation.py`, `_skill_guidance(agent)` carga las **instrucciones completas** de las
  skills activas del agente y las **inyecta en su prompt** (Boss y Pixel; en modo 2 agentes,
  Max hereda las de Pixel). Así el agente "usa" la skill (p. ej. el design system `cosmic`).
- La respuesta incluye `skills_used[]`.

---

## 6. Proyectos en la UI (Kanban + Oficina)

Las tareas con `projectId` se **agrupan por proyecto**. Si una tarea no tiene `projectId`
cae en un grupo "Tareas sueltas".

- **Kanban** (`components/KanbanBoard.tsx`): selector "Filtrar por proyecto"; cada proyecto es
  una sección colapsable con su brief y sus 3 columnas (backlog / en progreso / listo).
  Botón 🗑 por tarea y "🗑 Proyecto" (borra todo el proyecto vía `DELETE /api/tasks/project/{id}`).
- **Oficina** (`components/office/OfficeScene.tsx`): deriva `OfficeProject[]` de las tareas por
  `projectId`. Mesa de **PROYECTOS ACTIVOS** (escoger/filtrar) y mesa de **ENTREGADOS**; cada
  ficha de proyecto entregado tiene botón **⬇ descargar** del entregable final.
- **Tab de tareas del agente** (`AgentChatDock.tsx` y `pages/AgentPage.tsx`): lista primero los
  proyectos y debajo las tareas del agente, con su `roleLabel` y modelo.

### 6.1 Descarga del entregable
- **DocViewer** (`components/DocViewer.tsx`): si la hoja es código, la muestra en bloque de
  código con **⬇ descargar** (nombre tipo `<proyecto>.html`) y **📋 copiar**, más la lista de
  artefactos.
- **TaskDrawer** (`components/TaskDrawer.tsx`): el entregable de una tarea se renderiza como
  código con su `roleLabel` y botón de descarga.
- **Oficina → ENTREGADOS**: `onDownloadProject` en `App.tsx` busca la tarea ENTREGA (o MISIÓN)
  del proyecto y descarga su `result`.

---

## 7. "Si cambio X, actualizo Y" (checklists)

### 7.1 Agregar un proveedor LLM nuevo
1. `backend/app/config/settings.py` → `XXX_API_KEY`, `XXX_API_URL`, `XXX_TIMEOUT` (y validador
   `_empty_str_to_none` si la URL es opcional).
2. `backend/app/config/llm.py` → enum `ProviderType`; entrada en `llm_config.providers`
   (con `models` verificados, `label`, `note`); añadir a `failover_order` y a `_DEFAULT_URLS`.
3. `backend/app/services/llm.py` → si OpenAI-compatible, añadir a `_CHAT_PATHS`
   (usado por `chat_effective`) y a `_OPENAI_COMPAT_PATHS` (usado por `chat`); si formato
   propio, crear `_call_xxx` y su dispatch.
4. `backend/.env` → key real (o agregarla desde `/proveedores`).
5. **Fallback de delegación**: `delegation._fallback_chain()` tiene un orden de preferencia;
   si el nuevo proveedor es estable, considéralo ahí.
6. Frontend: nada que hardcodear (lee el catálogo vía `GET /api/agents/providers`).
7. Reiniciar uvicorn (los clientes se crean en `llm_service.initialize()`).

### 7.2 Credenciales gestionables desde la UI (sin tocar `.env`)
- **Modelo:** `models/provider_credential.py` (`ProviderCredential`), registrado en
  `models/__init__.py`.
- **Servicio:** `services/credentials.py`: `seed_credentials_from_env()`,
  `load_overrides_from_db()`, `refresh_overrides()`, `init_credentials()` (corre en lifespan).
- **Capa de overrides** (`config/llm.py`): `effective_api_key/url/models`, `provider_enabled`,
  `provider_timeout`, `is_custom_provider`, `provider_catalog`. `chat_effective()` las usa.
- **Router:** `api/credentials.py` (`/api/credentials`): `GET /`, `POST /`, `PUT /{id}`,
  `POST /{id}/activate`, `DELETE /{id}`, `POST /test`, `GET /usage/{provider_id}`.
- **Frontend:** `ProvidersPanel.tsx` y `ProvidersSidebar.tsx` (Playground + alta custom).
- Al agregar/editar keys desde la UI **no** hace falta reiniciar (`refresh_overrides()` recarga en caliente).

### 7.3 Cambiar un campo del modelo Task (DB)
1. `backend/app/models/task.py` → la columna.
2. `backend/app/config/database.py` → añadir la columna a `_ensure_columns` (migración ligera
   idempotente que hace `ALTER TABLE ... ADD COLUMN` en SQLite/Postgres al arrancar, porque
   `create_all` NO altera tablas existentes).
3. `backend/app/schemas/task.py` → `TaskCreate` / `TaskUpdate` / `TaskResponse`.
4. `backend/app/api/tasks.py` → mapear el campo en **los 4** builders de `TaskResponse`
   (list, get, create, update) y en la lógica de create/update.
5. **Frontend:** `api.ts` → `BackendTask` y `TaskPatch`; `useLiveOffice.ts` → mapear el campo en
   **los 3** mapeos (sync inicial, polling PROD, `refreshTasksFromBackend`).

> Las columnas de proyecto (`project_id/project_name/project_brief/role_label`) y de modelo
> (`provider/model`) ya pasan por esta migración ligera; no hay que borrar la DB.

### 7.4 Cambiar un campo del modelo Agent (DB)
1. `models/agent.py` → columna. 2. `schemas/agent.py`. 3. `api/agents.py` (todos los
`AgentResponse` se arman a mano). 4. Frontend `api.ts` (`BackendAgent`/`AgentPatch`) +
`useLiveOffice.ts` (sync y polling).

### 7.5 Agregar/renombrar un agente del ROSTER
Mantener sincronizados **por nombre**: `services/seed.py` (`ROSTER_SEED`) y
`frontend/src/data/demo.ts` (`ROSTER`). Si los nombres no coinciden, no hay `backendId`.

### 7.6 Agregar un endpoint REST nuevo
1. Router en `backend/app/api/<recurso>.py`. 2. `main.py` `include_router(...)` con `prefix`.
3. Frontend: función cliente en `api.ts` + consumo.
   **Ojo con el orden de rutas:** declarar rutas específicas (`/import`, `/orchestrate/code`,
   `/project/{project_id}`) **antes** de las paramétricas tipo `/{id}` para no provocar 405.

### 7.7 Tocar la delegación/orquestación
Archivos que se mueven juntos: `services/delegation.py` (flujo), `services/artifacts.py`
(carpeta), `api/agents.py` (`/orchestrate/code`), `models/task.py` + `schemas/task.py` +
`api/tasks.py` (campos de proyecto/modelo), y en el front `useLiveOffice.ts` (`sendChat`,
`refreshTasksFromBackend`), `KanbanBoard.tsx`, `office/OfficeScene.tsx`, `DocViewer.tsx`,
`TaskDrawer.tsx`.

---

## 8. Backend — mapa de archivos

```
backend/app/
├── main.py                 ← arranque (lifespan): init_db → seed → credentials → llm → token → ws
├── config/
│   ├── settings.py         ← TODAS las variables de entorno (.env)
│   ├── llm.py              ← ProviderType, llm_config, failover_order, capa de OVERRIDES
│   │                         (effective_api_key/url/models, provider_catalog, provider_enabled)
│   ├── database.py         ← engine (SQLite/Postgres), init_db, _ensure_columns (migración ligera)
│   └── websocket.py        ← WebSocketManager (broadcast por workspace)
├── models/                 ← SQLAlchemy (agent, task*, user, workspace, skill,
│                             mission, provider_credential, token_usage, webhook)
│                             *task incluye provider/model + project_id/name/brief/role_label
├── schemas/                ← Pydantic (validación entrada/salida)
├── api/                    ← routers REST:
│   ├── agents.py           ← CRUD + GET /providers + POST /{id}/ping + POST /orchestrate/code
│   ├── tasks.py            ← CRUD + DELETE /project/{project_id}
│   ├── skills.py           ← CRUD + POST /import (antes de /{skill_id})
│   ├── credentials.py      ← gestión de API keys por proveedor (BYOK en caliente)
│   └── users/missions/workspace/webhooks/office
├── services/
│   ├── llm.py              ← LLMService.chat_effective() (key efectiva + timeout granular +
│   │                         errores reintentables) y chat()/_call_* por proveedor
│   ├── delegation.py       ← ★ ORQUESTACIÓN: generate_code(), _plan_project(), _run() con
│   │                         fallback entre proveedores, _assemble()/_finalize_doc()
│   ├── artifacts.py        ← ArtifactStore: carpeta _workspace/<project_id>/ + manifest
│   ├── credentials.py      ← seed/overrides de credenciales en caliente
│   ├── seed.py             ← admin + workspace + ROSTER (clave del vínculo por nombre)
│   ├── orchestration.py    ← workflow previo (parcialmente simulado; coexiste con delegation)
│   ├── auth.py             ← JWT + bcrypt
│   ├── token_manager.py    ← presupuesto de tokens
│   └── moods.py            ← mensajes "con personalidad" ante errores de LLM
└── _workspace/             ← (gitignored) artefactos por proyecto que escriben los agentes
```

Variables de entorno sensibles: **solo en `backend/.env`** (gitignored). Nunca en el repo.

---

## 9. Frontend — mapa de archivos

```
frontend/src/
├── main.tsx                ← monta <BrowserRouter><App/>
├── App.tsx                 ← layout + RUTAS + overlays (AgentEditor, TaskDrawer, DocViewer,
│                             AgentChatDock); deriva OfficeProject[] desde tasks por projectId;
│                             handler de descarga de entregable; oculta selector DEMO si
│                             providersReady (muestra "🏭 PRODUCCIÓN · agentes reales")
├── api.ts                  ← cliente REST + WS; interfaces Backend*; pingAgent, orchestrateCode,
│                             importSkillFromUrl, deleteTask/deleteProjectTasks, credenciales…
├── hooks/
│   ├── useLiveOffice.ts    ← ★ EL CEREBRO: estado de agentes/tareas/docs/chats; sync+polling;
│   │                         providersReady (auto-PROD al detectar proveedor);
│   │                         sendChat (destinatario por mención + isResearch/isCode:
│   │                           código→orchestrateCode / resto→pingAgent),
│   │                         sendAgentMessage, followUpDoc, refreshTasksFromBackend,
│   │                         removeTask, removeProject
│   └── useProviders.ts     ← catálogo de proveedores/modelos del backend (con fallback local)
├── data/demo.ts            ← ROSTER, PROVIDERS, PROVIDER_MODELS, textos de simulación
├── pages/AgentPage.tsx     ← ruta /agente/:id (perfil + chat + proyectos/tareas del agente)
└── components/
    ├── office/OfficeScene.tsx   ← oficina pixel-art (SVG): PROYECTOS activos/entregados,
    │                              drilldown de escritorios, descarga de entregable
    ├── office/AgentSprite.tsx   ← sprite animado
    ├── StudioPanel.tsx          ← barra izquierda: agentes, chat, alta de agente, selector
    │                              de proveedor/modelo (override para la misión)
    ├── AgentEditor.tsx          ← drawer de configuración (identidad, modelo, skills, aspecto)
    ├── AgentChatDock.tsx        ← ventana flotante de chat; tab "Tareas" agrupadas por proyecto
    ├── KanbanBoard.tsx          ← tablero agrupado por PROYECTO + filtro + borrar tarea/proyecto
    ├── TaskDrawer.tsx           ← detalle de tarea + entregable como código + descarga
    ├── DocViewer.tsx            ← visor de hoja/entregable con descarga + copiar + artefactos
    ├── SkillsPanel.tsx          ← catálogo de skills + IMPORTAR desde GitHub
    ├── ProvidersPanel.tsx       ← BYOK (gestión de credenciales por proveedor)
    └── ProvidersSidebar.tsx     ← Playground + alta de proveedor custom (ruta /proveedores)
```

### Rutas (React Router)
`/oficina` · `/kanban` · `/skills` · `/proveedores` · `/agente/:id` · `/` → redirige a `/oficina`.

### Dónde aparecen las respuestas del modelo
- **Chat directo** (tocar un agente) → `sendAgentMessage` → `agentChats` + hilo visible.
- **Misión de código** (chat del Studio) → `sendChat` → `orchestrateCode` → crea proyecto +
  subtareas (Kanban/Oficina) y deja la **hoja/entregable** descargable (DocViewer).
- **Misión no-código** → `sendChat` → `pingAgent` → hoja en la mesa.
- **Seguir un hilo** sobre una hoja → `followUpDoc`.

---

## 10. Modos DEMO vs PROD (frontend)

- **Auto-PROD por detección de proveedor.** `useLiveOffice` consulta `GET /api/agents/providers`;
  si hay **≥1 proveedor habilitado**, expone `providersReady=true`, **fuerza `mode='prod'`** y
  en `App.tsx` el **selector DEMO/PROD se oculta** (se muestra "🏭 PRODUCCIÓN · agentes reales").
  Es decir: en cuanto el backend tiene una credencial, el usuario ya no elige modo y los agentes
  son reales. Reintenta cada 6s hasta que el backend responda.
- **DEMO** (solo si aún no hay proveedor detectado): motor de simulación local (los agentes se
  mueven y "trabajan" solos). Además, un **polling ligero de tareas** (cada 6s, solo en demo)
  trae los PROYECTOS reales del backend para que aparezcan sin recargar.
- **PROD**: refleja el backend real; polling cada 6s de `/api/agents/` y `/api/tasks/`. El poll
  **no pisa** a un agente que el usuario acaba de poner a ejecutar (`trip==='table'`), para
  evitar el parpadeo ("da vueltas") mientras corre `sendChat`.

El modo se guarda en `localStorage` (`sc_mode`), pero `providersReady` lo sobreescribe a `prod`.
Tras una misión, `refreshTasksFromBackend()` trae las subtareas reales ya agrupadas por proyecto.

> **Nota de caché:** si tras cambios del frontend no se ven los proyectos, suele ser un bundle
> viejo. Reiniciar `npm run dev` y hacer recarga dura (Ctrl+Shift+R) o abrir en incógnito.

---

## 11. Datos locales del navegador (localStorage)
| Clave | Contenido |
|---|---|
| `sc_token` / `sc_creds` | sesión JWT y credenciales demo |
| `sc_mode` | demo / prod |
| `sc_look` | personalización visual por agente |
| `sc_docs` | hojas/entregables persistidos |
| `sc_agentchats` | conversaciones directas por agente |
| `sc_selected` | agente actualmente "en uso" |
| `sc_byok` / `sc_model_prefs` | llaves BYOK del panel y modelo preferido por proveedor |
| `sc_theme` | tema de la oficina |

---

## 12. Checklist rápido al tocar el sistema
1. ¿Proveedor LLM? → §7.1 (settings → llm config → llm service → fallback → .env).
2. ¿Credenciales desde UI? → §7.2 (modelo → servicio → router → panel; recarga en caliente).
3. ¿Campo de Task (incl. proyecto/modelo)? → §7.3 (model → `_ensure_columns` → schema → api ×4
   → api.ts → useLiveOffice ×3).
4. ¿Delegación/artefactos/proyectos? → §7.7 (delegation + artifacts + task + front views).
5. ¿Nuevo endpoint? → §7.6 (router → main.py → api.ts; rutas específicas antes de `/{id}`).
6. ¿Skills? → §5 (`/import` antes de `/{skill_id}`; `_skill_guidance` para que se "usen").
7. ¿Ruta/destinatario de una petición del Studio? → §3.4 (mención de agente, `isResearch`,
   `isCode`). Si una petición cae en la ruta equivocada, ajustar esos regex en `sendChat`.
8. ¿Modo/visibilidad DEMO? → §10 (`providersReady` fuerza PROD y oculta el selector al detectar
   proveedor; el poll PROD respeta `trip` para no parpadear).
9. Reiniciar uvicorn si tocaste `.env`, `settings.py`, `llm.py`, `seed.py`, `delegation.py` o
   un servicio. Verificar: `GET /health` OK y `GET /api/agents/` lista el ROSTER.
10. Frontend: `npm run dev` + recarga dura si un cambio no se refleja (caché de bundle).
