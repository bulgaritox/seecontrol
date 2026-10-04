import { useState } from 'react'
import type { LiveAgent, ChatMsg } from '../hooks/useLiveOffice'
import { FATIGUE_META, fatigueOf, PROVIDERS, PROVIDER_MODELS } from '../data/demo'
import { configuredProviders } from '../hooks/useLiveOffice'

interface Props {
  agents: LiveAgent[]
  chat: ChatMsg[]
  onSend: (text: string) => void
  onEdit: (id: string) => void
  onPause: (id: string) => void
  onResume: (id: string) => void
  onTogglePower: (id: string) => void
  onAddAgent: (input: { name: string; role: string; provider: string; model: string }) => void
}

const GB = "'Press Start 2P', monospace"
const MONO = "ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace"

export function StudioPanel({ agents, chat, onSend, onEdit, onPause, onResume, onTogglePower, onAddAgent }: Props) {
  const [tab, setTab] = useState<'studio' | 'chat'>('studio')
  const [input, setInput] = useState('')
  const [provider, setProvider] = useState('anthropic')
  const [model, setModel] = useState('claude-3-5-sonnet-latest')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newProvider, setNewProvider] = useState('mistral')

  const allowed = configuredProviders()
  const providerOptions = PROVIDERS.filter((p) => allowed.length === 0 || allowed.includes(p.id))
  const shownProvider = providerOptions.some((p) => p.id === provider) ? provider : (providerOptions[0]?.id ?? provider)
  const modelOptions = PROVIDER_MODELS[shownProvider] ?? []
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
          <button
            onClick={() => setAdding((v) => !v)}
            style={{ width: '100%', fontSize: 12, fontFamily: MONO, fontWeight: 'bold', background: adding ? '#1E1E1E' : '#052E16', color: adding ? '#A8A29E' : '#22C55E', border: '1px solid #14532D', borderRadius: 8, padding: '7px 0', cursor: 'pointer', marginBottom: 6 }}
          >
            {adding ? '✕ Cancelar' : '＋ Agregar agente'}
          </button>
          {adding && (
            <div style={{ background: '#fff', border: '1px solid #D6D0BF', borderRadius: 8, padding: 8, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre (ej. Nova)" style={{ border: '1px solid #D6D0BF', borderRadius: 6, padding: '6px 8px', fontSize: 12, fontFamily: MONO }} />
              <input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="Rol (ej. QA Tester)" style={{ border: '1px solid #D6D0BF', borderRadius: 6, padding: '6px 8px', fontSize: 12, fontFamily: MONO }} />
              <select value={newProvider} onChange={(e) => setNewProvider(e.target.value)} style={{ border: '1px solid #D6D0BF', borderRadius: 6, padding: 6, fontSize: 11, fontFamily: MONO, background: '#fff' }}>
                {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button
                onClick={() => {
                  if (!newName.trim() || !newRole.trim()) return
                  onAddAgent({ name: newName.trim(), role: newRole.trim(), provider: newProvider, model: (PROVIDER_MODELS[newProvider] ?? [''])[0] ?? '' })
                  setNewName('')
                  setNewRole('')
                  setAdding(false)
                }}
                style={{ fontSize: 12, fontFamily: MONO, fontWeight: 'bold', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 0', cursor: 'pointer' }}
              >
                Crear en backend ✓
              </button>
            </div>
          )}
          {agents.map((a) => {
            const fat = fatigueOf(a.energy)
            const paused = a.status === 'paused'
            return (
              <div key={a.id} style={{ display: 'flex', gap: 8, padding: '8px 6px', borderBottom: '1px dashed #E5E0D5', alignItems: 'center', opacity: a.is_active ? 1 : 0.55 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: a.shirt, border: '2px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 13, color: '#111', flexShrink: 0, filter: a.is_active ? 'none' : 'grayscale(1)' }}>
                  {a.is_active ? a.name[0] : '💤'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12 }}>
                    <b style={{ color: a.is_active ? FATIGUE_META[fat].color : '#9CA3AF' }}>{a.name}</b>{' '}
                    <span style={{ color: '#78716C' }}>({a.role})</span>
                    {!a.is_active && <span style={{ fontSize: 10, color: '#9CA3AF' }}> · OFF</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#57534E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {!a.is_active ? 'apagado' : a.meeting ? '☕ en reunión' : a.resting ? '😴 en descanso' : paused ? '⏸ en pausa' : a.status === 'blocked' ? '🚩 bloqueado' : a.task || a.log} ·{' '}
                    <span style={{ color: FATIGUE_META[fat].color, fontWeight: 'bold' }}>{Math.round(a.energy)}%</span>
                  </div>
                </div>
                <button
                  title={a.is_active ? 'Apagar agente' : 'Encender agente'}
                  onClick={() => onTogglePower(a.id)}
                  style={{ border: '1px solid #D6D0BF', background: a.is_active ? '#052E16' : '#F3F4F6', color: a.is_active ? '#22C55E' : '#9CA3AF', borderRadius: 6, cursor: 'pointer', fontSize: 12, padding: '2px 6px', flexShrink: 0 }}
                >
                  ⏻
                </button>
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
          <select
            value={shownProvider}
            onChange={(e) => {
              const p = e.target.value
              setProvider(p)
              setModel((PROVIDER_MODELS[p] ?? [])[0] ?? '')
            }}
            title="Proveedor (primero)"
            style={{ flex: 1, border: '1px solid #D6D0BF', borderRadius: 6, padding: 4, fontSize: 11, background: '#fff', fontFamily: MONO }}
          >
            {providerOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select value={shownModel} onChange={(e) => setModel(e.target.value)} title="Modelo del proveedor" style={{ flex: 2, border: '1px solid #D6D0BF', borderRadius: 6, padding: 4, fontSize: 11, background: '#fff', fontFamily: MONO }}>
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
