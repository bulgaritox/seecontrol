import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ROSTER, CHATTER, ACTIVITY_TPL, fatigueOf } from '../data/demo'
import {
  ensureAuth, getAgents, getTasks, createTask, updateAgent, updateTask, postAgentStatus,
  createAgent, deleteAgent, pingAgent, orchestrateCode, connectOfficeWS, getHealth,
  deleteTask as apiDeleteTask, deleteProjectTasks as apiDeleteProjectTasks,
  type AgentPatch, type AgentMood,
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
  glasses?: boolean
  skin?: string
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
  trip?: 'table' | null
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
  result?: string
  provider?: string
  model?: string
  projectId?: string
  projectName?: string
  projectBrief?: string
  roleLabel?: string
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

export interface LiveDoc {
  id: string
  title: string
  question: string
  full: string
  agentName: string
  agentId: string
  fresh: boolean
  time: string
  taskId?: string
  // Entregable descargable (código ensamblado) + metadatos del proyecto
  code?: string
  filename?: string
  projectName?: string
  artifacts?: string[]
  workspaceDir?: string
}

// Mensaje de una conversación directa con un agente (modo "GPT/chatbot")
export interface AgentChatMsg {
  id: number
  role: 'user' | 'agent'
  text: string
  tokens?: number
  time: string
  error?: boolean
}

export type Mode = 'demo' | 'prod'

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))
let seq = 1

const now = () => new Date().toLocaleTimeString('es', { hour12: false })

type Look = { hair: string; shirt: string; character: string; cut?: string; glasses?: boolean; skin?: string }
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
  // Agente seleccionado (el que estoy usando ahora mismo) + conversaciones directas
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(() => localStorage.getItem('sc_selected') || null)
  const [agentChats, setAgentChats] = useState<Record<string, AgentChatMsg[]>>(() => {
    try {
      return JSON.parse(localStorage.getItem('sc_agentchats') ?? '{}') as Record<string, AgentChatMsg[]>
    } catch {
      return {}
    }
  })
  const [chattingWith, setChattingWith] = useState<string | null>(null) // agente con ventana de chat abierta
  const [agentThinking, setAgentThinking] = useState<string | null>(null) // agente procesando un mensaje directo
  const [docs, setDocs] = useState<LiveDoc[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('sc_docs') ?? '[]') as LiveDoc[]
    } catch {
      return []
    }
  })
  const tickRef = useRef(0)
  const knownTasks = useRef<Set<string>>(new Set())
  const modeRef = useRef(mode)
  modeRef.current = mode
  const prevStatus = useRef<Record<string, string>>({})

  const pushActivity = useCallback((agent: string, text: string, kind: ActivityItem['kind']) => {
    setActivity((prev) => [{ id: seq++, time: now(), agent, text, kind }, ...prev].slice(0, 30))
  }, [])

  // Persistir hojas + hidratar desde tareas completadas con entregable
  useEffect(() => {
    try {
      localStorage.setItem('sc_docs', JSON.stringify(docs.slice(0, 12)))
    } catch {
      /* noop */
    }
  }, [docs])

  useEffect(() => {
    setDocs((prev) => {
      const have = new Set(prev.filter((d) => d.taskId).map((d) => d.taskId as string))
      const next = [...prev]
      let changed = false
      for (const t of tasks) {
        if (t.status === 'completed' && t.result && !have.has(t.id)) {
          next.unshift({
            id: `doc-${t.id}`,
            title: t.title,
            question: t.desc,
            full: t.result,
            agentName: t.agentName ?? 'Boss',
            agentId: agents.find((a) => a.name === t.agentName)?.id ?? '',
            fresh: false,
            time: now(),
            taskId: t.id,
          })
          changed = true
        }
      }
      // Solo depurar hojas huérfanas cuando ya conocemos el estado del backend
      if (knownTasks.current.size > 0) {
        const kept = next.filter((d) => !d.taskId || d.taskId.startsWith('local-') || knownTasks.current.has(d.taskId))
        if (kept.length !== next.length) return kept
      }
      return changed ? next.slice(0, 12) : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks])

  const setMode = useCallback((m: Mode) => {
    localStorage.setItem('sc_mode', m)
    setModeState(m)
  }, [])

  const applyLooks = useCallback((list: LiveAgent[]) => {
    const looks = loadLooks()
    return list.map((a) => {
      const key = a.backendId ?? a.id
      const l = looks[key] ?? looks[a.name]
      return l ? { ...a, hair: l.hair, shirt: l.shirt, character: l.character, cut: l.cut ?? a.cut, glasses: l.glasses ?? a.glasses, skin: l.skin ?? a.skin } : a
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
          knownTasks.current = new Set(bTasks.map((t) => t.id))
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
              result: t.result ?? undefined,
              provider: t.provider ?? undefined,
              model: t.model ?? undefined,
              projectId: t.project_id ?? undefined,
              projectName: t.project_name ?? undefined,
              projectBrief: t.project_brief ?? undefined,
              roleLabel: t.role_label ?? undefined,
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
          knownTasks.current = new Set(bTasks.map((t) => t.id))
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
                result: t.result ?? undefined,
                provider: t.provider ?? undefined,
                model: t.model ?? undefined,
                projectId: t.project_id ?? undefined,
                projectName: t.project_name ?? undefined,
                projectBrief: t.project_brief ?? undefined,
                roleLabel: t.role_label ?? undefined,
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
    async (text: string, override?: { provider: string; model: string }) => {
      const clean = text.trim()
      if (!clean) return
      const title = clean.slice(0, 60)
      setChat((prev) => [...prev, { id: seq++, from: 'Tú', text: clean, mine: true }].slice(-30))
      // Orquestador: Boss activo, si no el primer agente encendido
      const orch = agents.find((a) => a.is_active && a.character === 'boss') ?? agents.find((a) => a.is_active)
      if (!orch) {
        pushActivity('Sistema', 'no hay agentes encendidos: enciende al menos uno en Studio ⏻', 'error')
        return
      }
      // Modelo efectivo: el elegido en Studio se impone al del boss
      const effProvider = override?.provider ?? orch.provider
      const effModel = override?.model ?? orch.model
      pushActivity('Tú', `inyectaste requerimiento: «${clean}»`, 'warning')

      // ¿Es una petición de generación de código/sitio? Si lo es, boss DELEGA de verdad
      // y el BACKEND crea las tareas reales del proyecto (Misión/HTML/CSS/JS/ENTREGA).
      // Para no dejar una tarea "suelta" duplicada, en ese caso NO creamos placeholder.
      const isCode = /\b(c[óo]digo|html|css|js|javascript|script|crud|componente|app|función|funcion|programa|snippet|kanban|formulario|p[áa]gina|web|sitio|landing|tailwind|responsive|dashboard|portal|servicios?|front\s?end|frontend|ui|interfaz)\b/i.test(clean)

      let taskId = `local-${seq}`
      if (!isCode) {
        // Petición normal: creamos la tarea placeholder (Boss responde solo).
        try {
          const created = await createTask(title, clean, 'medium', effProvider, effModel)
          taskId = created.id
          if (orch.backendId) {
            await updateTask(taskId, { agent_id: orch.backendId, status: 'in_progress' }).catch(() => undefined)
          }
        } catch {
          pushActivity('Sistema', 'backend no respondió al crear: sigo en local', 'warning')
        }
        setTasks((prev) => [
          ...prev,
          { id: taskId, title, desc: clean, priority: 'medium', status: 'in_progress', progress: 5, agentName: orch.name, energy: 45, provider: effProvider, model: effModel },
        ])
      }
      const stage = async (progress: number, log: string, feed: string) => {
        setAgents((prev) => prev.map((a) => (a.id === orch.id ? { ...a, progress, log } : a)))
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, progress } : t)))
        pushActivity(orch.name, `${orch.name} ${feed}`, 'info')
        try {
          await updateTask(taskId, { progress }).catch(() => undefined)
          if (orch.backendId) await postAgentStatus(orch.backendId, 'working', progress).catch(() => undefined)
        } catch {
          /* noop */
        }
      }
      setAgents((prev) =>
        prev.map((a) =>
          a.id === orch.id
            ? { ...a, status: 'working', task: title, progress: 5, energy: Math.max(a.energy, 40), log: 'ejecutando…', resting: false, meeting: false, trip: 'table' as const }
            : a,
        ),
      )
      pushActivity(orch.name, `${orch.name} tomó «${title}» ▶ (${effProvider}/${effModel})`, 'success')
      if (!orch.backendId) {
        pushActivity(orch.name, `${orch.name} es local: sin backend no puede ejecutar`, 'warning')
        return
      }

      try {
        if (isCode) {
          // === DELEGACIÓN REAL: boss → pixel (CSS) + max (JS) → ensambla ===
          await sleep(1500)
          await stage(20, 'descomponiendo…', 'descompone la misión y delega a Pixel y Max 🧩')
          const res = await orchestrateCode(clean, override)
          if (res.ok && res.final) {
            // reflejar el trabajo de cada agente en la oficina
            const steps = res.steps ?? []
            for (const s of steps) {
              const who = agents.find((a) => a.name.toLowerCase() === s.agent.toLowerCase())
              if (who) {
                pushActivity(who.name, `${who.name} entregó ${s.role} con ${s.provider}/${s.model} (${s.tokens} tok)`, 'success')
                setAgents((prev) => prev.map((a) => (a.id === who.id ? { ...a, status: 'completed', log: `${s.role} ✓`, progress: 100 } : a)))
              }
            }
            await stage(80, 'ensamblando…', 'Boss conecta las devoluciones de la carpeta del proyecto 🧱')
            // Muestra la carpeta temporal y los archivos que cada agente dejó
            if (res.artifacts && res.artifacts.length) {
              pushActivity(orch.name, `📁 ${res.workspace_dir ?? 'carpeta'}: ${res.artifacts.length} archivos de los agentes`, 'info')
            }
            const artifactsNote = res.artifacts && res.artifacts.length
              ? `\n\n---\n📁 Carpeta del proyecto: ${res.workspace_dir}\nArchivos entregados por los agentes:\n${res.artifacts.map((a) => `• ${a}`).join('\n')}`
              : ''
            // Nombre de archivo a partir del proyecto (slug) + extensión por contenido
            const slug = (res.project_name || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'index'
            const ext = /<html|<!doctype/i.test(res.final) ? 'html' : 'txt'
            const doc: LiveDoc = {
              id: `doc-${seq++}`,
              title,
              question: clean,
              full: res.final + artifactsNote,
              agentName: orch.name,
              agentId: orch.id,
              fresh: true,
              time: now(),
              taskId,
              code: res.final,
              filename: `${slug}.${ext}`,
              projectName: res.project_name,
              artifacts: res.artifacts,
              workspaceDir: res.workspace_dir,
            }
            setDocs((prev) => [doc, ...prev].slice(0, 12))
            const who2 = res.delegated ? res.delegated.join(' + ') : steps.map((s) => s.agent).join(' + ')
            const breakdown = steps.map((s) => `${s.agent}=${s.role} (${s.model})`).join(' · ')
            const partialNote = res.partial ? ` ⚠️ Entrega parcial: ${res.partial_error ?? 'un paso falló'}.` : ''
            setChat((prev) =>
              [...prev, { id: seq++, from: orch.name, role: 'Orquestador', text: `Listo ✅ Proyecto «${res.project_name ?? '—'}» ensamblado.${partialNote} Agentes: ${who2}. Delegación: ${breakdown}. (${res.total_tokens ?? '?'} tok)` }].slice(-30),
            )
            pushActivity(orch.name, `${orch.name} entregó «${res.project_name ?? '—'}» 📄 (${res.total_tokens ?? '?'} tok · ${who2})`, res.partial ? 'warning' : 'success')
            // El backend ya creó la tarea "Misión" del proyecto; eliminamos el
            // placeholder local para no duplicar la misión en el Kanban.
            try {
              if (orch.backendId) await postAgentStatus(orch.backendId, 'completed', 100).catch(() => undefined)
              if (!taskId.startsWith('local-')) await apiDeleteTask(taskId).catch(() => undefined)
            } catch {
              /* noop */
            }
            setTasks((prev) => prev.filter((t) => t.id !== taskId))
            setAgents((prev) => prev.map((a) => (a.id === orch.id ? { ...a, status: 'completed', progress: 100, log: 'entregado ✓' } : a)))
            // Trae las subtareas reales creadas por el backend (Misión/HTML/CSS/JS/ENTREGA),
            // ya agrupadas bajo el proyecto, para que aparezcan en el Kanban.
            void refreshTasksFromBackend()
          } else {
            pushActivity(orch.name, `Delegación falló: ${res.error ?? 'sin respuesta'}`, 'error')
            setChat((prev) => [...prev, { id: seq++, from: orch.name, role: 'Orquestador', text: `No pude completar la delegación: ${res.error ?? 'sin respuesta del proveedor'}` }].slice(-30))
            setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'blocked' } : t)))
          }
        } else {
          // === Petición normal: boss responde solo, con presupuesto amplio ===
          await sleep(2000)
          await stage(35, 'investigando…', 'está investigando 🔍')
          const res = await pingAgent(orch.backendId, clean, 4000, override)
          if (res.ok && res.reply) {
            await stage(70, 'redactando hoja…', 'está redactando la hoja 📝')
            const doc: LiveDoc = {
              id: `doc-${seq++}`,
              title,
              question: clean,
              full: res.reply,
              agentName: orch.name,
              agentId: orch.id,
              fresh: true,
              time: now(),
              taskId,
            }
            setDocs((prev) => [doc, ...prev].slice(0, 12))
            setChat((prev) =>
              [...prev, { id: seq++, from: orch.name, role: 'Orquestador', text: `Listo ✅ Dejé la hoja en la mesa de juntas — tócala para seguir el hilo. (${res.tokens ?? '?'} tok · ${res.model})` }].slice(-30),
            )
            pushActivity(orch.name, `${orch.name} entregó documento en la mesa 📄 (${res.tokens ?? '?'} tok)`, 'success')
            try {
              await updateTask(taskId, { status: 'completed', progress: 100, result: res.reply.slice(0, 20000), tokens_used: res.tokens ?? 0, provider: res.provider ?? effProvider, model: res.model ?? effModel })
              if (orch.backendId) await postAgentStatus(orch.backendId, 'completed', 100).catch(() => undefined)
            } catch {
              /* noop */
            }
            setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'completed', progress: 100, result: res.reply, provider: res.provider ?? effProvider, model: res.model ?? effModel } : t)))
            setAgents((prev) => prev.map((a) => (a.id === orch.id ? { ...a, status: 'completed', progress: 100, log: 'entregado ✓' } : a)))
          } else if (res.mood) {
            setMood(orch.id, res.mood)
            setChat((prev) => [...prev, { id: seq++, from: orch.name, role: 'Orquestador', text: res.mood!.headline }].slice(-30))
            pushActivity(orch.name, `${res.mood.headline}`, 'warning')
          }
        }
      } catch {
        pushActivity(orch.name, `${orch.name} no pudo ejecutar (red local)`, 'error')
      } finally {
        window.setTimeout(() => {
          setAgents((prev) => prev.map((a) => (a.id === orch.id ? { ...a, trip: null } : a)))
        }, 9000)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pushActivity, agents],
  )

  const approveTask = useCallback(
    (id: string) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'in_progress', progress: Math.max(t.progress, 5) } : t)))
      pushActivity('Tú', 'aprobaste tarea de alto costo (human-in-the-loop) → En progreso', 'success')
    },
    [pushActivity],
  )

  // Relee las tareas del backend y reemplaza las de origen backend en el estado
  // (conserva las locales que aún no existen en backend). Se usa tras una
  // delegación para que aparezcan las subtareas reales ya agrupadas por proyecto.
  const refreshTasksFromBackend = useCallback(async () => {
    try {
      const [bAgents, bTasks] = await Promise.all([getAgents(), getTasks()])
      if (bTasks.length === 0) return
      knownTasks.current = new Set(bTasks.map((t) => t.id))
      const mapped: LiveTask[] = bTasks.map((t) => {
        const an = bAgents.find((x) => x.id === t.agent_id)?.name
        return {
          id: t.id,
          title: t.title,
          desc: t.description,
          priority: t.priority,
          status: t.status,
          progress: Math.round(t.progress),
          agentName: an,
          energy: 50,
          result: t.result ?? undefined,
          provider: t.provider ?? undefined,
          model: t.model ?? undefined,
          projectId: t.project_id ?? undefined,
          projectName: t.project_name ?? undefined,
          projectBrief: t.project_brief ?? undefined,
          roleLabel: t.role_label ?? undefined,
        }
      })
      setTasks((prev) => {
        // conserva solo las tareas locales (id local-...) que no estén en backend
        const locals = prev.filter((t) => t.id.startsWith('local-') && !knownTasks.current.has(t.id))
        return [...locals, ...mapped]
      })
    } catch {
      /* offline: deja el estado como está */
    }
  }, [])

  // Eliminar una tarea (local o backend)
  const removeTask = useCallback(
    async (id: string) => {
      const t = tasks.find((x) => x.id === id)
      setTasks((prev) => prev.filter((x) => x.id !== id))
      pushActivity('Tú', `🗑 eliminaste «${t?.title ?? id}»`, 'warning')
      if (!id.startsWith('local-')) {
        try {
          await apiDeleteTask(id)
        } catch {
          pushActivity('Sistema', 'no pude eliminar en backend (red): quitada solo local', 'warning')
        }
      }
    },
    [tasks, pushActivity],
  )

  // Eliminar un proyecto completo (todas sus subtareas)
  const removeProject = useCallback(
    async (projectId: string, projectName?: string) => {
      setTasks((prev) => prev.filter((x) => x.projectId !== projectId))
      pushActivity('Tú', `🗑 eliminaste el proyecto «${projectName ?? projectId}» y sus tareas`, 'warning')
      try {
        await apiDeleteProjectTasks(projectId)
      } catch {
        pushActivity('Sistema', 'no pude eliminar el proyecto en backend (red)', 'warning')
      }
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

  const openDoc = useCallback((id: string) => {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, fresh: false } : d)))
  }, [])

  const followUpDoc = useCallback(
    async (docId: string, text: string) => {
      const clean = text.trim()
      if (!clean) return
      const doc = docs.find((d) => d.id === docId)
      if (!doc) return
      const ag = agents.find((a) => a.id === doc.agentId)
      pushActivity(ag?.name ?? doc.agentName, `continúa el hilo de «${doc.title}» 🧵`, 'info')
      if (!ag?.backendId) return
      try {
        const res = await pingAgent(
          ag.backendId,
          `Hilo sobre: ${doc.question}\nRespuesta dada: ${doc.full.slice(0, 1500)}\nSeguimiento del usuario: ${clean}`,
          300,
        )
        if (res.ok && res.reply) {
          setDocs((prev) =>
            prev.map((d) =>
              d.id === docId ? { ...d, full: `${d.full}\n\n▶ ${clean}\n${res.reply}`, fresh: true, time: now() } : d,
            ),
          )
          pushActivity(ag.name, `${ag.name} amplió la hoja 📄 (+${res.tokens ?? '?'} tok)`, 'success')
        } else if (res.mood) {
          setMood(ag.id, res.mood)
          pushActivity(ag.name, res.mood.headline, 'warning')
        }
      } catch {
        pushActivity(ag.name, `${ag.name} no pudo continuar el hilo (red)`, 'error')
      }
    },
    [docs, agents, pushActivity, setMood],
  )

  // --- Agente seleccionado (indicador "sombreado" global) ---
  const selectAgent = useCallback((id: string | null) => {
    setSelectedAgentId(id)
    try {
      if (id) localStorage.setItem('sc_selected', id)
      else localStorage.removeItem('sc_selected')
    } catch {
      /* noop */
    }
  }, [])

  // --- Ventana de chat tipo chatbot por agente ---
  const openAgentChat = useCallback((id: string) => {
    setChattingWith(id)
    selectAgent(id)
  }, [selectAgent])

  const closeAgentChat = useCallback(() => setChattingWith(null), [])

  // Persistir conversaciones directas
  useEffect(() => {
    try {
      localStorage.setItem('sc_agentchats', JSON.stringify(agentChats))
    } catch {
      /* noop */
    }
  }, [agentChats])

  // Enviar un mensaje directo a un agente (usa pingAgent → su proveedor real)
  const sendAgentMessage = useCallback(
    async (agentId: string, text: string) => {
      const clean = text.trim()
      if (!clean) return
      const ag = agents.find((a) => a.id === agentId)
      if (!ag) return
      const stamp = now()
      setAgentChats((prev) => ({
        ...prev,
        [agentId]: [...(prev[agentId] ?? []), { id: seq++, role: 'user', text: clean, time: stamp }],
      }))
      if (!ag.backendId) {
        setAgentChats((prev) => ({
          ...prev,
          [agentId]: [
            ...(prev[agentId] ?? []),
            { id: seq++, role: 'agent', text: `${ag.name} es un agente local sin backend: no puedo ejecutar un modelo real. Créalo en el backend para chatear de verdad.`, time: now(), error: true },
          ],
        }))
        return
      }
      setAgentThinking(agentId)
      // el agente "trabaja" visualmente mientras responde en el chat directo
      setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, status: 'working', log: 'respondiendo chat…' } : a)))
      // breve contexto: últimos turnos de la conversación
      const history = (agentChats[agentId] ?? []).slice(-6).map((m) => `${m.role === 'user' ? 'Usuario' : ag.name}: ${m.text}`).join('\n')
      const prompt = history ? `${history}\nUsuario: ${clean}` : clean
      try {
        const res = await pingAgent(ag.backendId, prompt, 4000)
        if (res.ok && res.reply) {
          setAgentChats((prev) => ({
            ...prev,
            [agentId]: [...(prev[agentId] ?? []), { id: seq++, role: 'agent', text: res.reply!, tokens: res.tokens, time: now() }],
          }))
          pushActivity(ag.name, `${ag.name} respondió en chat directo 💬 (${res.tokens ?? '?'} tok)`, 'info')
          // "Hilo" visible en oficina/estudio: una hoja por agente que acumula la conversación
          const threadId = `thread-${agentId}`
          const entry = `▶ ${clean}\n${res.reply}`
          setDocs((prev) => {
            const existing = prev.find((d) => d.id === threadId)
            if (existing) {
              return prev.map((d) => (d.id === threadId ? { ...d, full: `${d.full}\n\n${entry}`, question: clean, fresh: true, time: now() } : d))
            }
            const doc: LiveDoc = {
              id: threadId,
              title: `Hilo · ${ag.name}`,
              question: clean,
              full: entry,
              agentName: ag.name,
              agentId: ag.id,
              fresh: true,
              time: now(),
            }
            return [doc, ...prev].slice(0, 12)
          })
          setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, status: 'completed', log: 'respondió ✓' } : a)))
        } else {
          setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, status: 'idle', log: pick(CHATTER) } : a)))
          const head = res.mood?.headline ?? `${ag.name} no pudo responder ahora mismo.`
          setAgentChats((prev) => ({
            ...prev,
            [agentId]: [...(prev[agentId] ?? []), { id: seq++, role: 'agent', text: head, time: now(), error: true }],
          }))
          if (res.mood) setMood(agentId, res.mood)
        }
      } catch {
        setAgentChats((prev) => ({
          ...prev,
          [agentId]: [...(prev[agentId] ?? []), { id: seq++, role: 'agent', text: `${ag.name}: error de red al contactar al backend.`, time: now(), error: true }],
        }))
      } finally {
        setAgentThinking(null)
      }
    },
    [agents, agentChats, pushActivity, setMood],
  )

  const clearAgentChat = useCallback((agentId: string) => {
    setAgentChats((prev) => {
      const next = { ...prev }
      delete next[agentId]
      return next
    })
  }, [])

  // Historial de tareas que el orquestador asignó a un agente (por nombre)
  const tasksForAgent = useCallback(
    (agentName?: string) => (agentName ? tasks.filter((t) => t.agentName === agentName) : []),
    [tasks],
  )

  return {
    agents, tasks, docs, activity, chat, stats, backendOk, wsLive, version,
    mode, setMode, sendChat, approveTask, taskControl, extendTask, pauseAgent, resumeAgent,
    saveAgent, saveLook, providerMeeting, togglePower, addAgent, removeAgent, setMood,
    openDoc, followUpDoc, fatigueOf, removeTask, removeProject, refreshTasksFromBackend,
    // nuevas capacidades
    selectedAgentId, selectAgent, chattingWith, openAgentChat, closeAgentChat,
    agentChats, agentThinking, sendAgentMessage, clearAgentChat, tasksForAgent,
  }
}
