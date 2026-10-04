import { useState } from 'react'
import type { LiveAgent, ChatMsg } from '../hooks/useLiveOffice'
import { FATIGUE_META, fatigueOf, PROVIDERS } from '../data/demo'
import { configuredProviders } from '../hooks/useLiveOffice'

interface Props {
  agents: LiveAgent[]
  chat: ChatMsg[]
  onSend: (text: string) => void
  onEdit: (id: string) => void
  onPause: (id: string) => void
  onResume: (id: string) => void
}

const GB = "'Press Start 2P', monospace"
const MONO = "ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace"

export function StudioPanel({ agents, chat, onSend, onEdit, onPause, onResume }: Props) {
  const [tab, setTab] = useState<'studio' | 'chat'>('studio')
  const [input, setInput] = useState('')
  const [model, setModel] = useState('Claude 3.5 Sonnet')

  const allowed = configuredProviders()
  const modelOptions = PROVIDERS.filter((p) => allowed.length === 0 || allowed.includes(p.id)).flatMap((p) =>
    p.models.split('/').map((m) => m.trim()),
  )
  const shownModel = modelOptions.includes(model) ? model : (modelOptions[0] ?? model)

  return (
    <div style={{ background: '#F5F2EA', borderRadius: 12, border: '2px solid #2A2A2A', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 560, overflow: 'hidden', color: '#1F2937', fontFamily: MONO }}>
      <div style={{ display: 'flex', gap: 6, padding: 10, borderBottom: '1px solid #E5E0D5' }}>
        {(['studio', 'chat'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 9,
              fontFamily: GB,
              background: tab === t ? '#111827' : '#E7E2D5',
              color: tab === t ? '#fff' : '#57534E',
            }}
          >
            {t === 'studio' ? '📦 STUDIO' : '💬 CHAT'}
          </button>
        ))}
      </div>

      {tab === 'studio' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
          {agents.map((a) => {
            const fat = fatigueOf(a.energy)
            const paused = a.status === 'paused'
            return (
              <div key={a.id} style={{ display: 'flex', gap: 8, padding: '8px 6px', borderBottom: '1px dashed #E5E0D5', alignItems: 'center' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: a.shirt, border: '2px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 13, color: '#111', flexShrink: 0 }}>
                  {a.name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12 }}>
                    <b style={{ color: FATIGUE_META[fat].color }}>{a.name}</b>{' '}
                    <span style={{ color: '#78716C' }}>({a.role})</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#57534E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.meeting ? '☕ en reunión' : a.resting ? '😴 en descanso' : paused ? '⏸ en pausa' : a.status === 'blocked' ? '🚩 bloqueado' : a.task || a.log} ·{' '}
                    <span style={{ color: FATIGUE_META[fat].color, fontWeight: 'bold' }}>{Math.round(a.energy)}%</span>
                  </div>
                </div>
                <button
                  title={paused ? 'Reanudar' : 'Detener actividad'}
                  onClick={() => (paused ? onResume(a.id) : onPause(a.id))}
                  style={{ border: '1px solid #D6D0BF', background: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 12, padding: '2px 6px', flexShrink: 0 }}
                >
                  {paused ? '▶' : '⏸'}
                </button>
                <button
                  title="Configurar agente"
                  onClick={() => onEdit(a.id)}
                  style={{ border: '1px solid #D6D0BF', background: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 12, padding: '2px 6px', flexShrink: 0 }}
                >
                  ⚙
                </button>
              </div>
            )
          })}
          <div style={{ fontSize: 11, color: '#78716C', padding: '8px 6px' }}>
            💡 ⚙ edita rol, skills, modelo y aspecto · ⏸ detiene su actividad
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {chat.map((m) => (
            <div key={m.id} style={{ alignSelf: m.mine ? 'flex-end' : 'flex-start', maxWidth: '90%', background: m.mine ? '#111827' : '#fff', color: m.mine ? '#fff' : '#1F2937', border: '1px solid #E5E0D5', borderRadius: 10, padding: '6px 10px', fontSize: 12 }}>
              {!m.mine && (
                <div style={{ fontSize: 11, marginBottom: 2 }}>
                  <b style={{ color: '#EA580C' }}>{m.from}</b>{' '}
                  <span style={{ color: '#A8A29E' }}>{m.role}</span>
                </div>
              )}
              {m.text}
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: 10, borderTop: '1px solid #E5E0D5', background: '#EFEAD9' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSend(input)
                setInput('')
              }
            }}
            placeholder="Describe una misión: ej. «Portal cliente Q4»"
            style={{ flex: 1, border: '1px solid #D6D0BF', borderRadius: 8, padding: '8px 10px', fontSize: 12, background: '#fff', color: '#111', fontFamily: MONO }}
          />
          <button
            onClick={() => {
              onSend(input)
              setInput('')
            }}
            style={{ background: '#111827', color: '#fff', border: 'none', borderRadius: 8, padding: '0 14px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ↑
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', fontSize: 11, color: '#78716C' }}>
          <span>🧠</span>
          <select value={shownModel} onChange={(e) => setModel(e.target.value)} style={{ flex: 1, border: '1px solid #D6D0BF', borderRadius: 6, padding: 4, fontSize: 11, background: '#fff', fontFamily: MONO }}>
            {modelOptions.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          {allowed.length > 0 && <span title="Solo proveedores BYOK configurados">🔑</span>}
        </div>
      </div>
    </div>
  )
}
