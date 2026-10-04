import { useState } from 'react'
import { OfficeScene } from './components/office/OfficeScene'
import { StudioPanel } from './components/StudioPanel'
import { KanbanBoard } from './components/KanbanBoard'
import { ProvidersPanel } from './components/ProvidersPanel'
import { SkillsPanel } from './components/SkillsPanel'
import { AgentEditor } from './components/AgentEditor'
import { TaskDrawer } from './components/TaskDrawer'
import { useLiveOffice } from './hooks/useLiveOffice'
import { FATIGUE_META, fatigueOf } from './data/demo'
import { API_URL, WS_URL } from './api'

type Tab = 'oficina' | 'kanban' | 'skills' | 'proveedores'

const GB = "'Press Start 2P', monospace"
const MONO = "ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace"

const KIND_COLOR: Record<string, string> = {
  info: '#38BDF8',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
}

export default function App() {
  const [tab, setTab] = useState<Tab>('oficina')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [skillsTick, setSkillsTick] = useState(0)
  const {
    agents, tasks, activity, chat, stats, backendOk, wsLive, version,
    mode, setMode, sendChat, approveTask, taskControl, extendTask, pauseAgent, resumeAgent,
    saveAgent, saveLook, providerMeeting,
  } = useLiveOffice()

  const editing = agents.find((a) => a.id === editingId) ?? null
  const openTask = tasks.find((t) => t.id === openTaskId) ?? null

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', color: '#fff', padding: 16, fontFamily: MONO }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* cabecera (efecto gameboy) */}
        <header style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22 }}>🎮</span>
            <h1 style={{ fontSize: 17, margin: 0, fontFamily: GB }}>SeeControl — Orquestador de Agentes</h1>
            <span style={{ fontSize: 12, color: '#78716C' }}>INDUSTRIUM · gemelo digital en vivo</span>
          </div>
          <div style={{ fontSize: 12, color: '#A8A29E', marginTop: 6 }}>
            Backend:{' '}
            <a href={`${API_URL}/docs`} target="_blank" rel="noreferrer" style={{ color: '#00BFFF' }}>
              {API_URL}/docs
            </a>{' '}
            · WS: {WS_URL}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, border: '1px solid #2A2A2A', borderRadius: 8, padding: '6px 12px', background: '#111', color: backendOk ? '#22C55E' : '#F59E0B' }}>
              {backendOk ? `✅ Backend healthy v${version} — database, llm, websocket, orchestration` : '⏳ Conectando backend… (modo sim local)'}
            </span>
            <span style={{ fontSize: 12, border: '1px solid #2A2A2A', borderRadius: 8, padding: '6px 12px', background: '#111', color: wsLive ? '#22C55E' : '#78716C' }}>
              {wsLive ? '📡 WS en vivo' : '📡 WS sim'}
            </span>
            {/* switch demo / producción */}
            <span style={{ fontSize: 12, border: '1px solid #2A2A2A', borderRadius: 8, padding: 4, background: '#111', display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ color: '#78716C', paddingLeft: 6 }}>MODO</span>
              {(['demo', 'prod'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  title={m === 'demo' ? 'Simulación local viva' : 'Solo backend + BYOK reales'}
                  style={{
                    fontSize: 9,
                    fontFamily: GB,
                    padding: '6px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    border: 'none',
                    background: mode === m ? (m === 'demo' ? '#78350A' : '#052E16') : 'transparent',
                    color: mode === m ? (m === 'demo' ? '#FBBF24' : '#22C55E') : '#78716C',
                  }}
                >
                  {m === 'demo' ? '🧪 DEMO' : '🏭 PROD'}
                </button>
              ))}
            </span>
            <nav style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              {([['oficina', '🏢 OFICINA'], ['kanban', '🗂 KANBAN'], ['skills', '🧠 SKILLS'], ['proveedores', '🔑 BYOK']] as [Tab, string][]).map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    fontSize: 9,
                    fontFamily: GB,
                    padding: '10px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: tab === t ? '2px solid #22C55E' : '1px solid #333',
                    background: tab === t ? '#052E16' : '#111',
                    color: tab === t ? '#22C55E' : '#A8A29E',
                  }}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>
          {mode === 'prod' && (
            <div style={{ fontSize: 12, color: '#FBBF24', marginTop: 6 }}>
              🏭 Producción: la oficina refleja el backend y tus llaves BYOK. Sin simulación local.
            </div>
          )}
        </header>

        {/* cuerpo estilo Octask: studio izquierda + vista */}
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12, alignItems: 'start' }}>
          <StudioPanel
            agents={agents}
            chat={chat}
            onSend={sendChat}
            onEdit={setEditingId}
            onPause={pauseAgent}
            onResume={resumeAgent}
          />

          <main style={{ minWidth: 0 }}>
            {tab === 'oficina' && (
              <>
                <OfficeScene agents={agents} stats={stats} onAgentClick={setEditingId} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                  {/* feed */}
                  <div style={{ background: '#111', border: '1px solid #2A2A2A', borderRadius: 10, padding: 10, maxHeight: 260, overflowY: 'auto' }}>
                    <div style={{ fontSize: 10, fontFamily: GB, color: '#78716C', marginBottom: 8 }}>📡 ACTIVIDAD EN VIVO</div>
                    {activity.map((a) => (
                      <div key={a.id} style={{ fontSize: 12, padding: '6px 8px', background: '#1A1A1A', borderRadius: 6, marginBottom: 6, borderLeft: `3px solid ${KIND_COLOR[a.kind]}` }}>
                        <b style={{ color: KIND_COLOR[a.kind] }}>{a.agent}:</b>{' '}
                        <span style={{ color: '#D6D3D1' }}>{a.text}</span>{' '}
                        <span style={{ color: '#57534E' }}>{a.time}</span>
                      </div>
                    ))}
                  </div>
                  {/* fatiga */}
                  <div style={{ background: '#111', border: '1px solid #2A2A2A', borderRadius: 10, padding: 10, maxHeight: 260, overflowY: 'auto' }}>
                    <div style={{ fontSize: 10, fontFamily: GB, color: '#78716C', marginBottom: 8 }}>🔋 FATIGA DE TOKENS</div>
                    {agents.map((a) => {
                      const fat = fatigueOf(a.energy)
                      return (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, fontSize: 12 }}>
                          <span style={{ width: 12, height: 12, borderRadius: '50%', background: a.shirt, border: '1px solid #000', flexShrink: 0 }} />
                          <span style={{ width: 52, color: FATIGUE_META[fat].color, fontWeight: 'bold' }}>{a.name}</span>
                          <div style={{ flex: 1, height: 7, background: '#262626', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, a.energy)}%`, height: '100%', background: FATIGUE_META[fat].color }} />
                          </div>
                          <span style={{ width: 118, color: FATIGUE_META[fat].color }}>
                            {Math.round(a.energy)}% · {FATIGUE_META[fat].label}
                          </span>
                        </div>
                      )
                    })}
                    <div style={{ fontSize: 11, color: '#57534E', marginTop: 4 }}>
                      Óptimo 0-60% · Exhausto 61-89% · Burnout 90-100% → descanso
                    </div>
                  </div>
                </div>
              </>
            )}
            {tab === 'kanban' && <KanbanBoard tasks={tasks} agents={agents} onApprove={approveTask} onTaskControl={taskControl} onOpenTask={setOpenTaskId} />}
            {tab === 'skills' && (
              <SkillsPanel
                agents={agents}
                onAttachSkill={(agentId, skillName) => {
                  const a = agents.find((x) => x.id === agentId)
                  if (a && !a.skills.includes(skillName)) saveAgent(agentId, { skills: [...a.skills, skillName] })
                }}
                refreshToken={skillsTick}
                onChanged={() => setSkillsTick((n) => n + 1)}
              />
            )}
            {tab === 'proveedores' && <ProvidersPanel onProviderSaved={providerMeeting} />}
          </main>
        </div>

        <footer style={{ marginTop: 14, fontSize: 11, color: '#57534E', textAlign: 'center' }}>
          SeeControl · orquestación determinista + emergente · human-in-the-loop · BYOK global + asiático
        </footer>
      </div>

      {/* drawer editor */}
      {editing && (
        <AgentEditor
          agent={editing}
          onClose={() => setEditingId(null)}
          onSave={(id, patch) => saveAgent(id, patch)}
          onLook={saveLook}
          onPause={pauseAgent}
          onResume={resumeAgent}
        />
      )}

      {/* drawer tarea */}
      {openTask && (
        <TaskDrawer
          task={openTask}
          agent={agents.find((a) => a.name === openTask.agentName)}
          onClose={() => setOpenTaskId(null)}
          onControl={taskControl}
          onExtend={extendTask}
        />
      )}
    </div>
  )
}
