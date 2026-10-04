# SeeControl - Setup Local

Plataforma de orquestación multi-agente con oficina virtual pixel-art estilo GameBoy Pokémon.

## ✅ Setup verificado en Windows (Oct 2026)

Backend en **PostgreSQL real** + frontend plataforma completa (Studio/Chat, Oficina en vivo,
Kanban, Fatiga de tokens, BYOK Global+Asia). Servicios esperados arriba:

| Servicio | URL / puerto |
|---|---|
| API + Docs | http://127.0.0.1:8000/docs |
| Frontend | http://127.0.0.1:5173 |
| PostgreSQL | localhost:5432 (BD `seecontrol`, usuario `seecontrol`) |

```powershell
# 1. PostgreSQL (cluster local en C:\Users\<tu>\pgdata)
& 'C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe' -D "$env:USERPROFILE\pgdata" -l "$env:USERPROFILE\pgdata\logfile.log" start

# 2. Backend (crea las 8 tablas solo con arrancar)
cd seecontrol-main\backend
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
# USE_SQLITE=false en backend/.env = Postgres. Para volver a SQLite: USE_SQLITE=true

# 3. Frontend
cd ..\frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

Usuario demo: `admin@seecontrol.io` / `admin123` (rol owner). Login por formulario
OAuth2 (`username` + `password`) en `POST /api/users/login`. Los POST de colección
usan trailing slash (`/api/agents/`, `/api/tasks/`, `/api/missions/`, `/api/skills/`).

Bugs corregidos vs. repo original: doble prefijo de routers (`/api/users/users/...`),
`TaskResponse` incompleto, helpers WS faltantes (`broadcast_mission_update`,
`broadcast_office_state`, `broadcast_skill_update`, `broadcast_webhook_event`),
imports ausentes (`select` en orchestration/token_manager/office, `AgentStatus`,
`Task/TaskStatus/TaskPriority` en agents), `relationship()` sin FK, columna
`metadata` reservada por SQLAlchemy (renombrada a `task_metadata`/`usage_metadata`
mapeando la misma columna), `bcrypt==4.0.1` pineado, `PixelOffice` legacy con
celdas debug `+x,y`, y entry points del frontend (`main.tsx`/`App.tsx`) inexistentes.

---

## 📋 Requisitos Previos

### Backend (FastAPI)
- **Python**: 3.11 o superior
- **PostgreSQL**: 14 o superior
- **Redis**: 7 o superior (para caching y WebSocket)

### Frontend (React/TypeScript)
- **Node.js**: 18 o superior
- **npm**: 9 o superior
- **Git**: Para clonar el repositorio

---

## 🚀 Instalación Completa

### 1. Clonar el Repositorio

```bash
cd /workspace
git clone https://github.com/bulgaritox/seecontrol.git
cd seecontrol
```

### 2. Configurar Backend

#### Crear entorno virtual

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# O en Windows: venv\Scripts\activate
```

#### Instalar dependencias

```bash
pip install -r requirements.txt
```

#### Configurar variables de entorno

Crear archivo `.env` en `/backend/`:

```bash
# Copiar el template
cp .env.example .env
```

Editar `.env` con tus configuraciones:

```env
# ============================================
# CONFIGURACIÓN DE LA APLICACIÓN
# ============================================
APP_NAME=SeeControl
APP_VERSION=1.0.0
APP_ENV=development
APP_DEBUG=True
APP_HOST=0.0.0.0
APP_PORT=8000

# ============================================
# CONFIGURACIÓN DE LA BASE DE DATOS
# ============================================
DB_HOST=localhost
DB_PORT=5432
DB_NAME=seecontrol
DB_USER=seecontrol
DB_PASSWORD=seecontrol123
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10

# ============================================
# CONFIGURACIÓN DE REDIS
# ============================================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# ============================================
# CONFIGURACIÓN DE AUTENTICACIÓN
# ============================================
SECRET_KEY=tu-super-secreto-change-esto-en-produccion
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# ============================================
# CONFIGURACIÓN DE LLM PROVIDERS (BYOK)
# ============================================
# Proveedor por defecto
DEFAULT_PROVIDER=anthropic

# Anthropic
ANTHROPIC_API_KEY=sk-ant-tu-api-key-aqui
ANTHROPIC_API_URL=https://api.anthropic.com
ANTHROPIC_TIMEOUT=60

# OpenAI
OPENAI_API_KEY=sk-tu-api-key-aqui
OPENAI_API_URL=https://api.openai.com
OPENAI_TIMEOUT=60

# DeepSeek
DEEPSEEK_API_KEY=sk-tu-api-key-aqui
DEEPSEEK_API_URL=https://api.deepseek.com
DEEPSEEK_TIMEOUT=60

# Mistral
MISTRAL_API_KEY=tu-api-key-aqui
MISTRAL_API_URL=https://api.mistral.ai
MISTRAL_TIMEOUT=60

# Proveedores adicionales (opcionales)
GROQ_API_KEY=
GROQ_API_URL=https://api.groq.com

# Custom endpoint (opcional)
CUSTOM_LLM_ENDPOINT=
CUSTOM_LLM_API_KEY=

# ============================================
# CONFIGURACIÓN DE ORQUESTACIÓN
# ============================================
MASTER_AI_MODEL=claude-3-5-sonnet-20250620
MAX_PARALLEL_AGENTS=4
TOKEN_BUDGET=50000
ESCALATION_POLICY=notify_user
HEARTBEAT_INTERVAL=1500
MAX_TASK_RUNTIME_MINUTES=45
WEB_RESEARCH_LIMIT=50
FILE_ANALYSIS_LIMIT_MB=100

# ============================================
# CONFIGURACIÓN DE WEBSOCKET
# ============================================
WS_HOST=0.0.0.0
WS_PORT=8000
WS_PING_INTERVAL=30
WS_MAX_CONNECTIONS=100

# ============================================
# CONFIGURACIÓN DE CORREO (Opcional)
# ============================================
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=seecontrol@localhost

# ============================================
# CONFIGURACIÓN DE LOGGING
# ============================================
LOG_LEVEL=INFO
LOG_FORMAT=json
```

#### Configurar PostgreSQL

```bash
# Crear usuario y base de datos
sudo -u postgres psql -c "CREATE USER seecontrol WITH PASSWORD 'seecontrol123';"
sudo -u postgres psql -c "CREATE DATABASE seecontrol OWNER seecontrol;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE seecontrol TO seecontrol;"

# Habilitar extensiones
sudo -u postgres psql -d seecontrol -c "CREATE EXTENSION IF NOT EXISTS uuid-ossp;"
```

#### Ejecutar migraciones

```bash
# Primero, instalar Alembic (si no está instalado)
pip install alembic

# Inicializar Alembic (si es la primera vez)
alembic init migrations

# Configurar alembic.ini
# Asegúrate de que sqlalchemy.url apunte a tu PostgreSQL:
# sqlalchemy.url = postgresql+asyncpg://seecontrol:seecontrol123@localhost:5432/seecontrol

# Crear migraciones automáticas
alembic revision --autogenerate -m "Initial migration"

# Aplicar migraciones
alembic upgrade head
```

#### Iniciar servidor de desarrollo

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

El backend estará disponible en: `http://localhost:8000`

---

### 3. Configurar Frontend

#### Instalar dependencias

```bash
cd ../frontend
npm install
```

#### Configurar variables de entorno

Crear archivo `.env` en `/frontend/`:

```env
# Copiar el template si existe
cp .env.example .env
```

Editar `.env`:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
VITE_APP_NAME=SeeControl
VITE_APP_VERSION=1.0.0
VITE_ENV=development
```

#### Iniciar servidor de desarrollo

```bash
npm run dev
```

El frontend estará disponible en: `http://localhost:5173`

---

## 🎮 Acceder a la Plataforma

Abre tu navegador y ve a:
- **Backend API Docs**: http://localhost:8000/docs
- **Frontend**: http://localhost:5173

---

## 🧪 Pruebas

### Probar conexión WebSocket

1. Abre el frontend en http://localhost:5173
2. Ve a la página de Oficina Virtual
3. Deberías ver los agentes animados en tiempo real
4. Abre la consola del navegador (F12) y verifica que no hay errores de conexión WebSocket

### Probar API

```bash
# Listar agentes
curl -X GET http://localhost:8000/api/agents \
  -H "Authorization: Bearer TU_TOKEN_JWT"

# Crear un agente
curl -X POST http://localhost:8000/api/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -d '{
    "name": "Luna",
    "role": "Copywriter",
    "character_type": "luna",
    "status": "idle",
    "progress": 0
  }'
```

### Probar autenticación

```bash
# Registrar usuario
curl -X POST http://localhost:8000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@seecontrol.local",
    "password": "admin123",
    "workspace_name": "Mi Espacio",
    "role": "owner"
  }'

# Iniciar sesión
curl -X POST http://localhost:8000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@seecontrol.local",
    "password": "admin123"
  }'
```

---

## 📁 Estructura del Proyecto

```
seecontrol/
├── backend/                    # Servidor FastAPI
│   ├── app/                    # Código de la aplicación
│   │   ├── api/               # Endpoints REST
│   │   ├── config/            # Configuraciones
│   │   ├── models/            # Modelos SQLAlchemy
│   │   ├── schemas/           # Schemas Pydantic
│   │   ├── services/          # Lógica de negocio
│   │   ├── websocket/         # WebSocket handlers
│   │   └── main.py            # Punto de entrada
│   ├── requirements.txt        # Dependencias Python
│   ├── pyproject.toml         # Configuración del proyecto
│   └── .env.example            # Template de variables de entorno
│
├── frontend/                   # Aplicación React
│   ├── src/                   # Código fuente
│   │   ├── components/        # Componentes React
│   │   │   └── pixel-art/     # Componentes de pixel art
│   │   │       ├── PixelAgent.tsx    # Agente individual
│   │   │       └── PixelOffice.tsx   # Oficina completa
│   │   ├── pages/             # Páginas
│   │   ├── types/             # Tipos TypeScript
│   │   │   └── pixel-art.ts   # Tipos de pixel art
│   │   ├── assets/            # Assets estáticos
│   │   │   └── pixel-art/     # Sprites y recursos
│   │   │       ├── characters/       # Sprites de personajes
│   │   │       │   └── README.md     # Catálogo de personajes
│   │   │       └── office/           # Sprites de oficina
│   │   │           └── README.md     # Ambientes de oficina
│   │   ├── hooks/             # Custom hooks
│   │   ├── context/           # Context API
│   │   ├── utils/             # Utilidades
│   │   ├── index.css         # Estilos globales
│   │   └── App.tsx            # Aplicación principal
│   ├── package.json           # Dependencias npm
│   ├── vite.config.ts         # Configuración de Vite
│   └── tailwind.config.js     # Configuración de Tailwind
│
├── start.md                   # Este archivo - Instrucciones de setup
├── LICENSE                    # Licencia del proyecto
└── README.md                  # Documentación principal
```

---

## 🔧 Configuración de LLM Providers (BYOK)

SeeControl soporta **Bring Your Own Key** (BYOK), lo que significa que puedes usar tus propias API keys de diferentes proveedores.

### Proveedores Soportados

| Proveedor | Modelo Recomendado | API Key Required |
|-----------|-------------------|------------------|
| Anthropic | claude-3-5-sonnet-20250620 | ✅ |
| OpenAI | gpt-4o-mini | ✅ |
| DeepSeek | deepseek-chat | ✅ |
| Mistral | mistral-large | ✅ |
| Groq | llama-3.1-70b-versatile | ✅ |
| Custom | Cualquier endpoint | ✅ |

### Configurar múltiples proveedores

Edita el archivo `.env` en el backend:

```env
# Anthropic
ANTHROPIC_API_KEY=sk-ant-tu-api-key

# OpenAI
OPENAI_API_KEY=sk-tu-api-key

# DeepSeek
DEEPSEEK_API_KEY=sk-tu-api-key

# Mistral
MISTRAL_API_KEY=tu-api-key

# Groq
GROQ_API_KEY=tu-api-key
```

### Failover automático

El sistema intentará usar los proveedores en este orden:
1. Anthropic (si está configurado)
2. OpenAI (si está configurado)
3. DeepSeek (si está configurado)
4. Mistral (si está configurado)
5. Groq (si está configurado)
6. Custom endpoint (si está configurado)

Si un proveedor falla (timeout, error, quota excedida), el sistema automáticamente intentará con el siguiente.

---

## 🎨 Personalización de la Oficina Virtual

### Temas disponibles

SeeControl incluye 5 temas para la oficina virtual:

- **pixel**: Estilo GameBoy clásico (por defecto)
- **cyberpunk**: Estilo futurista con neón
- **minimal**: Estilo limpio y simple
- **dark**: Estilo oscuro
- **light**: Estilo claro

Para cambiar el tema, modifica la configuración del workspace:

```bash
# En el frontend, puedes cambiar el tema en el contexto
# o a través de la API del workspace
```

### Personajes disponibles

| Personaje | Rol | Personalidad | Color Principal |
|-----------|-----|--------------|----------------|
| Luna | Copywriter | Creativa, entusiasta | Rosa (#FF69B4) |
| Max | Developer | Analítico, metódico | Azul (#00BFFF) |
| Pixel | Designer | Artístico, perfeccionista | Verde (#32CD32) |
| Data | Data Analyst | Preciso, lógico | Cyan (#00FFFF) |
| Scout | Researcher | Curioso, persistente | Dorado (#FFD700) |
| Layout | Layout Assistant | Ordenado, eficiente | Naranja (#FFA500) |
| Boss | Orchestrator | Estratégico, sabio | Dorado (#FFD700) |
| Nex | Generalist | Adaptable, flexible | Verde (#00FF7F) |

### Crear un personaje personalizado

1. Crea un nuevo directorio en `/frontend/src/assets/pixel-art/characters/`:
   ```bash
   mkdir -p frontend/src/assets/pixel-art/characters/mipersonaje
   ```

2. Crea los sprites (16x32 o 32x32 píxeles) para cada estado:
   - `idle.png`
   - `working.png`
   - `thinking.png`
   - `blocked.png`
   - `completed.png`
   - `failed.png`

3. Agrega el personaje al catálogo en `/frontend/src/types/pixel-art.ts`:
   ```typescript
   export type CharacterType = 
     | 'luna' | 'max' | ... | 'mipersonaje'
   ```

---

## 🐛 Solución de Problemas

### Backend no inicia

**Problema:** Error de conexión a PostgreSQL

**Solución:**
```bash
# Verificar que PostgreSQL está corriendo
sudo systemctl status postgresql

# Iniciar PostgreSQL si no está corriendo
sudo systemctl start postgresql

# Verificar credenciales en .env
# Asegúrate de que DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD sean correctos
```

### Frontend no se conecta al backend

**Problema:** Error de CORS o conexión fallida

**Solución:**
```bash
# Verificar que el backend está corriendo
curl http://localhost:8000

# Verificar que el frontend apunta a la URL correcta
# En frontend/.env, asegúrate de que VITE_API_URL sea correcto

# Si usas Docker o diferentes puertos, actualiza las URLs
```

### WebSocket no se conecta

**Problema:** Conexión WebSocket fallida

**Solución:**
```bash
# Verificar que el backend soporta WebSocket
# En backend/.env, asegúrate de que WS_HOST y WS_PORT sean correctos

# Probar conexión WebSocket manualmente
# Usa una herramienta como wscat:
npm install -g wscat
wscat -c ws://localhost:8000/ws/office

# Verificar que no hay firewall bloqueando el puerto
```

### Animaciones no se ven

**Problema:** Los sprites no se animan

**Solución:**
```bash
# Verificar que los sprites existen en la ruta correcta
# Los sprites deben estar en /frontend/src/assets/pixel-art/characters/

# Si no tienes sprites reales, el sistema usa placeholders CSS
# que deberían funcionar igual

# Verificar que el componente PixelOffice está usando PixelAgent correctamente
```

---

## 📊 Endpoints de la API

### Autenticación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/users/register` | Registrar nuevo usuario |
| POST | `/api/users/login` | Iniciar sesión |
| GET | `/api/users/me` | Obtener información del usuario actual |

### Agentes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/agents` | Listar todos los agentes |
| GET | `/api/agents/{id}` | Obtener agente por ID |
| POST | `/api/agents` | Crear nuevo agente |
| PUT | `/api/agents/{id}` | Actualizar agente |
| DELETE | `/api/agents/{id}` | Eliminar agente |
| POST | `/api/agents/{id}/assign` | Asignar tarea a agente |

### Tareas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/tasks` | Listar todas las tareas |
| GET | `/api/tasks/{id}` | Obtener tarea por ID |
| POST | `/api/tasks` | Crear nueva tarea |
| PUT | `/api/tasks/{id}` | Actualizar tarea |
| DELETE | `/api/tasks/{id}` | Eliminar tarea |

### Skills

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/skills` | Listar todas las skills |
| GET | `/api/skills/{id}` | Obtener skill por ID |
| POST | `/api/skills` | Crear nueva skill |
| PUT | `/api/skills/{id}` | Actualizar skill |
| DELETE | `/api/skills/{id}` | Eliminar skill |

### Misiones

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/missions` | Listar todas las misiones |
| GET | `/api/missions/{id}` | Obtener misión por ID |
| POST | `/api/missions` | Crear nueva misión |
| PUT | `/api/missions/{id}` | Actualizar misión |

### WebSocket

| Endpoint | Descripción |
|----------|-------------|
| `/ws/office` | Conexión en tiempo real para la oficina virtual |
| `/ws/tasks` | Actualizaciones en tiempo real de tareas |

---

## 🎯 Próximos Pasos

1. **Configurar tus API keys de LLM** en el archivo `.env` del backend
2. **Crear tu primer workspace** a través del frontend o API
3. **Agregar agentes** con diferentes personajes y roles
4. **Crear tu primera tarea** y asignarla a un agente
5. **Observar la oficina virtual** y ver a los agentes trabajando

---

## 📚 Recursos Adicionales

- **Documentación de FastAPI**: https://fastapi.tiangolo.com/
- **Documentación de React**: https://react.dev/
- **Documentación de TypeScript**: https://www.typescriptlang.org/
- **Documentación de Tailwind CSS**: https://tailwindcss.com/
- **Documentación de Framer Motion**: https://www.framer.com/motion/

---

## 🤝 Contribuir

1. Haz fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Haz commit de tus cambios (`git commit -m 'Añade nueva funcionalidad'`)
4. Haz push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

---

## 📜 Licencia

Este proyecto está bajo la licencia MIT. Ver el archivo `LICENSE` para más detalles.

---

**¡Disfruta de SeeControl!** 🎮✨

Si tienes problemas o preguntas, crea un issue en el repositorio o revisa la documentación.
