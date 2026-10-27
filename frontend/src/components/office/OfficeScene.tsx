import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AgentSprite } from './AgentSprite'
import type { LiveAgent } from '../../hooks/useLiveOffice'
import { FATIGUE_META, fatigueOf } from '../../data/demo'

export type OfficeThemeId = 'seria' | 'marketing' | 'lab'

// Proyecto = agrupación de tareas que comparten projectId (viene del backend).
export interface OfficeProject {
  id: string
  name: string
  brief?: string
  total: number
  done: number
  progress: number
  active: boolean
  agentNames: string[]
  hasDeliverable?: boolean
  files?: string[]
}

// Tarea mínima para el drilldown del escritorio.
export interface OfficeTask {
  id: string
  title: string
  status: string
  progress: number
  roleLabel?: string
  projectName?: string
  agentName?: string
}

interface Theme {
  id: OfficeThemeId
  label: string
  icon: string
  floor: string
  floorAlt: string
  floorLine: string
  wall: string
  wallDark: string
  wainscot: string
  desk: string
  deskEdge: string
  deskTop: string
  rug: string
  screenA: string
  screenB: string
  accent: string
  panelBg: string
  panelBorder: string
  panelInk: string
  activeTitle: string
  doneTitle: string
}

const THEMES: Record<OfficeThemeId, Theme> = {
  seria: {
    id: 'seria', label: 'OFICINA SERIA', icon: '🏢',
    floor: '#D8DEE6', floorAlt: '#C7D0DA', floorLine: '#B4BEC9',
    wall: '#EDF1F5', wallDark: '#C3CDD8', wainscot: '#9FB0C2',
    desk: '#C7CFD6', deskEdge: '#8A94A0', deskTop: '#E4E9EF', rug: '#3B5B7A',
    screenA: '#0EA5E9', screenB: '#38BDF8', accent: '#2563EB',
    panelBg: 'rgba(248,250,252,.96)', panelBorder: '#94A3B8', panelInk: '#1E293B',
    activeTitle: '📋 PROYECTOS ACTIVOS', doneTitle: '✅ ENTREGADOS',
  },
  marketing: {
    id: 'marketing', label: 'AGENCIA MKT', icon: '🎨',
    floor: '#FBE3C0', floorAlt: '#F4D3A4', floorLine: '#E7BE85',
    wall: '#FFF6E8', wallDark: '#F0D9B6', wainscot: '#E7A46B',
    desk: '#E78BB3', deskEdge: '#A34B78', deskTop: '#F4A7C9', rug: '#7C3AED',
    screenA: '#F0ABFC', screenB: '#F472B6', accent: '#DB2777',
    panelBg: 'rgba(255,245,251,.96)', panelBorder: '#F472B6', panelInk: '#831843',
    activeTitle: '🎯 CAMPAÑAS ACTIVAS', doneTitle: '🚀 LANZADAS',
  },
  lab: {
    id: 'lab', label: 'LAB TECH', icon: '🔬',
    floor: '#1A2335', floorAlt: '#141C2C', floorLine: '#0D1420',
    wall: '#0E1526', wallDark: '#0A1120', wainscot: '#16233B',
    desk: '#2E3C54', deskEdge: '#131C2C', deskTop: '#3B4D6C', rug: '#0E7490',
    screenA: '#22C55E', screenB: '#4ADE80', accent: '#22D3EE',
    panelBg: 'rgba(2,8,20,.94)', panelBorder: '#22D3EE', panelInk: '#A5F3FC',
    activeTitle: '⚙ BUILDS ACTIVOS', doneTitle: '📦 DEPLOYED',
  },
}

const CW = 960
const CH = 600

// Posiciones de ESCRITORIOS de agentes (centro-izquierda). % sobre el lienzo.
// 2 filas × 2 mesas, bien separadas. Hasta 2 agentes por mesa.
const DESK_SLOTS = [
  { x: 30, y: 44 }, { x: 52, y: 44 },
  { x: 30, y: 72 }, { x: 52, y: 72 },
]
const BOSS_POS = { x: 81, y: 55 } // escritorio del orquestador (derecha, entre paneles)
const COFFEE_POS = { x: 12, y: 58 }

function restSlot(i: number): { x: number; y: number } {
  return { x: 7 + (i % 3) * 5, y: 84 + Math.floor(i / 3) * 6 }
}
const needsRest = (a: LiveAgent) =>
  !a.is_active || a.status === 'paused' || a.resting || a.meeting

function Plant({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <ellipse cx={0} cy={6} rx={15} ry={5} fill="rgba(0,0,0,.2)" />
      <circle cx={0} cy={-17} r={15} fill="#16A34A" />
      <circle cx={-11} cy={-8} r={10} fill="#22C55E" />
      <circle cx={11} cy={-8} r={10} fill="#4ADE80" />
      <rect x={-9} y={0} width={18} height={13} fill="#B45309" />
    </g>
  )
}

// Escritorio dibujado en SVG. `boss` = versión destacada del orquestador.
function DeskUnit({
  x, y, t, seats, lit, building, highlight, boss = false, onClick,
}: {
  x: number; y: number; t: Theme; seats: number; lit: boolean
  building: boolean; highlight: boolean; boss?: boolean; onClick?: () => void
}) {
  const cx = (x / 100) * CW
  const cy = (y / 100) * CH
  const wide = seats >= 2
  const halfW = boss ? 78 : wide ? 92 : 64
  const monX = boss ? [-36, 36] : wide ? [-46, 46] : [0]
  // El Boss SIEMPRE tiene las pantallas encendidas (centro de mando).
  const screenOn = lit || boss
  return (
    <g transform={`translate(${cx},${cy})`} style={{ cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <ellipse cx={0} cy={30} rx={halfW + 6} ry={18} fill={boss ? t.accent : t.rug} opacity={boss ? 0.16 : 0.16} />
      {highlight && (
        <rect x={-halfW - 10} y={-62} width={(halfW + 10) * 2} height={116} rx={8} fill="none" stroke={t.accent} strokeWidth={3}>
          <animate attributeName="opacity" values="0.35;1;0.35" dur="1.3s" repeatCount="indefinite" />
        </rect>
      )}
      {boss && <rect x={-16} y={-16} width={32} height={26} rx={7} fill={t.deskEdge} opacity={0.9} />}
      {/* monitores SOBRE la mesa */}
      {monX.map((mx, idx) => (
        <g key={idx} transform={`translate(${mx},-50) ${building ? 'scale(1,0.06)' : ''}`} style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}>
          <rect x={-24} y={-18} width={48} height={32} rx={3} fill="#0F172A" stroke="#05080E" strokeWidth={3} />
          <rect x={-20} y={-14} width={40} height={24} rx={1} fill={screenOn ? t.screenA : '#1E293B'} className={screenOn ? 'sc-mon' : undefined} />
          {screenOn && <rect x={-16} y={-10} width={18} height={3} fill={t.screenB} opacity={0.95} />}
          {screenOn && <rect x={-16} y={-4} width={28} height={3} fill={t.screenB} opacity={0.65} />}
          {screenOn && <rect x={-16} y={2} width={14} height={3} fill={t.screenB} opacity={0.65} />}
          <rect x={-4} y={14} width={8} height={5} fill="#334155" />
          <rect x={-12} y={19} width={24} height={4} rx={2} fill="#475569" />
        </g>
      ))}
      <rect x={-halfW} y={-4} width={halfW * 2} height={42} rx={4} fill={t.desk} stroke={boss ? t.accent : t.deskEdge} strokeWidth={boss ? 4 : 3} />
      <rect x={-halfW} y={-4} width={halfW * 2} height={8} rx={4} fill={t.deskTop} />
      {monX.map((mx, idx) => (
        <g key={`kb-${idx}`} transform={`translate(${mx},0)`}>
          <rect x={-24} y={16} width={48} height={12} rx={2} fill="#E5E7EB" stroke="#9CA3AF" strokeWidth={1.5} />
          {[-17, -6, 5, 14].map((kx) => <rect key={kx} x={kx} y={19} width={6} height={3} fill="#9CA3AF" />)}
        </g>
      ))}
      {boss && (
        <g>
          <rect x={-50} y={18} width={100} height={15} rx={3} fill="#0B1220" stroke={t.accent} strokeWidth={1.5} />
          <text x={0} y={29} textAnchor="middle" fontSize={9} fill={t.accent} fontFamily="monospace" fontWeight="bold">ORQUESTADOR</text>
        </g>
      )}
      {building && (
        <g>
          <rect x={-15} y={-2} width={30} height={20} rx={2} fill="#B45309" stroke="#78350F" strokeWidth={2} />
          <text x={0} y={13} textAnchor="middle" fontSize={11}>🔧</text>
        </g>
      )}
    </g>
  )
}

export function OfficeScene({
  agents,
  stats,
  onAgentClick,
  projects = [],
  tasks = [],
  onSelectProject,
  selectedProjectId = null,
  onDeleteProject,
  onDownloadProject,
  onOpenTask,
  selectedId = null,
}: {
  agents: LiveAgent[]
  stats: { total: number; working: number; blocked: number; done: number; global: number; off?: number }
  onAgentClick?: (id: string) => void
  projects?: OfficeProject[]
  tasks?: OfficeTask[]
  onSelectProject?: (id: string | null) => void
  selectedProjectId?: string | null
  onDeleteProject?: (id: string, name?: string) => void
  onDownloadProject?: (id: string, name?: string) => void
  onOpenTask?: (taskId: string) => void
  selectedId?: string | null
}) {
  const [themeId, setThemeId] = useState<OfficeThemeId>(() => (localStorage.getItem('sc_theme') as OfficeThemeId) || 'seria')
  const [expandedDesk, setExpandedDesk] = useState<number | 'boss' | null>(null)
  const t = THEMES[themeId]
  const dark = themeId === 'lab'
  const ink = dark ? '#E2E8F0' : '#475569'
  const pick = (id: OfficeThemeId) => {
    setThemeId(id)
    try { localStorage.setItem('sc_theme', id) } catch { /* noop */ }
  }

  // animación de "instalación de escritorio" al encender un agente
  const [building, setBuilding] = useState<Record<string, number>>({})
  const prevActive = useRef<Record<string, boolean>>({})
  useEffect(() => {
    const now = Date.now()
    const next: Record<string, number> = {}
    for (const a of agents) {
      const was = prevActive.current[a.id]
      if (was === false && a.is_active) next[a.id] = now + 2600
      prevActive.current[a.id] = a.is_active
    }
    if (Object.keys(next).length) {
      setBuilding((b) => ({ ...b, ...next }))
      const to = window.setTimeout(() => {
        setBuilding((b) => {
          const copy = { ...b }
          for (const k of Object.keys(next)) delete copy[k]
          return copy
        })
      }, 2700)
      return () => window.clearTimeout(to)
    }
    return undefined
  }, [agents])
  const isBuilding = (id: string) => (building[id] ?? 0) > Date.now()

  const restOrder = [...agents].filter(needsRest).sort((a, b) => a.name.localeCompare(b.name))
  const restAt = (id: string): { x: number; y: number } => restSlot(Math.max(0, restOrder.findIndex((a) => a.id === id)))
  const isWalker = (a: LiveAgent) => a.desk === 7 && a.is_active && a.status !== 'paused' && !a.resting && !a.meeting

  const deskAgents = useMemo(
    () => agents.filter(
      (a) => a.is_active && !needsRest(a) && !isWalker(a) && a.trip !== 'table' &&
        a.desk !== 6 && a.desk !== 8 && a.character !== 'nex',
    ),
    [agents],
  )
  const deskGroups = useMemo(() => {
    const groups: LiveAgent[][] = DESK_SLOTS.map(() => [])
    deskAgents.forEach((a, idx) => {
      const slot = Math.floor(idx / 2) % DESK_SLOTS.length
      groups[slot].push(a)
    })
    return groups
  }, [deskAgents])

  const seatPos = (a: LiveAgent): { x: number; y: number } => {
    if (needsRest(a)) return restAt(a.id)
    if (a.desk === 6) return BOSS_POS
    if (a.desk === 8 || a.character === 'nex') return COFFEE_POS
    if (a.desk === 7) return { x: 42, y: 58 }
    for (let s = 0; s < deskGroups.length; s++) {
      const g = deskGroups[s]
      const pos = g.findIndex((x) => x.id === a.id)
      if (pos >= 0) {
        const base = DESK_SLOTS[s]
        const dx = g.length >= 2 ? (pos === 0 ? -4.5 : 4.5) : 0
        return { x: base.x + dx, y: base.y }
      }
    }
    return DESK_SLOTS[a.desk % DESK_SLOTS.length]
  }

  const walkers = agents.filter(isWalker)
  const seated = agents.filter((a) => !isWalker(a))

  const isTyping = (a: LiveAgent) =>
    a.is_active && !a.resting && !a.meeting && !isBuilding(a.id) &&
    (a.status === 'working' || a.status === 'progress' || a.status === 'thinking')

  const spriteStatus = (a: LiveAgent): string => {
    if (!a.is_active) return 'paused'
    if (a.resting) return 'blocked'
    if (isTyping(a)) return 'typing'
    return a.status
  }
  const isSeatedDesk = (a: LiveAgent) =>
    a.is_active && !needsRest(a) && !isWalker(a) &&
    a.desk !== 8 && a.character !== 'nex'

  const bubbleFor = (a: LiveAgent): string =>
    a.mood ? a.mood.headline
    : isBuilding(a.id) ? '🔧 instalando equipo…'
    : a.meeting ? '☕ reunión BYOK' : a.resting ? 'Zzz…' : a.status === 'paused' ? '⏸ en pausa'
    : a.status === 'blocked' ? '🚩 ¡Necesito soporte!' : a.status === 'thinking' ? '💭…'
    : a.status === 'working' ? '⌨ ejecutando…' : a.log

  const nameTag = (a: LiveAgent) => {
    if (!a.is_active) {
      return (
        <div style={{ textAlign: 'center', marginTop: -2 }}>
          <div style={{ fontSize: 10, fontWeight: 'bold', color: '#9CA3AF', background: 'rgba(20,20,20,.9)', borderRadius: 4, padding: '0 4px', display: 'inline-block', fontFamily: 'monospace' }}>
            {a.name} · 💤
          </div>
        </div>
      )
    }
    const fat = fatigueOf(a.energy)
    return (
      <div style={{ textAlign: 'center', marginTop: -2 }}>
        <div style={{ fontSize: 10, fontWeight: 'bold', color: FATIGUE_META[fat].color, background: 'rgba(255,255,255,.92)', borderRadius: 4, padding: '0 4px', display: 'inline-block', fontFamily: 'monospace' }}>
          {a.name} · {Math.round(a.energy)}%
        </div>
        <div style={{ width: 50, height: 4, background: 'rgba(0,0,0,.45)', borderRadius: 3, margin: '2px auto 0', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, a.energy)}%`, height: '100%', background: FATIGUE_META[fat].color }} />
        </div>
      </div>
    )
  }

  const activeProjects = projects.filter((p) => p.active)
  const doneProjects = projects.filter((p) => !p.active)
  const boss = agents.find((a) => a.desk === 6 && a.is_active)

  const expandedAgents =
    expandedDesk === 'boss' ? (boss ? [boss] : [])
    : typeof expandedDesk === 'number' ? deskGroups[expandedDesk] ?? []
    : []
  const expandedTasks = useMemo(() => {
    if (expandedDesk == null) return []
    const names = new Set(expandedAgents.map((a) => a.name))
    return tasks.filter((tk) => {
      if (tk.agentName && names.has(tk.agentName)) return true
      if (expandedDesk === 'boss' && (tk.roleLabel === 'MISIÓN' || tk.roleLabel === 'ENTREGA')) return true
      return false
    })
  }, [expandedDesk, expandedAgents, tasks])

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '960 / 600', borderRadius: 12, overflow: 'hidden', border: '2px solid #2A2A2A', background: dark ? '#060a12' : '#0d0d0d' }}>
      <style>{`
        .sc-px { shape-rendering: crispEdges; image-rendering: pixelated; }
        .sc-mon { animation: sc-mon 3.2s steps(2) infinite; }
        @keyframes sc-mon { 0%,100% { opacity: 1; } 50% { opacity: 0.65; } }
        .sc-light { animation: sc-light 1.6s steps(2) infinite; }
        @keyframes sc-light { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }
        .sc-steam { animation: sc-steam 2.6s ease-in-out infinite; }
        @keyframes sc-steam { 0% { opacity: 0; transform: translateY(0); } 40% { opacity: .8; } 100% { opacity: 0; transform: translateY(-8px); } }
        .sc-bubble { animation: sc-bob 2.4s ease-in-out infinite; }
        @keyframes sc-bob { 0%,100% { transform: translate(-50%,0); } 50% { transform: translate(-50%,-3px); } }
        .sc-panel-row:hover { background: rgba(125,125,125,.14); }
      `}</style>

      {/* ===================== FONDO SVG (sala) ===================== */}
      <svg viewBox="0 0 960 600" className="sc-px" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {/* piso */}
        <rect x={0} y={0} width={CW} height={CH} fill={t.floor} />
        {themeId === 'lab' ? (
          <g opacity={0.5}>
            {Array.from({ length: 16 }).map((_, i) => <line key={`v${i}`} x1={i * 60} y1={96} x2={i * 60} y2={CH} stroke={t.floorLine} strokeWidth={1} />)}
            {Array.from({ length: 9 }).map((_, j) => <line key={`h${j}`} x1={0} y1={96 + j * 56} x2={CW} y2={96 + j * 56} stroke={t.floorLine} strokeWidth={1} />)}
          </g>
        ) : (
          Array.from({ length: 24 }).map((_, i) =>
            Array.from({ length: 11 }).map((_, j) =>
              (i + j) % 2 === 0 ? <rect key={`${i}-${j}`} x={i * 40} y={96 + j * 46} width={40} height={46} fill={t.floorAlt} opacity={0.7} /> : null,
            ),
          )
        )}
        {/* muros */}
        <rect x={0} y={0} width={CW} height={96} fill={t.wall} />
        <rect x={0} y={82} width={CW} height={14} fill={t.wainscot} />
        {themeId === 'seria' && Array.from({ length: 20 }).map((_, i) => <rect key={i} x={10 + i * 48} y={84} width={2} height={10} fill={t.wallDark} opacity={0.5} />)}
        {dark && Array.from({ length: 24 }).map((_, i) => <rect key={i} x={i * 40} y={86} width={20} height={3} fill={t.accent} opacity={0.25} />)}
        <rect x={0} y={0} width={12} height={CH} fill={t.wallDark} />
        <rect x={948} y={0} width={12} height={CH} fill={t.wallDark} />
        <rect x={0} y={588} width={CW} height={12} fill={t.wallDark} />

        {/* ambiente de pared por tema (solo lado izquierdo/centro, no estorba paneles) */}
        {themeId === 'seria' && [110, 300, 490].map((x) => (
          <g key={x}>
            <rect x={x} y={16} width={110} height={50} fill="#6E8BA8" stroke={t.wallDark} strokeWidth={3} />
            <rect x={x + 6} y={22} width={46} height={38} fill="#BFE3FB" />
            <rect x={x + 58} y={22} width={46} height={38} fill="#A6D4F5" />
            <rect x={x + 52} y={22} width={6} height={38} fill={t.wallDark} />
          </g>
        ))}
        {themeId === 'marketing' && [{ x: 110, c: '#F472B6' }, { x: 250, c: '#A78BFA' }, { x: 390, c: '#FBBF24' }, { x: 520, c: '#34D399' }].map((f) => (
          <g key={f.x}>
            <rect x={f.x} y={16} width={90} height={50} fill="#fff" stroke={f.c} strokeWidth={4} />
            <circle cx={f.x + 26} cy={36} r={8} fill={f.c} />
            <rect x={f.x + 10} y={50} width={60} height={5} fill={f.c} opacity={0.7} />
          </g>
        ))}
        {dark && [110, 260, 410].map((x) => (
          <g key={x}>
            <rect x={x} y={16} width={118} height={50} fill="#020617" stroke={t.accent} strokeWidth={2} />
            <polyline points={`${x + 8},48 ${x + 28},34 ${x + 48},42 ${x + 70},24 ${x + 92},38 ${x + 110},30`} fill="none" stroke="#22C55E" strokeWidth={2} />
          </g>
        ))}
        {/* reloj */}
        <g>
          <circle cx={905} cy={40} r={18} fill="#F8FAFC" stroke="#1F2937" strokeWidth={3} />
          <line x1={905} y1={40} x2={905} y2={28} stroke="#1F2937" strokeWidth={3} />
          <line x1={905} y1={40} x2={913} y2={43} stroke="#1F2937" strokeWidth={3} />
        </g>

        {/* sala de descanso (izquierda) */}
        <rect x={22} y={104} width={150} height={420} rx={8} fill={dark ? '#38BDF8' : t.rug} opacity={dark ? 0.1 : 0.14} />
        <text x={97} y={122} textAnchor="middle" fontSize={11} fill={ink} fontFamily="monospace" fontWeight="bold">SALA DE DESCANSO</text>
        <rect x={36} y={392} width={124} height={48} rx={10} fill={themeId === 'marketing' ? '#DB2777' : dark ? '#1E293B' : '#7C3AED'} stroke={t.wallDark} strokeWidth={3} />
        <rect x={36} y={384} width={124} height={20} rx={8} fill={themeId === 'marketing' ? '#F472B6' : dark ? '#334155' : '#8B5CF6'} />
        <g>
          <rect x={60} y={452} width={88} height={28} rx={4} fill={t.desk} stroke={t.deskEdge} strokeWidth={3} />
          <circle cx={86} cy={466} r={6} fill="#EF4444" />
          <circle cx={86} cy={460} r={4} fill="#E5E7EB" className="sc-steam" />
        </g>
        <g>
          <rect x={40} y={150} width={52} height={88} rx={4} fill={dark ? '#334155' : '#E5E7EB'} stroke={t.wallDark} strokeWidth={3} />
          <rect x={52} y={164} width={28} height={14} fill="#60A5FA" opacity={0.7} />
        </g>

        {/* server rack + planta esquina */}
        <g>
          <rect x={30} y={540} width={80} height={32} rx={4} fill="#111827" stroke="#374151" strokeWidth={3} />
          {[548, 561].map((y, i) => (
            <g key={y}>
              <rect x={38} y={y} width={64} height={9} fill="#1F2937" stroke="#374151" />
              <circle cx={46} cy={y + 4} r={3} fill={i % 2 ? '#22C55E' : '#EF4444'} className="sc-light" />
            </g>
          ))}
        </g>
        <Plant x={200} y={560} />
        <Plant x={430} y={566} />

        {/* puerta + tapete */}
        <g>
          <rect x={380} y={560} width={96} height={26} fill={dark ? '#020617' : '#334155'} />
          <rect x={362} y={530} width={132} height={24} rx={4} fill={themeId === 'marketing' ? '#DB2777' : t.accent} />
          <text x={428} y={547} textAnchor="middle" fontSize={12} fill="#fff" fontFamily="monospace" fontWeight="bold">seecontrol</text>
        </g>

        {/* ===== ESCRITORIOS DE AGENTES ===== */}
        {deskGroups.map((g, s) => {
          if (g.length === 0) return null
          const base = DESK_SLOTS[s]
          const lit = g.some((a) => isTyping(a) || a.status === 'completed')
          const building2 = g.some((a) => isBuilding(a.id))
          return (
            <DeskUnit key={`desk-${s}`} x={base.x} y={base.y} t={t} seats={g.length} lit={lit} building={building2}
              highlight={expandedDesk === s} onClick={() => setExpandedDesk((d) => (d === s ? null : s))} />
          )
        })}

        {/* ===== ESCRITORIO DEL BOSS (orquestador) ===== */}
        {boss && (
          <DeskUnit x={BOSS_POS.x} y={BOSS_POS.y} t={t} seats={1} boss
            lit building={isBuilding(boss.id)} highlight={expandedDesk === 'boss'}
            onClick={() => setExpandedDesk((d) => (d === 'boss' ? null : 'boss'))} />
        )}
      </svg>

      {/* ===================== PANEL: PROYECTOS ACTIVOS (HTML, legible) ===================== */}
      <ProjectPanel
        title={t.activeTitle} t={t} kind="active" projects={activeProjects}
        style={{ right: '2%', top: '13%', width: '31%', maxHeight: '27%' }}
        selectedProjectId={selectedProjectId}
        onSelectProject={onSelectProject}
        onDeleteProject={onDeleteProject}
      />

      {/* ===================== PANEL: ENTREGABLES (HTML, legible) ===================== */}
      <ProjectPanel
        title={t.doneTitle} t={t} kind="done" projects={doneProjects}
        style={{ right: '2%', bottom: '3%', width: '31%', maxHeight: '32%' }}
        selectedProjectId={selectedProjectId}
        onSelectProject={onSelectProject}
        onDeleteProject={onDeleteProject}
        onDownloadProject={onDownloadProject}
      />

      {/* ===================== AGENTES ===================== */}
      {seated.map((a) => {
        const p = seatPos(a)
        const fat = fatigueOf(a.energy)
        const aura = !a.is_active ? '#4B5563' : a.resting ? FATIGUE_META.burnout.color : FATIGUE_META[fat].color
        const showBubble = a.is_active && (a.mood || isBuilding(a.id) || a.status === 'working' || a.status === 'blocked' || a.status === 'thinking' || a.status === 'paused' || a.resting || a.meeting || a.character === 'boss')
        const isSel = selectedId === a.id
        const seatedDesk = isSeatedDesk(a)
        return (
          <motion.div
            key={a.id}
            title={`${a.name} · ${a.role} — clic para chatear 💬`}
            onClick={() => onAgentClick?.(a.id)}
            initial={false}
            animate={{ left: `${p.x}%`, top: `${p.y}%`, scale: isSel ? 1.08 : 1 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
            style={{ position: 'absolute', transform: seatedDesk ? 'translate(-50%,-116%)' : 'translate(-50%,-100%)', zIndex: isSel ? 8 : 5, cursor: 'pointer', opacity: a.is_active ? 1 : 0.5, filter: a.is_active ? 'none' : 'grayscale(0.8)' }}
          >
            {showBubble && (
              <div className="sc-bubble" style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translate(-50%,0)', marginBottom: 48, background: a.mood ? '#FEF3C7' : '#fff', color: '#111', fontSize: 10, padding: '4px 8px', borderRadius: 8, border: a.mood ? '2px solid #F59E0B' : '2px solid #111', whiteSpace: a.mood ? 'normal' : 'nowrap', width: a.mood ? 180 : undefined, fontFamily: 'monospace', zIndex: 6 }}>
                {a.mood ? (<span><b>{a.mood.headline}</b><br /><span style={{ fontSize: 8, color: '#78716C' }}>{a.mood.detail}</span></span>) : bubbleFor(a)}
              </div>
            )}
            <AgentSprite hair={a.hair} shirt={a.shirt} cut={a.cut} px={4}
              status={isBuilding(a.id) ? 'idle' : spriteStatus(a)} aura={aura} selected={isSel}
              seated={seatedDesk && !isBuilding(a.id)} glasses={a.glasses ?? a.character === 'data'} skin={a.skin} />
            {nameTag(a)}
          </motion.div>
        )
      })}

      {/* caminante (Scout) */}
      {walkers.map((a) => (
        <motion.div key={a.id} title={`${a.name} · ${a.role} — clic para chatear 💬`}
          style={{ position: 'absolute', left: '28%', top: '58%', zIndex: selectedId === a.id ? 8 : 5, cursor: 'pointer' }}
          animate={{ left: ['28%', '58%', '58%', '28%', '28%'], top: ['58%', '58%', '74%', '74%', '58%'] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
          onClick={() => onAgentClick?.(a.id)}>
          <div style={{ transform: 'translate(-50%,-100%)' }}>
            <div className="sc-bubble" style={{ position: 'absolute', bottom: '100%', left: '50%', marginBottom: 48, background: '#fff', color: '#111', fontSize: 10, padding: '4px 8px', borderRadius: 8, border: '2px solid #111', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>🚶 {bubbleFor(a)}</div>
            <AgentSprite hair={a.hair} shirt={a.shirt} cut={a.cut} px={4} status="working" aura={FATIGUE_META[fatigueOf(a.energy)].color} selected={selectedId === a.id} glasses={a.glasses} skin={a.skin} />
            {nameTag(a)}
          </div>
        </motion.div>
      ))}

      {/* ===================== DRILLDOWN ESCRITORIO ===================== */}
      <AnimatePresence>
        {expandedDesk != null && expandedAgents.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(5,7,12,.6)', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setExpandedDesk(null)}>
            <motion.div initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '74%', maxHeight: '84%', overflowY: 'auto', background: '#121820', border: `2px solid ${t.accent}`, borderRadius: 14, padding: 16, fontFamily: 'monospace', boxShadow: '0 10px 40px rgba(0,0,0,.6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 'bold' }}>
                  {expandedDesk === 'boss' ? '👑 Escritorio del Orquestador (Boss)' : `🖥 Escritorio #${(expandedDesk as number) + 1}`}
                </span>
                <button onClick={() => setExpandedDesk(null)} style={{ background: '#262626', color: '#fff', border: '1px solid #333', borderRadius: 6, cursor: 'pointer', padding: '4px 10px' }}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                {expandedAgents.map((a) => {
                  const fat = fatigueOf(a.energy)
                  return (
                    <div key={a.id} onClick={() => onAgentClick?.(a.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1A1F29', border: `1px solid ${a.shirt}`, borderRadius: 10, padding: '6px 12px', cursor: 'pointer' }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: a.shirt, border: '1px solid #000' }} />
                      <div>
                        <div style={{ fontSize: 12, color: '#fff', fontWeight: 'bold' }}>{a.name}</div>
                        <div style={{ fontSize: 10, color: FATIGUE_META[fat].color }}>{a.role} · {Math.round(a.energy)}%</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ fontSize: 11, color: '#78716C', marginBottom: 8 }}>TAREAS ({expandedTasks.length})</div>
              {expandedTasks.length === 0 ? (
                <div style={{ fontSize: 12, color: '#57534E' }}>Sin tareas asignadas todavía.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
                  {expandedTasks.map((tk) => {
                    const col = tk.status === 'completed' ? '#22C55E' : tk.status === 'blocked' ? '#EF4444' : tk.status === 'paused' ? '#F59E0B' : '#38BDF8'
                    return (
                      <button key={tk.id} onClick={() => { onOpenTask?.(tk.id); setExpandedDesk(null) }} style={{ textAlign: 'left', background: '#1A1F29', border: '1px solid #2A2F3A', borderLeft: `3px solid ${col}`, borderRadius: 8, padding: 9, cursor: 'pointer', color: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tk.title}</span>
                          <span style={{ fontSize: 8, color: col, flexShrink: 0 }}>{tk.roleLabel || tk.status}</span>
                        </div>
                        {tk.projectName && <div style={{ fontSize: 9, color: '#78716C', marginTop: 2 }}>📁 {tk.projectName}</div>}
                        <div style={{ height: 4, background: '#2A2F3A', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${tk.progress}%`, height: '100%', background: col }} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* selector de ambiente */}
      <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4, zIndex: 12 }}>
        {(Object.keys(THEMES) as OfficeThemeId[]).map((id) => (
          <button key={id} onClick={() => pick(id)} title={THEMES[id].label}
            style={{ fontSize: 8, fontFamily: "'Press Start 2P', monospace", padding: '7px 8px', borderRadius: 6, cursor: 'pointer',
              border: themeId === id ? '2px solid #22C55E' : '1px solid #444',
              background: themeId === id ? 'rgba(5,46,22,.9)' : 'rgba(10,10,10,.8)',
              color: themeId === id ? '#22C55E' : '#A8A29E' }}>
            {THEMES[id].icon} {THEMES[id].label}
          </button>
        ))}
      </div>

      {/* barra de stats */}
      <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(10,10,10,.85)', border: '1px solid #333', borderRadius: 8, padding: '6px 12px', fontFamily: 'monospace', fontSize: 11, color: '#fff', zIndex: 11, whiteSpace: 'nowrap' }}>
        <span><b style={{ color: '#22C55E' }}>{stats.total}</b> Ag.</span>
        <span><b style={{ color: '#22C55E' }}>{stats.working}</b> Trab.</span>
        <span><b style={{ color: '#EF4444' }}>{stats.blocked}</b> Bloq.</span>
        <span><b style={{ color: '#38BDF8' }}>{activeProjects.length}</b> Activos</span>
        <span><b style={{ color: '#F59E0B' }}>{doneProjects.length}</b> Entreg.</span>
      </div>
    </div>
  )
}

// Panel HTML legible para listar proyectos (activos o entregados).
function ProjectPanel({
  title, t, kind, projects, style,
  selectedProjectId, onSelectProject, onDeleteProject, onDownloadProject,
}: {
  title: string
  t: Theme
  kind: 'active' | 'done'
  projects: OfficeProject[]
  style: React.CSSProperties
  selectedProjectId: string | null
  onSelectProject?: (id: string | null) => void
  onDeleteProject?: (id: string, name?: string) => void
  onDownloadProject?: (id: string, name?: string) => void
}) {
  const col = kind === 'active' ? '#F59E0B' : '#22C55E'
  return (
    <div style={{
      position: 'absolute', ...style, zIndex: 7, display: 'flex', flexDirection: 'column',
      background: t.panelBg, border: `2px solid ${t.panelBorder}`, borderRadius: 10,
      fontFamily: 'monospace', boxShadow: '0 4px 14px rgba(0,0,0,.35)', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderBottom: `1px solid ${t.panelBorder}`, flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 'bold', color: t.panelInk }}>{title}</span>
        <span style={{ fontSize: 10, fontWeight: 'bold', color: col }}>{projects.length}</span>
      </div>
      <div style={{ overflowY: 'auto', padding: 6, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
        {projects.length === 0 ? (
          <div style={{ fontSize: 10, color: t.panelInk, opacity: 0.6, padding: '8px 4px', textAlign: 'center' }}>
            {kind === 'active' ? 'Sin proyectos en marcha. Pídele uno al Boss desde el chat.' : 'Aún no hay entregables. Cuando el Boss ensamble, aparecerán aquí.'}
          </div>
        ) : projects.map((p) => {
          const sel = selectedProjectId === p.id
          return (
            <div key={p.id} className="sc-panel-row"
              onClick={() => onSelectProject?.(sel ? null : p.id)}
              title={`${p.name} — ${p.done}/${p.total} tareas`}
              style={{ background: sel ? 'rgba(245,158,11,.12)' : 'rgba(255,255,255,.04)', border: `1px solid ${sel ? col : 'rgba(125,125,125,.3)'}`, borderRadius: 6, padding: 6, cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 'bold', color: t.panelInk, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {kind === 'active' ? '🟠' : '✅'} {p.name}
                </span>
                {onDeleteProject && (
                  <span onClick={(e) => { e.stopPropagation(); onDeleteProject(p.id, p.name) }} title="Eliminar proyecto"
                    style={{ fontSize: 10, color: '#DC2626', cursor: 'pointer', fontWeight: 'bold', flexShrink: 0 }}>✕</span>
                )}
              </div>
              <div style={{ height: 5, background: 'rgba(125,125,125,.25)', borderRadius: 3, marginTop: 4, overflow: 'hidden' }}>
                <div style={{ width: `${p.progress}%`, height: '100%', background: col }} />
              </div>
              <div style={{ fontSize: 8.5, color: t.panelInk, opacity: 0.8, marginTop: 3, display: 'flex', justifyContent: 'space-between' }}>
                <span>{p.done}/{p.total} tareas</span>
                <span>{p.agentNames.slice(0, 3).join(', ') || '—'}</span>
              </div>
              {kind === 'done' && p.files && p.files.length > 0 && (
                <div style={{ fontSize: 8, color: t.panelInk, opacity: 0.75, marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {p.files.slice(0, 4).map((f) => <span key={f}>📄 {f}</span>)}
                </div>
              )}
              {kind === 'done' && onDownloadProject && p.hasDeliverable && (
                <button onClick={(e) => { e.stopPropagation(); onDownloadProject(p.id, p.name) }}
                  title="Descargar entregable final"
                  style={{ marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 'bold', fontFamily: 'monospace', background: '#16A34A', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}>
                  ⬇ Descargar entregable
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
