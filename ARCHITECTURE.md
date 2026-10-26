# ARCHITECTURE.md — Mapa de convergencia de SeeControl

Este documento explica **dónde vive cada cosa** y, sobre todo, **qué archivos hay que tocar
juntos** cuando se ajusta el backend, para que un cambio no quede a medias. Es la referencia
para mantener backend y frontend sincronizados.

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
   ┌─────────┼───────────────┬──────────────┐
   ▼         ▼               ▼              ▼
 SQLite/   LLM service    WebSocket mgr   Seed inicial
 Postgres  (proveedores)  (tiempo real)   (admin+agentes)
             │
             ▼
   Proveedores LLM (Groq, Mistral, Vercel, OpenRouter, NVIDIA, Cloudflare, …)
```

- **Frontend**: SPA con React Router. Todo el estado vivo converge en un único hook:
  `frontend/src/hooks/useLiveOffice.ts`.
- **Backend**: FastAPI. El punto de arranque y orquestación de servicios es
  `backend/app/main.py` (lifespan).
- **BYOK real**: las API keys viven en `backend/.env` (no se commitea). El frontend
  también tiene un panel BYOK que guarda llaves en localStorage para la UI, pero la
  ejecución real de modelos usa las del backend.

---

## 2. Puntos de convergencia (dónde "se juntan" las cosas)

| Concepto | Backend (fuente de verdad) | Frontend (consumo) |
|---|---|---|
| Estado vivo de agentes/tareas | `GET /api/agents/`, `GET /api/tasks/` | `useLiveOffice.ts` (sync inicial + polling 6s en modo PROD) |
| Ejecución real de un modelo | `POST /api/agents/{id}/ping` → `llm_service.chat()` | `api.ts pingAgent()` usado por `sendChat`, `sendAgentMessage`, `followUpDoc` |
| Proveedores LLM y llaves | `config/settings.py` + `config/llm.py` + `.env` | panel BYOK (`ProvidersPanel.tsx`) solo informativo/local |
| Agentes por defecto (ROSTER) | `services/seed.py` (siembra en DB) | `data/demo.ts` ROSTER (nombres deben coincidir) |
| Vínculo front↔backend de un agente | el agente existe en DB con el mismo **nombre** | `useLiveOffice` asigna `backendId` haciendo match por nombre |
| Tiempo real | `config/websocket.py` emite eventos | `api.ts connectOfficeWS` (feed) + polling para estado |

**Regla de oro del vínculo:** un agente del frontend solo puede ejecutar modelos reales
si tiene `backendId`. Ese `backendId` se asigna cuando existe en la DB un agente con el
**mismo nombre** (case-insensitive). Por eso el seed (`services/seed.py`) crea el ROSTER:
sin seed, los agentes quedan "locales" y el chat responde "agente local sin backend".

---

## 3. "Si cambio X en el backend, actualizo Y" (checklists)

### 3.1 Agregar un proveedor LLM nuevo
Tocar **en este orden**:
1. `backend/app/config/settings.py` → añadir `XXX_API_KEY`, `XXX_API_URL`, `XXX_TIMEOUT`.
   Si la URL es opcional, añadir el campo al validador `_empty_str_to_none`.
2. `backend/app/config/llm.py` →
   - añadir el valor al enum `ProviderType`;
   - añadir su entrada en `llm_config.providers` (con `enabled = settings.XXX_API_KEY is not None`);
   - añadirlo a `failover_order`.
3. `backend/app/services/llm.py` →
   - si es OpenAI-compatible: añadirlo a `_OPENAI_COMPAT_PATHS` con su path de chat, y al
     branch `elif provider in (...)` dentro de `chat()`; los headers ya se cubren en
     `_get_headers` (bloque de providers OpenAI-compatible);
   - si tiene formato propio: crear un `_call_xxx` y su dispatch en `chat()`.
4. `backend/.env` → poner la key real.
5. En `llm.py`, dar a cada provider una lista `models` **de modelos verificados** y, de ser
   útil, `label` y `note`. Esta lista es la que verá la UI (ver catálogo abajo).
6. **Frontend: nada que hardcodear.** El selector de modelos lee el catálogo del backend vía
   `GET /api/agents/providers` (hook `frontend/src/hooks/useProviders.ts`). Solo si el backend
   no responde se usa el fallback local `data/demo.ts` (`PROVIDERS`/`PROVIDER_MODELS`).
7. Reiniciar el backend (los clientes HTTP se crean en `llm_service.initialize()` al arrancar).

> Nota: un proveedor solo queda "enabled" si su API key es **real** (no vacía ni placeholder;
> ver `has_key()` en `config/llm.py`). Cambiar `.env` requiere reiniciar uvicorn.

### 3.1-bis Catálogo de modelos (fuente de verdad para la UI)
- **Backend:** `config/llm.py` → `provider_catalog()` arma la lista `{id, label, enabled, models,
  note, default_model}` por proveedor. Se expone en `api/agents.py` → `GET /api/agents/providers`.
- **Frontend:** `hooks/useProviders.ts` consume ese endpoint y lo cachea.
  - `modelsForProvider(catalog, id)` → modelos permitidos de un proveedor.
  - `defaultModelFor(catalog, id)` → modelo por defecto (respeta la preferencia del usuario en
    `localStorage.sc_model_prefs`, fijada desde el panel BYOK → "Modelos integrados").
- **Panel de gestión:** `components/ProvidersPanel.tsx` (ruta `/proveedores`) muestra cada
  proveedor con su estado (✓ activo / ○ sin key), su nota, y permite elegir el modelo por
  defecto. Los selectores del `AgentEditor` y del `StudioPanel` usan este catálogo.
- Al agregar/ajustar modelos: basta editar la lista `models` del provider en `config/llm.py` y
  reiniciar el backend; la UI se actualiza sola (botón "↻ Recargar" en el panel).

### 3.2 Cambiar el modelo/proveedor por defecto de un agente del ROSTER
1. `backend/app/services/seed.py` → `ROSTER_SEED` (afecta **bases de datos nuevas**).
2. Para una DB ya existente: actualizar vía `PUT /api/agents/{id}` (o la UI → Studio → ⚙),
   porque el seed es idempotente y **no** re-escribe agentes ya creados.

### 3.3 Agregar/renombrar un agente del ROSTER
Mantener sincronizados **por nombre**:
1. `backend/app/services/seed.py` → `ROSTER_SEED`.
2. `frontend/src/data/demo.ts` → `ROSTER` (mismo `name`; define look y escritorio).
   Si los nombres no coinciden, el agente no recibirá `backendId`.

### 3.4 Cambiar un campo del modelo Agent (DB)
1. `backend/app/models/agent.py` → la columna.
2. `backend/app/schemas/agent.py` → `AgentCreate` / `AgentUpdate` / `AgentResponse`.
3. `backend/app/api/agents.py` → mapear el campo en `create_agent`, `update_agent`,
   `list_agents`, `get_agent` (todos construyen `AgentResponse` a mano).
4. **Frontend:** `frontend/src/api.ts` → interfaz `BackendAgent` y `AgentPatch`;
   `useLiveOffice.ts` → mapear el campo en el sync y el polling.
5. Con SQLite en dev, borrar `backend/seecontrol.db` para recrear tablas, o migrar. No hay
   Alembic activo por defecto: las tablas se crean con `Base.metadata.create_all` al arrancar.

### 3.5 Agregar un endpoint REST nuevo
1. Crear/editar el router en `backend/app/api/<recurso>.py`.
2. Registrarlo en `backend/app/main.py` (`app.include_router(...)` con su `prefix`).
   **Ojo:** los POST de colección usan trailing slash (`/api/agents/`, `/api/tasks/`, …).
3. **Frontend:** añadir la función cliente en `frontend/src/api.ts` y consumirla en
   `useLiveOffice.ts` o el componente correspondiente.

### 3.6 Agregar un evento WebSocket
1. `backend/app/config/websocket.py` → método que hace broadcast del nuevo tipo.
2. Emitirlo donde corresponda (p. ej. `api/office.py`, `api/tasks.py`).
3. **Frontend:** `api.ts connectOfficeWS` recibe el mensaje; hoy `useLiveOffice` solo lo usa
   como feed/indicador y refresca el estado por **polling** (no re-renderiza por el payload
   WS). Si se quiere push instantáneo, hay que reaccionar al `msg.type` en el callback.

---

## 4. Backend — mapa de archivos

```
backend/app/
├── main.py                 ← arranque (lifespan): init_db → seed → llm → token → ws
├── config/
│   ├── settings.py         ← TODAS las variables de entorno (.env)
│   ├── llm.py              ← ProviderType, llm_config.providers, failover_order, enabled_providers
│   ├── database.py         ← engine (SQLite/Postgres según USE_SQLITE), init_db, get_db
│   └── websocket.py        ← WebSocketManager (broadcast por workspace)
├── models/                 ← SQLAlchemy (agent, task, user, workspace, skill, mission, …)
├── schemas/                ← Pydantic (validación entrada/salida de la API)
├── api/                    ← routers REST (agents, tasks, users, skills, missions, office, …)
├── services/
│   ├── llm.py              ← LLMService.chat() + _call_* por proveedor (ejecución real)
│   ├── seed.py             ← siembra admin + workspace + ROSTER (clave del vínculo)
│   ├── auth.py             ← JWT + bcrypt
│   ├── orchestration.py    ← workflow (parcialmente simulado)
│   └── token_manager.py    ← presupuesto de tokens
└── moods.py / services/moods.py ← mensajes "con personalidad" ante errores de LLM
```

Variables de entorno sensibles: **solo en `backend/.env`** (gitignored). Nunca en el repo.

---

## 5. Frontend — mapa de archivos

```
frontend/src/
├── main.tsx                ← monta <BrowserRouter><App/>
├── App.tsx                 ← layout (header + StudioPanel) + RUTAS + montaje de overlays
│                             (AgentEditor con key={id}, TaskDrawer, DocViewer, AgentChatDock)
├── api.ts                  ← cliente REST + WS; interfaces Backend* ; pingAgent, etc.
├── hooks/useLiveOffice.ts  ← ★ EL CEREBRO: estado de agentes/tareas/docs/chats,
│                             sync+polling con backend, sendChat (orquestador),
│                             sendAgentMessage (chat directo), followUpDoc (hilos),
│                             selección de agente, etc.
├── data/demo.ts            ← ROSTER, PROVIDERS, PROVIDER_MODELS, textos de simulación
├── pages/AgentPage.tsx     ← ruta /agente/:id (perfil + chat amplio + historial)
└── components/
    ├── office/OfficeScene.tsx   ← oficina pixel-art (SVG) + posiciones + hojas/docs
    ├── office/AgentSprite.tsx   ← sprite animado (parpadeo, caminar, anillo de selección)
    ├── StudioPanel.tsx          ← barra izquierda: lista de agentes, chat, alta de agente
    ├── AgentEditor.tsx          ← drawer de configuración (identidad, modelo, skills, aspecto)
    ├── AgentChatDock.tsx        ← ventana flotante de chat por agente (tipo chatbot)
    ├── KanbanBoard.tsx          ← tablero de tareas
    ├── TaskDrawer.tsx           ← detalle/chat de una tarea
    ├── DocViewer.tsx            ← visor de "hoja"/entregable
    ├── SkillsPanel.tsx          ← catálogo de skills
    └── ProvidersPanel.tsx       ← BYOK (localStorage, informativo)
```

### Rutas (React Router)
`/oficina` · `/kanban` · `/skills` · `/proveedores` · `/agente/:id` · `/` → redirige a `/oficina`.

### Dónde aparecen las respuestas del modelo
- **Chat directo** (tocar un agente) → `sendAgentMessage` → guarda en `agentChats` y además
  deja un **"hilo"** (doc `thread-<agentId>`) visible en la oficina y reseñable.
- **Misión del orquestador** (chat del Studio) → `sendChat` → crea tarea (Kanban), ejecuta con
  el orquestador y deja una **hoja** (DocViewer) en la mesa; marca la tarea `completed`.
- **Seguir un hilo** sobre una hoja → `followUpDoc`.

Todos estos caminos llaman al mismo `pingAgent` del backend y requieren que el agente tenga
`backendId` (ver §2, regla de oro).

---

## 6. Modos DEMO vs PROD (frontend)
- **DEMO**: motor de simulación local (los agentes se mueven y "trabajan" solos). No usa backend
  para el estado.
- **PROD**: refleja el backend real; hace polling cada 6s de `/api/agents/` y `/api/tasks/`.
  Para ver ejecución real de modelos, usar PROD.

El modo se guarda en `localStorage` (`sc_mode`).

---

## 7. Datos locales del navegador (localStorage)
| Clave | Contenido |
|---|---|
| `sc_token` / `sc_creds` | sesión JWT y credenciales demo |
| `sc_mode` | demo / prod |
| `sc_look` | personalización visual por agente |
| `sc_docs` | hojas/entregables persistidos |
| `sc_agentchats` | conversaciones directas por agente |
| `sc_selected` | agente actualmente "en uso" |
| `sc_byok` | llaves BYOK del panel (informativas) |
| `sc_theme` | tema de la oficina |

---

## 8. Checklist rápido al tocar el backend
1. ¿Cambié un proveedor LLM? → §3.1 (settings → llm config → llm service → .env → demo.ts).
2. ¿Cambié el modelo de un agente? → §3.2 (seed para nuevas DB; PUT/UI para la actual).
3. ¿Cambié el modelo de datos? → §3.4 (model → schema → api → api.ts → useLiveOffice → recrear DB).
4. ¿Nuevo endpoint? → §3.5 (router → main.py include → api.ts → consumo).
5. Reiniciar uvicorn si tocaste `.env`, `settings.py`, `llm.py` o `seed.py`.
6. Verificar: `GET /health` responde, y `GET /api/agents/` lista el ROSTER con su provider/model.
