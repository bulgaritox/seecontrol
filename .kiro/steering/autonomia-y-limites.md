---
inclusion: always
---

# Autonomía y límites de ejecución (proyecto seecontrol)

## Objetivo de autonomía
- Trabaja de principio a fin de forma autónoma. El usuario puede entregar una tarea,
  ausentarse, y al volver debe encontrarla terminada.
- Evita pausas y confirmaciones innecesarias. No interrumpas el avance para pedir
  permiso en acciones de bajo o medio riesgo (editar/crear archivos, correr tests,
  builds, linters, instalar dependencias del proyecto).
- Solo detente a confirmar en acciones de ALTO riesgo e irreversibles: borrado masivo
  de archivos/directorios, cambios en producción, operaciones destructivas sobre bases
  de datos, o modificación de autenticación/autorización. Estas confirmaciones son de
  seguridad y se mantienen siempre.

## Límites de ejecución (este proyecto)
- Máximo de sub-agentes ejecutándose simultáneamente: **3**.
- Máximo de workflows / flujos de trabajo en paralelo: **3**.
- Si una tarea requeriría superar estos límites, encola el trabajo y procésalo por
  lotes respetando el tope, en lugar de lanzar más ejecuciones a la vez.

## Prioridad de esfuerzo
- Enfoca la mayor parte del esfuerzo en **lógica, contexto y desarrollo**:
  creación y edición de archivos del proyecto, diseño e implementación de
  funcionalidad.
- Dedica a **tests y pruebas** el mínimo necesario para validar que lo implementado
  funciona. No inviertas tiempo excesivo ni seas exhaustivo con la cobertura de
  pruebas salvo que el usuario lo pida explícitamente.
- No añadas suites de tests extensas por iniciativa propia. Un check rápido de que el
  build compila y de que el camino principal funciona es suficiente.

## Reglas de Git (importantes — aplican a todo asistente de IA y a todo dev)

Estas reglas son el convenio del proyecto seecontrol. Aplican a cualquier agente de IA
(Kiro, Claude Code, opencode, etc.) y sirven de referencia para el equipo.

- **Ramas**: NUNCA crear ramas adicionales de forma automática. Trabajar siempre sobre
  la rama actual. Crear una rama solo si la persona lo solicita explícitamente.

- **Commits**: NO hacer un commit por cada pequeño ajuste, mejora o corrección. No
  llenar el repositorio de commits. Convenio:
  - Como máximo **un commit por día/sesión de trabajo**.
  - Excepción: si el cambio toca frontend y backend por separado, se permite **un
    commit para frontend y uno para backend** (máximo dos), nunca más.
  - Ante la duda, **dejar el commit en manos de la persona** (no commitear
    automáticamente) para que lo haga manualmente.
  - Preferir agrupar cambios relacionados en un solo commit en lugar de fragmentarlos.
  - Esto protege el historial del repo y evita conflictos de merge entre devs.

- **Pull antes de trabajar**: antes de iniciar cualquier ajuste, ejecutar `git pull`
  para traer siempre las últimas actualizaciones del proyecto y evitar conflictos.

- **Push**: no hacer push salvo petición explícita de la persona.
