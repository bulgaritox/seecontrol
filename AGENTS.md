# AGENTS.md — Convenciones para asistentes de IA y devs (seecontrol)

Este archivo recoge las reglas de trabajo del proyecto para cualquier agente de IA
(Kiro, Claude Code, opencode, Cursor, etc.) y como referencia para el equipo.
Las mismas reglas están en `.kiro/steering/` para Kiro.

## Git (importante)

- **Ramas**: nunca crear ramas adicionales de forma automática. Trabaja siempre sobre
  la rama actual. Crea una rama solo si la persona lo pide explícitamente.
- **Commits**: no hacer un commit por cada pequeño ajuste, mejora o corrección. No
  llenar el repositorio de commits.
  - Como máximo **un commit por día/sesión de trabajo**.
  - Excepción: si el cambio toca frontend y backend por separado, se permite **un
    commit para frontend y uno para backend** (máximo dos), nunca más.
  - Ante la duda, **dejar el commit en manos de la persona** (no commitear solo).
  - Preferir agrupar cambios relacionados en un commit en vez de fragmentarlos.
- **Pull antes de trabajar**: ejecutar `git pull` antes de iniciar cualquier ajuste,
  para traer las últimas actualizaciones y evitar conflictos de merge.
- **Push**: no hacer push salvo petición explícita de la persona.

## Prioridad de esfuerzo

- Enfocar el esfuerzo en **lógica, contexto y desarrollo** (crear/editar archivos del
  proyecto, diseñar e implementar funcionalidad).
- Dedicar a **tests y pruebas** lo mínimo necesario para validar que lo implementado
  funciona. No añadir suites de tests extensas por iniciativa propia.

## Límites de ejecución (este proyecto)

- Máximo de sub-agentes simultáneos: **3**.
- Máximo de workflows/flujos en paralelo: **3**.

## Arranque rápido (dev)

Backend (FastAPI, puerto 8000):

```powershell
cd backend
python -m venv venv            # primera vez
.\venv\Scripts\activate
pip install -r requirements.txt  # primera vez
# Para desarrollo local sin Postgres, poner USE_SQLITE=true en backend/.env
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend (React + Vite, puerto 5173):

```powershell
cd frontend
npm install                    # primera vez
npm run dev
```

- UI: http://localhost:5173 · API docs: http://localhost:8000/docs
- Las claves de LLM (BYOK) viven en `backend/.env` (no se commitea) o en el panel
  BYOK del frontend (localStorage). Nunca subas claves reales al repo.
