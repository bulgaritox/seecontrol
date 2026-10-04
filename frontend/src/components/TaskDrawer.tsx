import { useState } from 'react'
import type { LiveTask, LiveAgent } from '../hooks/useLiveOffice'
import { FATIGUE_META, fatigueOf } from '../data/demo'

interface Props {
  task: LiveTask
  agent?: LiveAgent
  onClose: () => void
  onControl: (id: string, action: 'pause' | 'resume' | 'complete') => void
  onExtend: (id: string, note: string) => void
}

const GB = "'Press Start 2P', monospace"
const MONO = "ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace"

interface Msg {
  id: number
  from: string
  text: string
  mine?: boolean
}
let seq = 1000

function loadThread(id: string): Msg[] {
  try {
    return JSON.parse(localStorage.getItem(`sc_taskchat_${id}`) ?? '[]') as Msg[]
  } catch {
    return []
  }
}

export function TaskDrawer({ task, agent, onClose, onControl, onExtend }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>(() => loadThread(task.id))
  const [input, setInput] = useState('')

  const persist = (m: Msg[]) => {
    setMsgs(m)
    try {
      localStorage.setItem(`sc_taskchat_${task.id}`, JSON.stringify(m.slice(-40)))
    } catch {
      /* noop */
    }
  }

  const send = (text: string) => {
    const clean = text.trim()
    if (!clean) return
    const next = [...msgs, { id: seq++, from: 'Tú', text: clean, mine: true }]
    persist(next)
    const who = agent?.name ?? 'Boss'
    window.setTimeout(() => {
      persist([...next, { id: seq++, from: who, text: `Anotado para «${task.title}»: ${clean.slice(0, 80)}${clean.length > 80 ? '…' : ''} — usa “Extender tarea” para sumarlo al alcance. ✅` }])
    }, 800)
    setInput('')
  }

  const running = task.status === 'in_progress'
  const fat = agent ? fatigueOf(agent.energy) : null

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 360, maxWidth: '94vw', background: '#141414', borderLeft: '2px solid #333', zIndex: 55, display: 'flex', flexDirection: 'column', fontFamily: MONO }}>
      <div style={{ padding: 12, borderBottom: '1px solid #2A2A2A' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ fontFamily: GB, fontSize: 10, color: '#fff' }}>🗂 TAREA</div>
          <button onClick={onClose} style={{ background: '#262626', color: '#fff', border: '1px solid #333', borderRadius: 6, cursor: 'pointer', padding: '4px 10px' }}>✕</button>
        </div>
        <div style={{ fontSize: 14, fontWeight: 'bold', color: '#fff', marginTop: 6 }}>{task.title}</div>
        <div style={{ fontSize: 11, color: '#A8A29E', marginTop: 4, whiteSpace: 'pre-wrap' }}>{task.desc}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, fontSize: 11, color: '#78716C' }}>
          <span style={{ textTransform: 'uppercase' }}>{task.priority}</span>
          <span>·</span>
          <b style={{ color: '#fff' }}>{task.status}</b>
          <span>·</span>
          <span>{task.progress}%</span>
          {agent && (
            <>
              <span>·</span>
              <span style={{ color: FATIGUE_META[fat!].color, fontWeight: 'bold' }}>{agent.name}</span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {running ? (
            <button onClick={() => onControl(task.id, 'pause')} style={{ flex: 1, fontSize: 12, fontFamily: MONO, fontWeight: 'bold', background: '#451A03', color: '#FBBF24', border: 'none', borderRadius: 8, padding: '8px 0', cursor: 'pointer' }}>
              ⏸ Detener ejecución
            </button>
          ) : (
            task.status !== 'completed' && (
              <button onClick={() => onControl(task.id, 'resume')} style={{ flex: 1, fontSize: 12, fontFamily: MONO, fontWeight: 'bold', background: '#052E16', color: '#22C55E', border: 'none', borderRadius: 8, padding: '8px 0', cursor: 'pointer' }}>
                ▶ Continuar
              </button>
            )
          )}
          {task.status !== 'completed' && (
            <button onClick={() => onControl(task.id, 'complete')} style={{ flex: 1, fontSize: 12, fontFamily: MONO, background: '#1E3A8A', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', cursor: 'pointer' }}>
              ✓ Completar
            </button>
          )}
        </div>
      </div>

      <div style={{ fontSize: 10, fontFamily: GB, color: '#78716C', padding: '10px 12px 0' }}>💬 CHAT DE LA TAREA</div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {msgs.length === 0 && <div style={{ fontSize: 12, color: '#57534E' }}>Sin mensajes. Coordina aquí con {agent?.name ?? 'el equipo'} sobre esta tarea.</div>}
        {msgs.map((m) => (
          <div key={m.id} style={{ alignSelf: m.mine ? 'flex-end' : 'flex-start', maxWidth: '90%', background: m.mine ? '#1E3A8A' : '#1E1E1E', color: '#fff', border: '1px solid #333', borderRadius: 10, padding: '6px 10px', fontSize: 12 }}>
            {!m.mine && <div style={{ fontSize: 11, color: '#FBBF24', marginBottom: 2 }}><b>{m.from}</b></div>}
            {m.text}
          </div>
        ))}
      </div>

      <div style={{ padding: 12, borderTop: '1px solid #2A2A2A' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send(input)
            }}
            placeholder={`Escribe a ${agent?.name ?? 'Boss'} sobre esta tarea…`}
            style={{ flex: 1, background: '#111', border: '1px solid #333', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#fff', fontFamily: MONO }}
          />
          <button onClick={() => send(input)} style={{ background: '#262626', color: '#fff', border: '1px solid #333', borderRadius: 8, padding: '0 14px', cursor: 'pointer', fontWeight: 'bold' }}>↑</button>
        </div>
        <button
          onClick={() => {
            const last = [...msgs].reverse().find((m) => m.mine)?.text ?? ''
            if (last) onExtend(task.id, last)
          }}
          title="Suma tu último mensaje al alcance (descripción) de la tarea en el backend"
          style={{ width: '100%', marginTop: 8, fontSize: 12, fontFamily: MONO, fontWeight: 'bold', background: '#052E16', color: '#22C55E', border: '1px solid #14532D', borderRadius: 8, padding: '8px 0', cursor: 'pointer' }}
        >
          ➕ Extender tarea con este chat
        </button>
      </div>
    </div>
  )
}
