import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LiveAgent, LiveTask, AgentChatMsg } from '../hooks/useLiveOffice'
import { AgentSprite } from './office/AgentSprite'
import { FATIGUE_META, fatigueOf } from '../data/demo'

const GB = "'Press Start 2P', monospace"
const MONO = "ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace"

const STATUS_LABEL: Record<string, { txt: string; color: string }> = {
  working: { txt: 'trabajando', color: '#22C55E' },
  progress: { txt: 'en progreso', color: '#22C55E' },
  thinking: { txt: 'pensando', color: '#38BDF8' },
  blocked: { txt: 'bloqueado', color: '#EF4444' },
  completed: { txt: 'listo', color: '#22C55E' },
  paused: { txt: 'en pausa', color: '#F59E0B' },
  idle: { txt: 'libre', color: '#A8A29E' },
}

interface Props {
  agent: LiveAgent
  messages: AgentChatMsg[]
  thinking: boolean
  tasks: LiveTask[]
  onClose: () => void
  onSend: (agentId: string, text: string) => void
  onClear: (agentId: string) => void
  onOpenTask?: (taskId: string) => void
}

/**
 * Ventana de chat flotante por agente, estilo widget de chatbot de sitio web.
 * Dos pestañas: CHAT (conversación directa tipo GPT) e HISTORIAL
 * (tareas que el orquestador asignó a este agente).
 */
export function AgentChatDock({ agent, messages, thinking, tasks, onClose, onSend, onClear, onOpenTask }: Props) {
  const [tab, setTab] = useState<'chat' | 'historial'>('chat')
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const fat = fatigueOf(agent.energy)
  const st = STATUS_LABEL[agent.status] ?? STATUS_LABEL.idle
  const online = agent.is_active

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, thinking, tab])

  const send = () => {
    const t = input.trim()
    if (!t) return
    onSend(agent.id, t)
    setInput('')
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 18,
        right: 18,
        width: 360,
        maxWidth: 'calc(100vw - 36px)',
        height: 520,
        maxHeight: 'calc(100vh - 36px)',
        background: '#0F0F10',
        border: `2px solid ${agent.shirt}`,
        borderRadius: 16,
        boxShadow: '0 18px 48px rgba(0,0,0,.6)',
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: MONO,
        animation: 'sc-dock-in .22s ease-out',
      }}
    >
      <style>{`
        @keyframes sc-dock-in { from { opacity: 0; transform: translateY(16px) scale(.98); } to { opacity: 1; transform: none; } }
        @keyframes sc-typing { 0%,100% { opacity:.3; transform: translateY(0); } 50% { opacity:1; transform: translateY(-3px); } }
      `}</style>

      {/* cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: `linear-gradient(90deg, ${agent.shirt}22, transparent)`, borderBottom: '1px solid #222' }}>
        <div style={{ position: 'relative', width: 36, height: 44 }}>
          <AgentSprite hair={agent.hair} shirt={agent.shirt} cut={agent.cut} px={3} status={online ? agent.status : 'paused'} aura={FATIGUE_META[fat].color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent.name}</span>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: online ? st.color : '#555', boxShadow: online ? `0 0 6px ${st.color}` : 'none', flexShrink: 0 }} />
          </div>
          <div style={{ fontSize: 10, color: '#A8A29E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {agent.role} · <span style={{ color: st.color }}>{online ? st.txt : 'apagado'}</span> · {agent.provider}/{agent.model}
          </div>
        </div>
        <button
          title="Abrir perfil completo del agente"
          onClick={() => navigate(`/agente/${agent.id}`)}
          style={{ background: '#1A1A1A', color: '#A8A29E', border: '1px solid #333', borderRadius: 6, cursor: 'pointer', padding: '4px 8px', fontSize: 12 }}
        >
          ⛶
        </button>
        <button onClick={onClose} title="Cerrar" style={{ background: '#1A1A1A', color: '#fff', border: '1px solid #333', borderRadius: 6, cursor: 'pointer', padding: '4px 9px', fontSize: 12 }}>✕</button>
      </div>

      {/* pestañas */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 10px 0' }}>
        {([['chat', '💬 Chat'], ['historial', `🗂 Tareas (${tasks.length})`]] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 'bold',
              border: 'none', fontFamily: MONO,
              background: tab === t ? agent.shirt : '#1A1A1A',
              color: tab === t ? '#0A0A0A' : '#A8A29E',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* cuerpo */}
      {tab === 'chat' ? (
        <>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#57534E', fontSize: 12, marginTop: 20, lineHeight: 1.6 }}>
                👋 Habla con <b style={{ color: agent.shirt }}>{agent.name}</b> como con un GPT.<br />
                Usa su proveedor real ({agent.provider}).<br />
                <span style={{ fontSize: 10, color: '#44403C' }}>Las tareas que le asigna el orquestador aparecen en la pestaña Tareas.</span>
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '86%',
                  background: m.role === 'user' ? '#1E3A8A' : m.error ? '#3B1111' : '#1C1C1E',
                  color: m.error ? '#FCA5A5' : '#F5F5F4',
                  border: `1px solid ${m.role === 'user' ? '#2447B0' : m.error ? '#7F1D1D' : '#2A2A2A'}`,
                  borderRadius: 12,
                  padding: '8px 11px',
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {m.role === 'agent' && !m.error && (
                  <div style={{ fontSize: 10, color: agent.shirt, marginBottom: 3, fontWeight: 'bold' }}>{agent.name}</div>
                )}
                {m.text}
                <div style={{ fontSize: 9, color: '#57534E', marginTop: 4, textAlign: 'right' }}>
                  {m.tokens != null ? `${m.tokens} tok · ` : ''}{m.time}
                </div>
              </div>
            ))}
            {thinking && (
              <div style={{ alignSelf: 'flex-start', background: '#1C1C1E', border: '1px solid #2A2A2A', borderRadius: 12, padding: '10px 14px', display: 'flex', gap: 5 }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: agent.shirt, animation: `sc-typing 1s ease-in-out ${i * 0.18}s infinite` }} />
                ))}
              </div>
            )}
          </div>

          {/* barra de entrada */}
          <div style={{ padding: 10, borderTop: '1px solid #222', background: '#0A0A0A' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder={online ? `Escribe a ${agent.name}…` : `${agent.name} está apagado`}
                disabled={!online || thinking}
                style={{ flex: 1, background: '#161616', border: '1px solid #333', borderRadius: 10, padding: '9px 11px', fontSize: 12.5, color: '#fff', fontFamily: MONO, opacity: online ? 1 : 0.5 }}
              />
              <button
                onClick={send}
                disabled={!online || thinking || !input.trim()}
                style={{ background: agent.shirt, color: '#0A0A0A', border: 'none', borderRadius: 10, padding: '0 15px', cursor: online && !thinking ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: 15, opacity: online && input.trim() && !thinking ? 1 : 0.5 }}
              >
                ↑
              </button>
            </div>
            {messages.length > 0 && (
              <button onClick={() => onClear(agent.id)} style={{ width: '100%', marginTop: 7, background: 'transparent', color: '#57534E', border: 'none', cursor: 'pointer', fontSize: 10, fontFamily: MONO }}>
                🗑 limpiar conversación
              </button>
            )}
          </div>
        </>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 10, fontFamily: GB, color: '#78716C', marginBottom: 2 }}>TAREAS ASIGNADAS POR EL ORQUESTADOR</div>
          {tasks.length === 0 && (
            <div style={{ color: '#57534E', fontSize: 12, textAlign: 'center', marginTop: 20 }}>
              Aún no hay tareas asignadas a {agent.name}.<br />
              <span style={{ fontSize: 10 }}>Cuando el orquestador le delegue trabajo, aparecerá aquí su historial.</span>
            </div>
          )}
          {tasks.map((t) => {
            const done = t.status === 'completed'
            const col = done ? '#22C55E' : t.status === 'blocked' ? '#EF4444' : t.status === 'paused' ? '#F59E0B' : '#38BDF8'
            return (
              <button
                key={t.id}
                onClick={() => onOpenTask?.(t.id)}
                style={{ textAlign: 'left', background: '#161616', border: `1px solid #2A2A2A`, borderLeft: `3px solid ${col}`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: '#fff' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                  <span style={{ fontSize: 9, color: col, textTransform: 'uppercase', flexShrink: 0 }}>{t.status}</span>
                </div>
                <div style={{ fontSize: 11, color: '#A8A29E', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.desc}</div>
                <div style={{ height: 5, background: '#2A2A2A', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${t.progress}%`, height: '100%', background: col }} />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
