import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { LiveAgent, LiveTask, AgentChatMsg } from '../hooks/useLiveOffice'
import { AgentSprite } from '../components/office/AgentSprite'
import { FATIGUE_META, fatigueOf } from '../data/demo'

const GB = "'Press Start 2P', monospace"
const MONO = "ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace"

interface Props {
  agents: LiveAgent[]
  messagesFor: (id: string) => AgentChatMsg[]
  thinkingId: string | null
  tasksForAgent: (name?: string) => LiveTask[]
  onSend: (id: string, text: string) => void
  onClear: (id: string) => void
  onSelect: (id: string | null) => void
  selectedId: string | null
  onEdit: (id: string) => void
  onRename: (id: string, name: string) => void
  onOpenTask: (taskId: string) => void
}

/**
 * Página dedicada de un agente (ruta /agente/:id). Chat a pantalla amplia tipo GPT,
 * historial de tareas asignadas por el orquestador, y acciones rápidas (renombrar,
 * seleccionar como agente activo, abrir editor completo).
 */
export function AgentPage({
  agents, messagesFor, thinkingId, tasksForAgent, onSend, onClear, onSelect, selectedId, onEdit, onRename, onOpenTask,
}: Props) {
  const { id } = useParams()
  const navigate = useNavigate()
  const agent = agents.find((a) => a.id === id)
  const [input, setInput] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const messages = agent ? messagesFor(agent.id) : []
  const thinking = thinkingId === agent?.id

  useEffect(() => {
    if (agent) onSelect(agent.id)
  }, [agent, onSelect])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, thinking])

  if (!agent) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#A8A29E', fontFamily: MONO }}>
        <div style={{ fontFamily: GB, fontSize: 14, marginBottom: 12 }}>Agente no encontrado</div>
        <button onClick={() => navigate('/oficina')} style={{ background: '#22C55E', color: '#052E16', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontWeight: 'bold', fontFamily: MONO }}>
          ← Volver a la oficina
        </button>
      </div>
    )
  }

  const fat = fatigueOf(agent.energy)
  const online = agent.is_active
  const tasks = tasksForAgent(agent.name)
  const isSelected = selectedId === agent.id

  const send = () => {
    const t = input.trim()
    if (!t) return
    onSend(agent.id, t)
    setInput('')
  }

  return (
    <div style={{ fontFamily: MONO, color: '#fff' }}>
      <button onClick={() => navigate('/oficina')} style={{ background: '#1A1A1A', color: '#A8A29E', border: '1px solid #333', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontFamily: MONO, fontSize: 12, marginBottom: 12 }}>
        ← Oficina
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
        {/* perfil */}
        <aside style={{ background: '#111', border: `2px solid ${agent.shirt}`, borderRadius: 14, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <div style={{ transform: 'scale(1.6)', transformOrigin: 'center bottom', paddingBottom: 14 }}>
              <AgentSprite hair={agent.hair} shirt={agent.shirt} cut={agent.cut} px={5} status={online ? agent.status : 'paused'} aura={FATIGUE_META[fat].color} selected={isSelected} />
            </div>
          </div>

          {editingName ? (
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input
                autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && nameDraft.trim()) { onRename(agent.id, nameDraft.trim()); setEditingName(false) } }}
                style={{ flex: 1, background: '#161616', border: '1px solid #333', borderRadius: 6, padding: '6px 8px', color: '#fff', fontFamily: MONO, fontSize: 14 }}
              />
              <button onClick={() => { if (nameDraft.trim()) onRename(agent.id, nameDraft.trim()); setEditingName(false) }} style={{ background: '#22C55E', color: '#052E16', border: 'none', borderRadius: 6, padding: '0 10px', cursor: 'pointer', fontWeight: 'bold' }}>✓</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: GB, fontSize: 14, color: '#fff' }}>{agent.name}</span>
              <button title="Renombrar" onClick={() => { setNameDraft(agent.name); setEditingName(true) }} style={{ background: 'transparent', color: '#78716C', border: 'none', cursor: 'pointer', fontSize: 13 }}>✏</button>
            </div>
          )}
          <div style={{ textAlign: 'center', fontSize: 12, color: '#A8A29E', marginBottom: 12 }}>{agent.role}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
            <Row label="Estado" value={online ? agent.status : 'apagado'} color={online ? FATIGUE_META[fat].color : '#9CA3AF'} />
            <Row label="Proveedor" value={agent.provider} />
            <Row label="Modelo" value={agent.model} />
            <Row label="Energía" value={`${Math.round(agent.energy)}% · ${FATIGUE_META[fat].label}`} color={FATIGUE_META[fat].color} />
            <Row label="Skills" value={agent.skills.length ? agent.skills.join(', ') : '—'} />
            <Row label="Tareas" value={String(tasks.length)} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            <button
              onClick={() => onSelect(isSelected ? null : agent.id)}
              style={{ padding: 9, borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 12, fontFamily: MONO, background: isSelected ? agent.shirt : '#1A1A1A', color: isSelected ? '#0A0A0A' : '#A8A29E' }}
            >
              {isSelected ? '★ Agente activo (en uso)' : '☆ Usar este agente'}
            </button>
            <button onClick={() => onEdit(agent.id)} style={{ padding: 9, borderRadius: 8, border: '1px solid #333', cursor: 'pointer', fontSize: 12, fontFamily: MONO, background: '#1A1A1A', color: '#fff' }}>
              ⚙ Personalizar (aspecto, modelo, skills)
            </button>
          </div>
        </aside>

        {/* chat amplio + tareas */}
        <main style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section style={{ background: '#0F0F10', border: '1px solid #2A2A2A', borderRadius: 14, display: 'flex', flexDirection: 'column', height: 440 }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #222', fontSize: 11, fontFamily: GB, color: '#78716C' }}>
              💬 CHAT DIRECTO CON {agent.name.toUpperCase()}
            </div>
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#57534E', fontSize: 13, marginTop: 30 }}>
                  Empieza a chatear con {agent.name}. Responde con su proveedor real ({agent.provider}).
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '78%', background: m.role === 'user' ? '#1E3A8A' : m.error ? '#3B1111' : '#1C1C1E', color: m.error ? '#FCA5A5' : '#F5F5F4', border: `1px solid ${m.role === 'user' ? '#2447B0' : m.error ? '#7F1D1D' : '#2A2A2A'}`, borderRadius: 12, padding: '9px 12px', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {m.role === 'agent' && !m.error && <div style={{ fontSize: 10, color: agent.shirt, marginBottom: 3, fontWeight: 'bold' }}>{agent.name}</div>}
                  {m.text}
                  <div style={{ fontSize: 9, color: '#57534E', marginTop: 4, textAlign: 'right' }}>{m.tokens != null ? `${m.tokens} tok · ` : ''}{m.time}</div>
                </div>
              ))}
              {thinking && (
                <div style={{ alignSelf: 'flex-start', background: '#1C1C1E', border: '1px solid #2A2A2A', borderRadius: 12, padding: '10px 14px', display: 'flex', gap: 5 }}>
                  <style>{`@keyframes sc-typing { 0%,100% { opacity:.3; transform: translateY(0); } 50% { opacity:1; transform: translateY(-3px); } }`}</style>
                  {[0, 1, 2].map((i) => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: agent.shirt, animation: `sc-typing 1s ease-in-out ${i * 0.18}s infinite` }} />)}
                </div>
              )}
            </div>
            <div style={{ padding: 12, borderTop: '1px solid #222', display: 'flex', gap: 8 }}>
              <input
                value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder={online ? `Mensaje para ${agent.name}…` : `${agent.name} está apagado`}
                disabled={!online || thinking}
                style={{ flex: 1, background: '#161616', border: '1px solid #333', borderRadius: 10, padding: '11px 13px', fontSize: 13, color: '#fff', fontFamily: MONO, opacity: online ? 1 : 0.5 }}
              />
              <button onClick={send} disabled={!online || thinking || !input.trim()} style={{ background: agent.shirt, color: '#0A0A0A', border: 'none', borderRadius: 10, padding: '0 20px', cursor: 'pointer', fontWeight: 'bold', fontSize: 16, opacity: online && input.trim() && !thinking ? 1 : 0.5 }}>↑</button>
              {messages.length > 0 && (
                <button onClick={() => onClear(agent.id)} title="Limpiar" style={{ background: '#1A1A1A', color: '#78716C', border: '1px solid #333', borderRadius: 10, padding: '0 12px', cursor: 'pointer' }}>🗑</button>
              )}
            </div>
          </section>

          <section style={{ background: '#111', border: '1px solid #2A2A2A', borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 11, fontFamily: GB, color: '#78716C', marginBottom: 10 }}>🗂 HISTORIAL DE TAREAS ASIGNADAS ({tasks.length})</div>
            {tasks.length === 0 ? (
              <div style={{ color: '#57534E', fontSize: 12 }}>El orquestador aún no le ha asignado tareas a {agent.name}.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {tasks.map((t) => {
                  const done = t.status === 'completed'
                  const col = done ? '#22C55E' : t.status === 'blocked' ? '#EF4444' : t.status === 'paused' ? '#F59E0B' : '#38BDF8'
                  return (
                    <button key={t.id} onClick={() => onOpenTask(t.id)} style={{ textAlign: 'left', background: '#161616', border: '1px solid #2A2A2A', borderLeft: `3px solid ${col}`, borderRadius: 8, padding: 10, cursor: 'pointer', color: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                        <span style={{ fontSize: 9, color: col, textTransform: 'uppercase', flexShrink: 0 }}>{t.status}</span>
                      </div>
                      <div style={{ height: 5, background: '#2A2A2A', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                        <div style={{ width: `${t.progress}%`, height: '100%', background: col }} />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, borderBottom: '1px dashed #2A2A2A', paddingBottom: 6 }}>
      <span style={{ color: '#78716C' }}>{label}</span>
      <span style={{ color: color ?? '#E7E5E4', fontWeight: 'bold', textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}
