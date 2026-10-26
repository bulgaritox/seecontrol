import { useMemo, useState } from 'react'
import type { LiveTask, LiveAgent } from '../hooks/useLiveOffice'
import { FATIGUE_META, fatigueOf } from '../data/demo'

interface Props {
  tasks: LiveTask[]
  agents: LiveAgent[]
  onApprove: (id: string) => void
  onTaskControl: (id: string, action: 'pause' | 'resume' | 'complete') => void
  onOpenTask: (id: string) => void
  onDeleteTask: (id: string) => void
  onDeleteProject: (projectId: string, projectName?: string) => void
}

const GB = "'Press Start 2P', monospace"

const COLUMNS: { id: string; title: string; match: string[]; accent: string }[] = [
  { id: 'backlog', title: 'BACKLOG / POR HACER', match: ['pending', 'paused'], accent: '#6B7280' },
  { id: 'progress', title: 'EN PROGRESO', match: ['in_progress'], accent: '#3B82F6' },
  { id: 'done', title: 'REVISIÓN / LISTO', match: ['completed', 'failed', 'blocked'], accent: '#22C55E' },
]

const NO_PROJECT = '__sin_proyecto__'

interface ProjectGroup {
  id: string          // projectId o NO_PROJECT
  name: string
  brief?: string
  tasks: LiveTask[]
}

function statusLabel(status: string): string {
  if (status === 'in_progress') return 'Compilando…'
  if (status === 'completed') return 'Entregado ✓'
  if (status === 'blocked') return 'Bloqueado 🚩'
  return 'En cola'
}

function TaskCard({
  t, accent, agents, onApprove, onTaskControl, onOpenTask, onDeleteTask,
}: {
  t: LiveTask
  accent: string
  agents: LiveAgent[]
  onApprove: (id: string) => void
  onTaskControl: (id: string, action: 'pause' | 'resume' | 'complete') => void
  onOpenTask: (id: string) => void
  onDeleteTask: (id: string) => void
}) {
  const ag = agents.find((a) => a.name === t.agentName)
  const fat = fatigueOf(t.energy)
  const needsApproval = t.status === 'pending' && (t.priority === 'high' || t.priority === 'urgent')
  return (
    <div style={{ background: '#1E1E1E', border: '1px solid #333', borderLeft: `4px solid ${accent}`, borderRadius: 8, padding: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <div onClick={() => onOpenTask(t.id)} title="Abrir chat de la tarea" style={{ fontSize: 13, fontWeight: 'bold', color: '#fff', marginBottom: 4, cursor: 'pointer', flex: 1 }}>
          💬 {t.title}
        </div>
        <button
          onClick={() => {
            if (window.confirm(`¿Eliminar la tarea «${t.title}»?`)) onDeleteTask(t.id)
          }}
          title="Eliminar tarea"
          style={{ fontSize: 12, background: '#2A1212', color: '#F87171', border: '1px solid #7F1D1D', borderRadius: 6, padding: '2px 7px', cursor: 'pointer', flexShrink: 0 }}
        >
          🗑
        </button>
      </div>
      {t.roleLabel && (
        <span style={{ display: 'inline-block', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5, color: '#FDE68A', background: '#422006', border: '1px solid #854D0E', borderRadius: 5, padding: '1px 6px', marginBottom: 6 }}>
          {t.roleLabel}
        </span>
      )}
      {ag && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#D6D3D1', marginBottom: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: ag.shirt, border: '1px solid #000', display: 'inline-block' }} />
          ■ <b style={{ color: FATIGUE_META[fatigueOf(ag.energy)].color }}>{ag.name}</b> <span style={{ color: '#78716C' }}>({ag.provider})</span>
        </div>
      )}
      {t.model && (
        <div
          title={`Modelo usado para esta tarea: ${t.provider ? `${t.provider}/` : ''}${t.model}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#C4B5FD', background: '#2E1065', border: '1px solid #4C1D95', borderRadius: 6, padding: '2px 7px', marginBottom: 6, maxWidth: '100%', overflow: 'hidden' }}
        >
          🧠 <b style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.provider ? `${t.provider}/` : ''}{t.model}</b>
        </div>
      )}
      <div style={{ fontSize: 11, color: '#A8A29E', fontStyle: 'italic', marginBottom: 6 }}>
        ■ Status: “{statusLabel(t.status)}”
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: needsApproval ? 8 : 0 }}>
        <span style={{ color: '#78716C' }}>■ Energía:</span>
        <div style={{ flex: 1, height: 6, background: '#333', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, t.energy)}%`, height: '100%', background: FATIGUE_META[fat].color }} />
        </div>
        <b style={{ color: FATIGUE_META[fat].color }}>{Math.round(t.energy)}% ({FATIGUE_META[fat].label})</b>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <span style={{ fontSize: 10, color: '#78716C', textTransform: 'uppercase' }}>{t.priority} · {t.progress}%</span>
        <span style={{ display: 'flex', gap: 4 }}>
          {t.status === 'in_progress' && (
            <button onClick={() => onTaskControl(t.id, 'pause')} title="Detener ejecución" style={{ fontSize: 11, background: '#451A03', color: '#FBBF24', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
              ⏸
            </button>
          )}
          {['pending', 'paused', 'blocked'].includes(t.status) && (
            <button onClick={() => onTaskControl(t.id, 'resume')} title="Continuar" style={{ fontSize: 11, background: '#052E16', color: '#22C55E', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
              ▶
            </button>
          )}
          {needsApproval && (
            <button onClick={() => onApprove(t.id)} style={{ fontSize: 11, fontWeight: 'bold', background: '#22C55E', color: '#052E16', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
              ✓ Aprobar (humano)
            </button>
          )}
        </span>
      </div>
    </div>
  )
}

export function KanbanBoard({ tasks, agents, onApprove, onTaskControl, onOpenTask, onDeleteTask, onDeleteProject }: Props) {
  const resting = agents.filter((a) => a.resting)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [filterProject, setFilterProject] = useState<string>('__all__')

  // Agrupar tareas por proyecto. Las que no tienen proyecto van a un grupo genérico.
  const groups = useMemo<ProjectGroup[]>(() => {
    const map = new Map<string, ProjectGroup>()
    for (const t of tasks) {
      const key = t.projectId ?? NO_PROJECT
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: t.projectName ?? (key === NO_PROJECT ? 'Tareas sueltas (sin proyecto)' : t.projectName ?? 'Proyecto'),
          brief: t.projectBrief,
          tasks: [],
        })
      }
      const g = map.get(key)!
      if (!g.brief && t.projectBrief) g.brief = t.projectBrief
      g.tasks.push(t)
    }
    // Proyectos reales primero, "sin proyecto" al final
    return Array.from(map.values()).sort((a, b) => {
      if (a.id === NO_PROJECT) return 1
      if (b.id === NO_PROJECT) return -1
      return 0
    })
  }, [tasks])

  const visibleGroups = filterProject === '__all__' ? groups : groups.filter((g) => g.id === filterProject)

  return (
    <div>
      {/* Barra de filtro por proyecto */}
      {groups.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, background: '#141414', border: '1px solid #2A2A2A', borderRadius: 10, padding: '8px 12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontFamily: GB, color: '#A5B4FC' }}>🗂 FILTRAR POR PROYECTO</span>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            style={{ background: '#1A1A1A', color: '#fff', border: '1px solid #312E81', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontFamily: 'monospace', cursor: 'pointer' }}
          >
            <option value="__all__">Todos los proyectos ({groups.length})</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name} ({g.tasks.length})</option>
            ))}
          </select>
          {filterProject !== '__all__' && (
            <button
              onClick={() => setFilterProject('__all__')}
              style={{ fontSize: 11, background: '#1E1B4B', color: '#C7D2FE', border: '1px solid #312E81', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}
            >
              ✕ Quitar filtro
            </button>
          )}
        </div>
      )}

      {groups.length === 0 && (
        <div style={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 10, padding: 24, textAlign: 'center', color: '#57534E', fontSize: 13 }}>
          No hay tareas todavía. Lanza una misión desde el Studio y Boss creará un proyecto.
        </div>
      )}

      {visibleGroups.map((g) => {
        const isCollapsed = collapsed[g.id]
        const done = g.tasks.filter((t) => t.status === 'completed').length
        return (
          <div key={g.id} style={{ marginBottom: 16, background: '#101010', border: '1px solid #2A2A2A', borderRadius: 12, overflow: 'hidden' }}>
            {/* Cabecera del proyecto */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'linear-gradient(90deg,#1E1B4B,#0F0F0F)', borderBottom: '1px solid #312E81' }}>
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [g.id]: !c[g.id] }))}
                title={isCollapsed ? 'Expandir' : 'Colapsar'}
                style={{ background: '#1A1A1A', color: '#A5B4FC', border: '1px solid #312E81', borderRadius: 6, cursor: 'pointer', padding: '2px 8px', fontSize: 12, flexShrink: 0 }}
              >
                {isCollapsed ? '▶' : '▼'}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontFamily: GB, color: '#C7D2FE' }}>📁 {g.name}</span>
                  <span style={{ fontSize: 10, color: '#818CF8', background: '#1E1B4B', border: '1px solid #312E81', borderRadius: 10, padding: '1px 8px' }}>
                    {g.tasks.length} tareas · {done} listas
                  </span>
                </div>
                {g.brief && (
                  <div title={g.brief} style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    📋 {g.brief}
                  </div>
                )}
              </div>
              {g.id !== NO_PROJECT && (
                <button
                  onClick={() => {
                    if (window.confirm(`¿Eliminar el proyecto «${g.name}» y sus ${g.tasks.length} tareas?`)) {
                      onDeleteProject(g.id, g.name)
                    }
                  }}
                  title="Eliminar proyecto completo"
                  style={{ fontSize: 11, background: '#2A1212', color: '#F87171', border: '1px solid #7F1D1D', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', flexShrink: 0 }}
                >
                  🗑 Proyecto
                </button>
              )}
            </div>

            {/* Columnas del proyecto */}
            {!isCollapsed && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: 12 }}>
                {COLUMNS.map((col) => {
                  const colTasks = g.tasks.filter((t) => col.match.includes(t.status))
                  return (
                    <div key={col.id} style={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 10, padding: 10, minHeight: 120 }}>
                      <div style={{ fontSize: 10, fontWeight: 'bold', letterSpacing: 1, color: col.accent, borderBottom: `2px solid ${col.accent}`, paddingBottom: 8, marginBottom: 10, fontFamily: GB }}>
                        {col.title}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {colTasks.map((t) => (
                          <TaskCard
                            key={t.id}
                            t={t}
                            accent={col.accent}
                            agents={agents}
                            onApprove={onApprove}
                            onTaskControl={onTaskControl}
                            onOpenTask={onOpenTask}
                            onDeleteTask={onDeleteTask}
                          />
                        ))}
                        {colTasks.length === 0 && (
                          <div style={{ fontSize: 12, color: '#57534E', textAlign: 'center', padding: 12 }}>— vacío —</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Sala de descanso */}
      <div style={{ marginTop: 12, background: '#141414', border: '1px dashed #7C3AED', borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 'bold', letterSpacing: 1, color: '#A78BFA', marginBottom: 8, fontFamily: GB }}>
          🛋 SALA DE DESCANSO {resting.length > 0 ? `(${resting.length})` : ''}
        </div>
        {resting.length === 0 ? (
          <div style={{ fontSize: 12, color: '#57534E' }}>Todos los agentes están operativos. El burnout (≥90% energía) los trae aquí a recargar.</div>
        ) : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {resting.map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1E1E1E', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#fff' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: a.shirt, display: 'inline-block' }} />
                ■ {a.name} (Burnout)
                <span style={{ color: '#A78BFA' }}>■ Recargando… {Math.round(a.energy)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
