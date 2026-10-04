import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ROSTER, CHATTER, ACTIVITY_TPL, fatigueOf } from '../data/demo'
import {
  ensureAuth, getAgents, getTasks, createTask, updateAgent, updateTask, postAgentStatus,
  createAgent, deleteAgent, connectOfficeWS, getHealth, type AgentPatch, type AgentMood,
} from '../api'

export interface LiveAgent {
  id: string
  name: string
  role: string
  description: string
  character: string
  hair: string
  shirt: string
  cut: string
  provider: string
  model: string
  skills: string[]
  desk: number
  status: string
  progress: number
  energy: number
  task: string
  log: string
  resting: boolean
  meeting: boolean
  is_active: boolean
  mood?: AgentMood
  backendId?: string
}

export interface LiveTask {
  id: string
  title: string
  desc: string
  priority: string
  status: string
  progress: number
  agentName?: string
  energy: number
}

export interface ActivityItem {
  id: number
  time: string
  agent: string
  text: string
  kind: 'info' | 'success' | 'warning' | 'error'
}

export interface ChatMsg {
  id: number
  from: string
  role?: string
  text: string
  mine?: boolean
}

export type Mode = 'demo' | 'prod'

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
let seq = 1

const now = () => new Date().toLocaleTimeString('es', { hour12: false })

type Look = { hair: string; shirt: string; character: string; cut?: string }
function loadLooks(): Record<string, Look> {
  try {
    return JSON.parse(localStorage.getItem('sc_look') ?? '{}') as Record<string, Look>
  } catch {
    return {}
  }
}

function prodEnergy(status: string, progress: number): number {
  if (status === 'working' || status === 'progress') return Math.min(85, Math.round(35 + progress * 0.5))
  if (status === 'thinking') return 45
  if (status === 'blocked') return 88
  if (status === 'completed') return 20
  if (status === 'paused') return 30
  return 25
}

export function configuredProviders(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem('sc_byok') ?? '{}') as { keys?: Record<string, string> }
    return Object.entries(saved.keys ?? {}).filter(([, v]) => v && v.trim().length > 3).map(([k]) => k)
  } catch {
    return []
  }
}

export function useLiveOffice() {
  const [mode, setModeState] = useState<Mode>(() => (localStorage.getItem('sc_mode') === 'prod' ? 'prod' : 'demo'))
  const [agents, setAgents] = useState<LiveAgent[]>(() =>
    ROSTER.map((r, i) => ({
      id: `demo-${i}`,
      name: r.name,
      role: r.role,
      description: '',
      character: r.character,
      hair: r.hair,
      shirt: r.shirt,
      cut: r.cut,
      provider: r.provider,
      model: r.model,
      skills: [] as string[],
      desk: r.desk,
      status: i === 5 ? 'idle' : i === 6 ? 'blocked' : 'working',
      progress: [88, 65, 42, 30, 78, 0, 55, 12][i] ?? 0,
      energy: [40, 45, 52, 48, 70, 20, 84, 35][i] ?? 30,
      task: ['Coordinando misión Q3', 'Redactando landing', 'Compilando API auth', 'Bocetando dashboard', 'Migrando base de datos', '', 'Esperando revisión SEO', 'QA del backlog'][i] ?? '',
      log: pick(CHATTER),
      resting: false,
      meeting: false,
      is_active: true,
    })),
  )
  const [tasks, setTasks] = useState<LiveTask[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([
    { id: 0, time: now(), agent: 'Boss', text: 'Boss está coordinando misión', kind: 'info' },
  ])
  const [chat, setChat] = useState<ChatMsg[]>([
    { id: 0, from: 'Zero', role: 'Product Manager', text: 'Plot twist design — @max responsable de cámara y performance' },
    { id: 0.1, from: 'Williams', role: 'Front-end Engineer', text: 'Responsable de editing pacing. Feel free to ask~ 👋' },
  ])
  const [backendOk, setBackendOk] = useState(false)
  const [wsLive, setWsLive] = useState(false)
  const [version, setVersion] = useState('1.0.0')
  const tickRef = useRef(0)
  const modeRef = useRef(mode)
  modeRef.current = mode
  const prevStatus = useRef<Record<string, string>>({})

  const pushActivity = useCallback((agent: string, text: string, kind: ActivityItem['kind']) => {
    setActivity((prev) => [{ id: seq++, time: now(), agent, text, kind }, ...prev].slice(0, 30))
  }, [])

  const setMode = useCallback((m: Mode) => {
    localStorage.setItem('sc_mode', m)
    setModeState(m)
  }, [])

  const applyLooks = useCallback((list: LiveAgent[]) => {
    const looks = loadLooks()
    return list.map((a) => {
      const key = a.backendId ?? a.id
      const l = looks[key] ?? looks[a.name]
      return l ? { ...a, hair: l.hair, shirt: l.shirt, character: l.character, cut: l.cut ?? a.cut } : a
    })
  }, [])

  // --- sync inicial con backend ---
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const ok = await ensureAuth()
      const h = await getHealth()
      if (cancelled) return
      setBackendOk(ok && !!h)
      if (h) setVersion(h.version)
      if (!ok) return
      try {
        const [bAgents, bTasks] = await Promise.all([getAgents(), getTasks()])
        if (cancelled) return
        if (bAgents.length > 0) {
          setAgents((prev) =>
            applyLooks(
              prev.map((a) => {
                const match = bAgents.find((b) => b.name.toLowerCase() === a.name.toLowerCase())
                if (!match) return a
                return {
                  ...a,
                  status: match.status,
                  progress: Math.round(match.progress),
                  task: match.current_task ?? a.task,
                  provider: match.provider ?? a.provider,
                  model: match.model ?? a.model,
                  skills: match.skills ?? a.skills,
                  backendId: match.id,
                }
              }),
            ),
          )
        }
        if (bTasks.length > 0) {
          setTasks(
            bTasks.map((t) => ({
              id: t.id,
              title: t.title,
              desc: t.description,
              priority: t.priority,
              status: t.status,
              progress: Math.round(t.progress),
              agentName: bAgents.find((x) => x.id === t.agent_id)?.name,
              energy: Math.round(rnd(30, 80)),
            })),
          )
        }
      } catch {
        /* offline: la sim local sigue viva */
      }
    })()
    const off = connectOfficeWS((msg) => {
      setWsLive(true)
      const t = typeof msg.type === 'string' ? msg.type : 'evento'
      pushActivity('WS', `${t}`, 'info')
    })
    return () => {
      cancelled = true
      off()
    }
  }, [pushActivity, applyLooks])

  // --- polling de producción: solo lee backend (BYOK + modelos reales) ---
  useEffect(() => {
    if (mode !== 'prod') return
    let cancelled = false
    const poll = async () => {
      try {
        const [bAgents, bTasks] = await Promise.all([getAgents(), getTasks()])
        if (cancelled || bAgents.length === 0) return
        setAgents((prev) =>
          applyLooks(
            prev.map((a) => {
              const match = bAgents.find((b) => b.name.toLowerCase() === a.name.toLowerCase())
              if (!match) return a
              const prevSt = prevStatus.current[a.id]
              if (prevSt !== undefined && prevSt !== match.status) {
                pushActivity(a.name, `${a.name} pasó a ${match.status}`, match.status === 'blocked' ? 'error' : 'info')
              }
              prevStatus.current[a.id] = match.status
              return {
                ...a,
                status: a.status === 'paused' ? 'paused' : match.status,
                progress: Math.round(match.progress),
                energy: prodEnergy(match.status, match.progress),
                task: match.current_task ?? a.task,
                provider: match.provider ?? a.provider,
                model: match.model ?? a.model,
                skills: match.skills ?? a.skills,
                is_active: match.is_active ?? true,
                backendId: match.id,
                resting: false,
                log: match.current_task ?? a.log,
              }
            }),
          ),
        )
        if (bTasks.length > 0) {
          setTasks(
            bTasks.map((t) => {
              const an = bAgents.find((x) => x.id === t.agent_id)?.name
              return {
                id: t.id,
                title: t.title,
                desc: t.description,
                priority: t.priority,
                status: t.status,
                progress: Math.round(t.progress),
                agentName: an,
                energy: an ? prodEnergy(bAgents.find((x) => x.id === t.agent_id)?.status ?? 'idle', t.progress) : 50,
              }
            }),
          )
        }
      } catch {
        /* reintenta en el siguiente ciclo */
      }
    }
    void poll()
    const iv = window.setInterval(poll, 6000)
    return () => {
      cancelled = true
      window.clearInterval(iv)
    }
  }, [mode, pushActivity, applyLooks])

  // --- motor de simulación (solo demo) ---
  useEffect(() => {
    if (mode !== 'demo') return
    const iv = window.setInterval(() => {
      tickRef.current += 1
      const tick = tickRef.current
      setAgents((prev) =>
        prev.map((a) => {
          if (!a.is_active) return a
          if (a.status === 'paused' || a.meeting) {
            if (a.meeting) return { ...a, log: 'en reunión ☕' }
            return a
          }
          if (a.resting) {
            const energy = Math.max(15, a.energy - rnd(8, 14))
            if (energy <= 40) {
              pushActivity(a.name, `${a.name} volvió del descanso (energía ${Math.round(energy)}%)`, 'success')
              return { ...a, energy, resting: false, status: 'idle', progress: 0, log: pick(CHATTER) }
            }
            return { ...a, energy, log: 'recargando…' }
          }
          const drain = a.status === 'working' ? rnd(1.5, 4) : rnd(0.5, 1.5)
          const energy = Math.min(100, a.energy + drain)
          if (energy >= 90) {
            pushActivity(a.name, `${a.name} entró en burnout (energía ${Math.round(energy)}%) → sala de descanso`, 'error')
            return { ...a, energy, resting: true, status: 'blocked', log: 'burnout…' }
          }
          if (a.status === 'blocked' && Math.random() < 0.25) {
            pushActivity(a.name, `${a.name} recibió soporte y retomó ${a.task || 'su tarea'}`, 'success')
            return { ...a, status: 'working', log: pick(CHATTER) }
          }
          if (a.status === 'working') {
            const progress = Math.min(100, a.progress + rnd(2, 7))
            const log = Math.random() < 0.4 ? pick(CHATTER) : a.log
            if (progress >= 100) {
              const tpl = pick(ACTIVITY_TPL.completed).replace('{task}', a.task || 'su tarea')
              pushActivity(a.name, `${a.name} ${tpl}`, 'success')
              return { ...a, progress, energy, status: 'completed', log: 'entregado ✓' }
            }
            if (Math.random() < 0.3) {
              const tpl = pick(ACTIVITY_TPL.working).replace('{task}', a.task || 'su tarea').replace('{n}', String(Math.round(progress)))
              pushActivity(a.name, `${a.name} ${tpl}`, 'info')
            }
            return { ...a, progress, energy, log }
          }
          if (a.status === 'completed' && tick % 3 === 0) {
            return { ...a, status: 'idle', progress: 0, energy: Math.max(20, a.energy - 20), log: pick(CHATTER) }
          }
          if (a.status === 'idle' && Math.random() < 0.3) {
            const t = pick(['Refactor UI', 'Code audit', 'SEO post', 'Tests e2e', 'Docs API'])
            pushActivity(a.name, `${a.name} tomó «${t}»`, 'info')
            return { ...a, status: 'working', task: t, log: pick(CHATTER) }
          }
          return { ...a, energy }
        }),
      )
      setTasks((prev) =>
        prev.map((t) => {
          if (t.status === 'in_progress' && Math.random() < 0.5) {
            const progress = Math.min(100, t.progress + rnd(2, 6))
            return { ...t, progress: Math.round(progress), status: progress >= 100 ? 'completed' : t.status }
          }
          return t
        }),
      )
      if (tick % 4 === 0) {
        const who = pick(ROSTER.filter((r) => r.character !== 'boss'))
        setChat((prev) =>
          [...prev, { id: seq++, from: who.name, role: who.role, text: `${pick(CHATTER)} 👋` }].slice(-30),
        )
      }
    }, 2500)
    return () => window.clearInterval(iv)
  }, [mode, pushActivity])

  const sendChat = useCallback(
    async (text: string) => {
      const clean = text.trim()
      if (!clean) return
      setChat((prev) => [...prev, { id: seq++, from: 'Tú', text: clean, mine: true }].slice(-30))
      window.setTimeout(() => {
        setChat((prev) =>
          [...prev, { id: seq++, from: 'Boss', role: 'Orquestador', text: `Recibido: «${clean}» → lo desgloso en micro-tareas y asigno al equipo. ✅` }].slice(-30),
        )
      }, 900)
      pushActivity('Tú', `inyectaste requerimiento: «${clean}»`, 'warning')
      setTasks((prev) => [
        ...prev,
        { id: `local-${seq}`, title: clean.slice(0, 60), desc: clean, priority: 'medium', status: 'pending', progress: 0, energy: 25 },
      ])
      try {
        await createTask(clean.slice(0, 60), clean)
      } catch {
        /* backlog local si el backend no responde */
      }
    },
    [pushActivity],
  )

  const approveTask = useCallback(
    (id: string) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'in_progress', progress: Math.max(t.progress, 5) } : t)))
      pushActivity('Tú', 'aprobaste tarea de alto costo (human-in-the-loop) → En progreso', 'success')
    },
    [pushActivity],
  )

  const taskControl = useCallback(
    async (id: string, action: 'pause' | 'resume' | 'complete') => {
      const status = action === 'pause' ? 'paused' : action === 'complete' ? 'completed' : 'in_progress'
      const t = tasks.find((x) => x.id === id)
      setTasks((prev) =>
        prev.map((x) => (x.id === id ? { ...x, status, progress: action === 'complete' ? 100 : Math.max(x.progress, 5) } : x)),
      )
      pushActivity(
        'Tú',
        action === 'pause' ? `⏸ detuviste «${t?.title ?? id}»` : action === 'complete' ? `✓ completaste «${t?.title ?? id}»` : `▶ continuaste «${t?.title ?? id}»`,
        action === 'pause' ? 'warning' : 'success',
      )
      if (!id.startsWith('local-')) {
        try {
          await updateTask(id, { status, progress: action === 'complete' ? 100 : undefined })
        } catch {
          /* solo local */
        }
      }
    },
    [tasks, pushActivity],
  )

  const extendTask = useCallback(
    async (id: string, note: string) => {
      const t = tasks.find((x) => x.id === id)
      if (!t || !note.trim()) return
      const stamp = new Date().toLocaleTimeString('es', { hour12: false })
      const desc = `${t.desc}\n\n[Alcance extendido ${stamp}]: ${note.trim()}`
      setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, desc } : x)))
      pushActivity('Tú', `➕ extendiste «${t.title}» desde su chat`, 'info')
      if (!id.startsWith('local-')) {
        try {
          await updateTask(id, { description: desc })
        } catch {
          /* solo local */
        }
      }
    },
    [tasks, pushActivity],
  )

  const pauseAgent = useCallback(
    async (id: string) => {
      setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'paused', log: 'en pausa ⏸' } : a)))
      const a = agents.find((x) => x.id === id)
      pushActivity(a?.name ?? '?', `${a?.name ?? '?'} en pausa ⏸ (actividad detenida)`, 'warning')
      if (a?.backendId) {
        try {
          await postAgentStatus(a.backendId, 'paused')
        } catch {
          /* solo local */
        }
      }
    },
    [agents, pushActivity],
  )

  const resumeAgent = useCallback(
    async (id: string) => {
      setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'idle', log: pick(CHATTER) } : a)))
      const a = agents.find((x) => x.id === id)
      pushActivity(a?.name ?? '?', `${a?.name ?? '?'} reanudado ▶`, 'success')
      if (a?.backendId) {
        try {
          await postAgentStatus(a.backendId, 'idle')
        } catch {
          /* solo local */
        }
      }
    },
    [agents, pushActivity],
  )

  const saveAgent = useCallback(
    async (id: string, patch: AgentPatch) => {
      setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch, task: patch.current_task ?? a.task } as LiveAgent : a)))
      const a = agents.find((x) => x.id === id)
      if (a?.backendId) {
        try {
          await updateAgent(a.backendId, patch)
          pushActivity(a.name, `${a.name} actualizado en backend ✓`, 'success')
        } catch {
          pushActivity(a.name, `${a.name} actualizado solo local (backend no respondió)`, 'warning')
        }
      }
    },
    [agents, pushActivity],
  )

  const saveLook = useCallback((key: string, look: Look) => {
    try {
      const all = loadLooks()
      all[key] = look
      localStorage.setItem('sc_look', JSON.stringify(all))
    } catch {
      /* noop */
    }
    setAgents((prev) => prev.map((a) => (a.backendId === key || a.id === key || a.name === key ? { ...a, ...look } : a)))
  }, [])

  const providerMeeting = useCallback(
    (provider: string) => {
      const affected = agents.filter((a) => a.provider === provider && a.is_active)
      if (affected.length === 0) return
      setAgents((prev) => prev.map((a) => (a.provider === provider ? { ...a, meeting: true } : a)))
      pushActivity('Boss', `☕ ${affected.map((a) => a.name).join(', ')} a sala de descanso: proveedor ${provider} actualizado`, 'warning')
      window.setTimeout(() => {
        setAgents((prev) => prev.map((a) => (a.provider === provider ? { ...a, meeting: false, log: pick(CHATTER) } : a)))
      }, 25000)
    },
    [agents, pushActivity],
  )

  const stats = useMemo(() => {
    const active = agents.filter((a) => a.is_active)
    const working = active.filter((a) => ['working', 'thinking', 'progress'].includes(a.status) && !a.resting && !a.meeting).length
    const blocked = active.filter((a) => a.status === 'blocked').length
    const done = active.filter((a) => a.status === 'completed').length
    const global = active.length ? Math.round(active.reduce((s, a) => s + a.progress, 0) / active.length) : 0
    return { total: active.length, working, blocked, done, global, off: agents.length - active.length }
  }, [agents])

  const togglePower = useCallback(
    async (id: string) => {
      const a = agents.find((x) => x.id === id)
      if (!a) return
      const next = !a.is_active
      setAgents((prev) => prev.map((x) => (x.id === id ? { ...x, is_active: next } : x)))
      pushActivity(a.name, next ? `${a.name} encendido ⚡` : `${a.name} apagado 💤`, next ? 'success' : 'warning')
      if (a.backendId) {
        try {
          await updateAgent(a.backendId, { is_active: next })
        } catch {
          /* solo local */
        }
      }
    },
    [agents, pushActivity],
  )

  const addAgent = useCallback(
    async (input: { name: string; role: string; provider: string; model: string }) => {
      const freeDesk = [0, 1, 2, 3, 4, 5].find((d) => !agents.some((a) => a.desk === d && a.is_active)) ?? 8
      try {
        await createAgent({
          name: input.name, role: input.role, character_type: 'custom',
          provider: input.provider, model: input.model, status: 'idle',
        })
        pushActivity(input.name, `${input.name} agregado al equipo ✓ (${input.provider}/${input.model})`, 'success')
        try {
          const list = await getAgents()
          const match = list.find((b) => b.name.toLowerCase() === input.name.toLowerCase())
          if (match) {
            setAgents((prev) => [
              ...prev,
              {
                id: `demo-${match.id}`, name: match.name, role: match.role, description: '',
                character: match.character_type, hair: '#9CA3AF', shirt: '#6B7280', cut: 'short',
                provider: match.provider ?? input.provider, model: match.model ?? input.model,
                skills: match.skills ?? [], desk: freeDesk, status: match.status,
                progress: 0, energy: 25, task: '', log: pick(CHATTER),
                resting: false, meeting: false, is_active: true, backendId: match.id,
              },
            ])
            return
          }
        } catch {
          /* cae al alta local */
        }
      } catch {
        /* alta local si el backend no responde */
      }
      setAgents((prev) => [
        ...prev,
        {
          id: `local-${seq++}`, name: input.name, role: input.role, description: '',
          character: 'custom', hair: '#9CA3AF', shirt: '#6B7280', cut: 'short',
          provider: input.provider, model: input.model, skills: [],
          desk: freeDesk, status: 'idle', progress: 0, energy: 25, task: '',
          log: pick(CHATTER), resting: false, meeting: false, is_active: true,
        },
      ])
    },
    [agents, pushActivity],
  )

  const removeAgent = useCallback(
    async (id: string) => {
      const a = agents.find((x) => x.id === id)
      setAgents((prev) => prev.filter((x) => x.id !== id))
      pushActivity(a?.name ?? '?', `${a?.name ?? '?'} eliminado del equipo 🗑`, 'warning')
      if (a?.backendId) {
        try {
          await deleteAgent(a.backendId)
        } catch {
          /* solo local */
        }
      }
    },
    [agents, pushActivity],
  )

  const setMood = useCallback((id: string, mood: AgentMood | undefined) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, mood } : a)))
    if (mood) {
      window.setTimeout(() => {
        setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, mood: undefined } : a)))
      }, 45000)
    }
  }, [])

  return {
    agents, tasks, activity, chat, stats, backendOk, wsLive, version,
    mode, setMode, sendChat, approveTask, taskControl, extendTask, pauseAgent, resumeAgent,
    saveAgent, saveLook, providerMeeting, togglePower, addAgent, removeAgent, setMood, fatigueOf,
  }
}
