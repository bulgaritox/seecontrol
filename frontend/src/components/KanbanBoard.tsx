import type { LiveTask, LiveAgent } from '../hooks/useLiveOffice'
import { FATIGUE_META, fatigueOf } from '../data/demo'

interface Props {
  tasks: LiveTask[]
  agents: LiveAgent[]
  onApprove: (id: string) => void
  onTaskControl: (id: string, action: 'pause' | 'resume' | 'complete') => void
  onOpenTask: (id: string) => void
}

const COLUMNS: { id: string; title: string; match: string[]; accent: string }[] = [
  { id: 'backlog', title: 'BACKLOG / POR HACER', match: ['pending', 'paused'], accent: '#6B7280' },
  { id: 'progress', title: 'EN PROGRESO', match: ['in_progress'], accent: '#3B82F6' },
  { id: 'done', title: 'REVISIÓN / LISTO', match: ['completed', 'failed', 'blocked'], accent: '#22C55E' },
]

export function KanbanBoard({ tasks, agents, onApprove, onTaskControl, onOpenTask }: Props) {
  const resting = agents.filter((a) => a.resting)
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {COLUMNS.map((col) => (
          <div key={col.id} style={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 10, padding: 10, minHeight: 300 }}>
            <div style={{ fontSize: 10, fontWeight: 'bold', letterSpacing: 1, color: col.accent, borderBottom: `2px solid ${col.accent}`, paddingBottom: 8, marginBottom: 10, fontFamily: "'Press Start 2P', monospace" }}>
              {col.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tasks.filter((t) => col.match.includes(t.status)).map((t) => {
                const ag = agents.find((a) => a.name === t.agentName)
                const fat = fatigueOf(t.energy)
                const needsApproval = t.status === 'pending' && (t.priority === 'high' || t.priority === 'urgent')
                return (
                  <div key={t.id} style={{ background: '#1E1E1E', border: '1px solid #333', borderLeft: `4px solid ${col.accent}`, borderRadius: 8, padding: 10 }}>
                    <div onClick={() => onOpenTask(t.id)} title="Abrir chat de la tarea" style={{ fontSize: 13, fontWeight: 'bold', color: '#fff', marginBottom: 4, cursor: 'pointer' }}>
                      💬 {t.title}
                    </div>
                    {ag && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#D6D3D1', marginBottom: 4 }}>
                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: ag.shirt, border: '1px solid #000', display: 'inline-block' }} />
                        ■ <b style={{ color: FATIGUE_META[fatigueOf(ag.energy)].color }}>{ag.name}</b> <span style={{ color: '#78716C' }}>({ag.provider})</span>
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: '#A8A29E', fontStyle: 'italic', marginBottom: 6 }}>
                      ■ Status: “{t.status === 'in_progress' ? 'Compilando…' : t.status === 'completed' ? 'Entregado ✓' : t.status === 'blocked' ? 'Bloqueado 🚩' : 'En cola'}”
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: needsApproval ? 8 : 0 }}>
                      <span style={{ color: '#78716C' }}>■ Energía:</span>
                      <div style={{ flex: 1, height: 6, background: '#333', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, t.energy)}%`, height: '100%', background: FATIGUE_META[fat].color }} />
                      </div>
                      <b style={{ color: FATIGUE_META[fat].color }}>{Math.round(t.energy)}% ({FATIGUE_META[fat].label})</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
              })}
              {tasks.filter((t) => col.match.includes(t.status)).length === 0 && (
                <div style={{ fontSize: 12, color: '#57534E', textAlign: 'center', padding: 16 }}>— vacío —</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Sala de descanso */}
      <div style={{ marginTop: 12, background: '#141414', border: '1px dashed #7C3AED', borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 'bold', letterSpacing: 1, color: '#A78BFA', marginBottom: 8, fontFamily: "'Press Start 2P', monospace" }}>
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
