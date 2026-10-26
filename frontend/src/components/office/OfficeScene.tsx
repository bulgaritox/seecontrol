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
  active: boolean // tiene tareas en curso
  agentNames: string[]
  hasDeliverable?: boolean // existe una tarea con entregable descargable
  files?: string[] // nombres de archivos físicos del proyecto (artefactos)
}

// Tarea mínima que la oficina necesita para el drilldown de escritorio.
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
  boardTitle: string
  boardShape: 'cork' | 'neon' | 'whiteboard'
  doneTitle: string
  pickTitle: string
}

const THEMES: Record<OfficeThemeId, Theme> = {
  seria: {
    id: 'seria', label: 'OFICINA SERIA', icon: '🏢',
    floor: '#D8DEE6', floorAlt: '#C7D0DA', floorLine: '#B4BEC9',
    wall: '#EDF1F5', wallDark: '#C3CDD8', wainscot: '#9FB0C2',
    desk: '#C7CFD6', deskEdge: '#8A94A0', deskTop: '#E4E9EF', rug: '#3B5B7A',
    screenA: '#0EA5E9', screenB: '#38BDF8', accent: '#1D4ED8',
    boardTitle: 'SPRINT · PROYECTOS', boardShape: 'cork',
    doneTitle: '✅ ENTREGADOS', pickTitle: '📋 PROYECTOS ACTIVOS',
  },
  marketing: {
    id: 'marketing', label: 'AGENCIA MKT', icon: '🎨',
    floor: '#FBE3C0', floorAlt: '#F4D3A4', floorLine: '#E7BE85',
    wall: '#FFF6E8', wallDark: '#F0D9B6', wainscot: '#E7A46B',
    desk: '#E78BB3', deskEdge: '#A34B78', deskTop: '#F4A7C9', rug: '#7C3AED',
    screenA: '#F0ABFC', screenB: '#F472B6', accent: '#DB2777',
    boardTitle: '★ CAMPAÑAS ★', boardShape: 'neon',
    doneTitle: '🚀 LANZADOS', pickTitle: '🎯 CAMPAÑAS ACTIVAS',
  },
  lab: {
    id: 'lab', label: 'LAB TECH', icon: '🔬',
    floor: '#1A2335', floorAlt: '#141C2C', floorLine: '#0D1420',
    wall: '#0E1526', wallDark: '#0A1120', wainscot: '#16233B',
    desk: '#2E3C54', deskEdge: '#131C2C', deskTop: '#3B4D6C', rug: '#0E7490',
    screenA: '#22C55E', screenB: '#4ADE80', accent: '#22D3EE',
    boardTitle: '$ projects --list', boardShape: 'whiteboard',
    doneTitle: '📦 DEPLOYED', pickTitle: '⚙ BUILDS ACTIVOS',
  },
}

// --- lienzo 960x600 ---
const CW = 960
const CH = 600

// Posiciones de ESCRITORIOS (hasta 2 agentes por mesa). En % sobre el lienzo.
const DESK_SLOTS = [
  { x: 29, y: 42 }, { x: 57, y: 42 },
  { x: 29, y: 70 }, { x: 57, y: 70 },
]
const BOSS_POS = { x: 85, y: 47 }
const COFFEE_POS = { x: 13, y: 54 }
const PICK_POS = { x: 73, y: 24 } // mesa/pizarra de proyectos activos (escoger)
const DONE_POS = { x: 84, y: 76 } // mesa de proyectos entregados

function restSlot(i: number): { x: number; y: number } {
  return { x: 7 + (i % 3) * 5, y: 82 + Math.floor(i / 3) * 7 }
}
const needsRest = (a: LiveAgent) =>
  !a.is_active || a.status === 'paused' || a.resting || a.meeting

function Plant({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <ellipse cx={0} cy={6} rx={16} ry={5} fill="rgba(0,0,0,.2)" />
      <circle cx={0} cy={-18} r={16} fill="#16A34A" />
      <circle cx={-12} cy={-8} r={11} fill="#22C55E" />
      <circle cx={12} cy={-8} r={11} fill="#4ADE80" />
      <rect x={-10} y={0} width={20} height={14} fill="#B45309" />
    </g>
  )
}

// Escritorio compartido (1-2 puestos). `building` = animación de instalación.
// `boss` = escritorio destacado del orquestador (más ancho, doble pantalla, placa).
function DeskUnit({
  x, y, t, seats, lit, building, highlight, boss = false, onClick,
}: {
  x: number; y: number; t: Theme; seats: number; lit: boolean
  building: boolean; highlight: boolean; boss?: boolean; onClick?: () => void
}) {
  const cx = (x / 100) * CW
  const cy = (y / 100) * CH
  const wide = seats >= 2
  const halfW = boss ? 96 : wide ? 104 : 70
  // El Boss tiene DOS pantallas (centro de mando); un puesto normal tiene 1-2.
  const monX = boss ? [-42, 42] : wide ? [-52, 52] : [0]
  return (
    <g transform={`translate(${cx},${cy})`} style={{ cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      {/* alfombra */}
      <ellipse cx={0} cy={32} rx={halfW + 6} ry={21} fill={boss ? t.accent : t.rug} opacity={boss ? 0.14 : 0.18} />
      {highlight && (
        <rect x={-halfW - 10} y={-66} width={(halfW + 10) * 2} height={122} rx={8} fill="none" stroke={t.accent} strokeWidth={3} opacity={0.9}>
          <animate attributeName="opacity" values="0.4;1;0.4" dur="1.4s" repeatCount="indefinite" />
        </rect>
      )}
      {/* respaldo de silla detrás del Boss */}
      {boss && (
        <g>
          <rect x={-18} y={-18} width={36} height={30} rx={8} fill={t.deskEdge} opacity={0.9} />
        </g>
      )}
      {/* monitores SOBRE la mesa (uno por puesto) */}
      {monX.map((mx, idx) => (
        <g key={idx} transform={`translate(${mx},-54) ${building ? 'scale(1,0.05)' : ''}`} style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}>
          <rect x={-26} y={-20} width={52} height={34} rx={3} fill="#111827" stroke="#05080E" strokeWidth={3} />
          <rect x={-22} y={-16} width={44} height={26} rx={1} fill={lit ? t.screenA : '#0B1220'} className={lit ? 'sc-mon' : undefined} />
          {lit && <rect x={-18} y={-12} width={20} height={3} fill={t.screenB} opacity={0.9} />}
          {lit && <rect x={-18} y={-5} width={30} height={3} fill={t.screenB} opacity={0.6} />}
          {lit && <rect x={-18} y={2} width={16} height={3} fill={t.screenB} opacity={0.6} />}
          <rect x={-5} y={14} width={10} height={6} fill="#374151" />
          <rect x={-14} y={20} width={28} height={4} rx={2} fill="#4B5563" />
        </g>
      ))}
      {/* superficie */}
      <rect x={-halfW} y={-6} width={halfW * 2} height={46} rx={4} fill={t.desk} stroke={boss ? t.accent : t.deskEdge} strokeWidth={boss ? 4 : 3} />
      <rect x={-halfW} y={-6} width={halfW * 2} height={9} rx={4} fill={t.deskTop} />
      {/* teclados (uno por puesto) */}
      {monX.map((mx, idx) => (
        <g key={`kb-${idx}`} transform={`translate(${mx},0)`}>
          <rect x={-26} y={16} width={52} height={13} rx={2} fill="#E5E7EB" stroke="#9CA3AF" strokeWidth={1.5} />
          {[-19, -8, 3, 14].map((kx) => <rect key={kx} x={kx} y={19} width={7} height={3} fill="#9CA3AF" />)}
        </g>
      ))}
      <circle cx={halfW - 14} cy={8} r={6} fill="#EF4444" />
      <rect x={-halfW + 10} y={40} width={10} height={16} fill={t.deskEdge} />
      <rect x={halfW - 20} y={40} width={10} height={16} fill={t.deskEdge} />
      {/* placa ORQUESTADOR en el frente de la mesa del Boss */}
      {boss && (
        <g>
          <rect x={-52} y={20} width={104} height={16} rx={3} fill="#0B1220" stroke={t.accent} strokeWidth={1.5} />
          <text x={0} y={32} textAnchor="middle" fontSize={9} fill={t.accent} fontFamily="monospace" fontWeight="bold">ORQUESTADOR</text>
        </g>
      )}
      {/* caja/herramientas al "instalar" */}
      {building && (
        <g>
          <rect x={-16} y={-2} width={32} height={22} rx={2} fill="#B45309" stroke="#78350F" strokeWidth={2} />
          <rect x={-16} y={-2} width={32} height={6} fill="#D97706" />
          <text x={0} y={14} textAnchor="middle" fontSize={11}>🔧</text>
        </g>
      )}
    </g>
  )
}

// Ficha de proyecto en una mesa (chip clicable)
function ProjectChip({
  p, left, top, i, selected, onClick, onDelete, onDownload, active,
}: {
  p: OfficeProject; left: number; top: number; i: number
  selected: boolean; active: boolean
  onClick?: () => void; onDelete?: () => void; onDownload?: () => void
}) {
  const col = active ? '#F59E0B' : '#22C55E'
  return (
    <div
      onClick={onClick}
      title={`${p.name} — ${p.done}/${p.total} tareas · clic para ver`}
      style={{
        position: 'absolute', left: `${left}%`, top: `${top}%`,
        width: 108, transform: `translate(-50%,0) rotate(${(i % 2 === 0 ? -1 : 1) * 2}deg)`,
        background: selected ? '#FEF9C3' : '#FFFEF5',
        border: `2px solid ${selected ? col : '#D6B45A'}`,
        borderRadius: 4, padding: '5px 7px', cursor: 'pointer', zIndex: 7,
        boxShadow: selected ? `0 0 10px ${col}` : '0 2px 4px rgba(0,0,0,.3)',
        fontFamily: 'monospace',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 9, fontWeight: 'bold', color: '#1C1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {active ? '🟠' : '✅'} {p.name}
        </span>
        {onDelete && (
          <span
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            title="Eliminar proyecto"
            style={{ fontSize: 9, color: '#B91C1C', cursor: 'pointer', fontWeight: 'bold' }}
          >✕</span>
        )}
      </div>
      <div style={{ height: 4, background: '#E7E5E4', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
        <div style={{ width: `${p.progress}%`, height: '100%', background: col }} />
      </div>
      <div style={{ fontSize: 7.5, color: '#78716C', marginTop: 2 }}>{p.done}/{p.total} · {p.agentNames.slice(0, 2).join(', ') || '—'}</div>
      {!active && p.files && p.files.length > 0 && (
        <div style={{ fontSize: 7, color: '#92400E', marginTop: 2, lineHeight: 1.3 }}>
          {p.files.slice(0, 3).map((f) => <div key={f}>📄 {f}</div>)}
        </div>
      )}
      {!active && onDownload && p.hasDeliverable && (
        <button
          onClick={(e) => { e.stopPropagation(); onDownload() }}
          title="Descargar entregable final (final.html)"
          style={{ marginTop: 4, width: '100%', fontSize: 8, fontWeight: 'bold', fontFamily: 'monospace', background: '#16A34A', color: '#fff', border: 'none', borderRadius: 3, padding: '3px 0', cursor: 'pointer' }}
        >
          ⬇ descargar
        </button>
      )}
    </div>
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

  // --- detección de "recién encendido" → animación de instalación de escritorio ---
  const [building, setBuilding] = useState<Record<string, number>>({})
  const prevActive = useRef<Record<string, boolean>>({})
  useEffect(() => {
    const now = Date.now()
    const next: Record<string, number> = {}
    for (const a of agents) {
      const was = prevActive.current[a.id]
      if (was === false && a.is_active) next[a.id] = now + 2600 // instala por 2.6s
      prevActive.current[a.id] = a.is_active
    }
    if (Object.keys(next).length) {
      setBuilding((b) => ({ ...b, ...next }))
      const maxT = Math.max(...Object.values(next)) - now
      const to = window.setTimeout(() => {
        setBuilding((b) => {
          const copy = { ...b }
          for (const k of Object.keys(next)) delete copy[k]
          return copy
        })
      }, maxT + 50)
      return () => window.clearTimeout(to)
    }
    return undefined
  }, [agents])
  const isBuilding = (id: string) => (building[id] ?? 0) > Date.now()

  const restOrder = [...agents].filter(needsRest).sort((a, b) => a.name.localeCompare(b.name))
  const restAt = (id: string): { x: number; y: number } => restSlot(Math.max(0, restOrder.findIndex((a) => a.id === id)))

  const isWalker = (a: LiveAgent) => a.desk === 7 && a.is_active && a.status !== 'paused' && !a.resting && !a.meeting

  // agentes de escritorio (excluye boss, café/nex, caminante, descanso)
  const deskAgents = useMemo(
    () => agents.filter(
      (a) => a.is_active && !needsRest(a) && !isWalker(a) && a.trip !== 'table' &&
        a.desk !== 6 && a.desk !== 8 && a.character !== 'nex',
    ),
    [agents],
  )

  // Asigna cada agente de escritorio a un slot (hasta 2 por mesa, en orden).
  const deskGroups = useMemo(() => {
    const groups: LiveAgent[][] = DESK_SLOTS.map(() => [])
    deskAgents.forEach((a, idx) => {
      const slot = Math.floor(idx / 2) % DESK_SLOTS.length
      groups[slot].push(a)
    })
    return groups
  }, [deskAgents])

  // posición exacta del agente (su asiento dentro del escritorio compartido)
  const seatPos = (a: LiveAgent): { x: number; y: number } => {
    if (a.trip === 'table') return DONE_POS
    if (needsRest(a)) return restAt(a.id)
    if (a.desk === 6) return BOSS_POS
    if (a.desk === 8 || a.character === 'nex') return COFFEE_POS
    if (a.desk === 7) return { x: 45, y: 50 }
    // buscar su grupo/slot
    for (let s = 0; s < deskGroups.length; s++) {
      const g = deskGroups[s]
      const pos = g.findIndex((x) => x.id === a.id)
      if (pos >= 0) {
        const base = DESK_SLOTS[s]
        const twoUp = g.length >= 2
        const dx = twoUp ? (pos === 0 ? -5.5 : 5.5) : 0
        return { x: base.x + dx, y: base.y }
      }
    }
    return DESK_SLOTS[a.desk % DESK_SLOTS.length]
  }

  const walkers = agents.filter(isWalker)
  const seated = agents.filter((a) => !isWalker(a))

  const isTyping = (a: LiveAgent) =>
    a.is_active && !a.resting && !a.meeting && a.trip !== 'table' && !isBuilding(a.id) &&
    (a.status === 'working' || a.status === 'progress' || a.status === 'thinking')

  const spriteStatus = (a: LiveAgent): string => {
    if (!a.is_active) return 'paused'
    if (a.trip === 'table') return 'carrying'
    if (a.resting) return 'blocked'
    if (isTyping(a)) return 'typing'
    return a.status
  }
  const isSeatedDesk = (a: LiveAgent) =>
    a.is_active && !needsRest(a) && !isWalker(a) && a.trip !== 'table' &&
    a.desk !== 8 && a.character !== 'nex' // incluye al Boss (desk 6): ahora tiene escritorio

  const bubbleFor = (a: LiveAgent): string =>
    a.mood ? a.mood.headline
    : isBuilding(a.id) ? '🔧 instalando equipo…'
    : a.trip === 'table' ? '📄 llevando entrega…'
    : a.meeting ? '☕ reunión BYOK' : a.resting ? 'Zzz…' : a.status === 'paused' ? '⏸ en pausa'
    : a.status === 'blocked' ? '🚩 ¡Necesito soporte!' : a.status === 'thinking' ? '💭…'
    : a.status === 'working' ? '⌨ ejecutando…' : a.log

  const nameTag = (a: LiveAgent) => {
    if (!a.is_active) {
      return (
        <div style={{ textAlign: 'center', marginTop: -2 }}>
          <div style={{ fontSize: 10, fontWeight: 'bold', color: '#9CA3AF', background: 'rgba(20,20,20,.9)', borderRadius: 4, padding: '0 4px', display: 'inline-block', fontFamily: 'monospace' }}>
            {a.name} · 💤 OFF
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
        <div style={{ width: 52, height: 5, background: 'rgba(0,0,0,.45)', borderRadius: 3, margin: '2px auto 0', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, a.energy)}%`, height: '100%', background: FATIGUE_META[fat].color }} />
        </div>
      </div>
    )
  }

  const activeProjects = projects.filter((p) => p.active)
  const doneProjects = projects.filter((p) => !p.active)

  // El Boss (orquestador): su escritorio es destacado y también tiene drilldown.
  const boss = agents.find((a) => a.desk === 6 && a.is_active)

  // drilldown: agentes y tareas del escritorio expandido (número = mesa normal; 'boss' = orquestador)
  const expandedAgents =
    expandedDesk === 'boss' ? (boss ? [boss] : [])
    : typeof expandedDesk === 'number' ? deskGroups[expandedDesk] ?? []
    : []
  const expandedTasks = useMemo(() => {
    if (expandedDesk == null) return []
    const names = new Set(expandedAgents.map((a) => a.name))
    // El Boss ve también las tareas MISIÓN/ENTREGA que orquesta (sin agente asignado directo).
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
        @keyframes sc-mon { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
        .sc-light { animation: sc-light 1.6s steps(2) infinite; }
        @keyframes sc-light { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }
        .sc-steam { animation: sc-steam 2.6s ease-in-out infinite; }
        @keyframes sc-steam { 0% { opacity: 0; transform: translateY(0); } 40% { opacity: .8; } 100% { opacity: 0; transform: translateY(-8px); } }
        .sc-bubble { animation: sc-bob 2.4s ease-in-out infinite; }
        @keyframes sc-bob { 0%,100% { transform: translate(-50%,0); } 50% { transform: translate(-50%,-3px); } }
      `}</style>

      <svg viewBox="0 0 960 600" className="sc-px" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {/* ===== PISO ===== */}
        <rect x={0} y={0} width={CW} height={CH} fill={t.floor} />
        {themeId === 'lab' ? (
          <g opacity={0.5}>
            {Array.from({ length: 16 }).map((_, i) => (
              <line key={`v${i}`} x1={i * 60} y1={96} x2={i * 60} y2={CH} stroke={t.floorLine} strokeWidth={1} />
            ))}
            {Array.from({ length: 9 }).map((_, j) => (
              <line key={`h${j}`} x1={0} y1={96 + j * 56} x2={CW} y2={96 + j * 56} stroke={t.floorLine} strokeWidth={1} />
            ))}
          </g>
        ) : (
          Array.from({ length: 24 }).map((_, i) =>
            Array.from({ length: 11 }).map((_, j) =>
              (i + j) % 2 === 0 ? (
                <rect key={`${i}-${j}`} x={i * 40} y={96 + j * 46} width={40} height={46} fill={t.floorAlt} opacity={0.7} />
              ) : null,
            ),
          )
        )}

        {/* ===== MUROS ===== */}
        <rect x={0} y={0} width={CW} height={96} fill={t.wall} />
        <rect x={0} y={82} width={CW} height={14} fill={t.wainscot} />
        {themeId === 'seria' &&
          Array.from({ length: 20 }).map((_, i) => (
            <rect key={i} x={10 + i * 48} y={84} width={2} height={10} fill={t.wallDark} opacity={0.5} />
          ))}
        {dark &&
          Array.from({ length: 24 }).map((_, i) => (
            <rect key={i} x={i * 40} y={86} width={20} height={3} fill={t.accent} opacity={0.25} />
          ))}
        <rect x={0} y={0} width={12} height={CH} fill={t.wallDark} />
        <rect x={948} y={0} width={12} height={CH} fill={t.wallDark} />
        <rect x={0} y={588} width={CW} height={12} fill={t.wallDark} />

        {/* ===== AMBIENTE DE PARED (distinto por tema) ===== */}
        {themeId === 'seria' && (
          <g>
            {[110, 290, 470].map((x) => (
              <g key={x}>
                <rect x={x} y={16} width={120} height={52} fill="#6E8BA8" stroke={t.wallDark} strokeWidth={3} />
                <rect x={x + 6} y={22} width={50} height={40} fill="#BFE3FB" />
                <rect x={x + 64} y={22} width={50} height={40} fill="#A6D4F5" />
                <rect x={x + 58} y={22} width={6} height={40} fill={t.wallDark} />
                <rect x={x + 6} y={40} width={108} height={4} fill={t.wallDark} opacity={0.5} />
              </g>
            ))}
          </g>
        )}
        {themeId === 'marketing' && (
          <g>
            {[{ x: 110, c: '#F472B6' }, { x: 250, c: '#A78BFA' }, { x: 390, c: '#FBBF24' }, { x: 530, c: '#34D399' }].map((f) => (
              <g key={f.x}>
                <rect x={f.x} y={16} width={96} height={54} fill="#fff" stroke={f.c} strokeWidth={4} />
                <rect x={f.x + 10} y={26} width={76} height={24} fill={f.c} opacity={0.5} />
                <circle cx={f.x + 28} cy={38} r={8} fill={f.c} />
                <rect x={f.x + 12} y={54} width={60} height={5} fill={f.c} opacity={0.7} />
              </g>
            ))}
          </g>
        )}
        {dark && (
          <g>
            {[110, 260, 410].map((x) => (
              <g key={x}>
                <rect x={x} y={16} width={120} height={54} fill="#020617" stroke={t.accent} strokeWidth={2} />
                <polyline points={`${x + 8},50 ${x + 28},34 ${x + 48},44 ${x + 68},24 ${x + 88},40 ${x + 112},30`} fill="none" stroke="#22C55E" strokeWidth={2} />
                <text x={x + 8} y={28} fontSize={9} fill={t.accent} fontFamily="monospace">metrics</text>
              </g>
            ))}
          </g>
        )}

        {/* reloj */}
        <g>
          <circle cx={905} cy={42} r={20} fill="#F8FAFC" stroke="#1F2937" strokeWidth={3} />
          <line x1={905} y1={42} x2={905} y2={29} stroke="#1F2937" strokeWidth={3} />
          <line x1={905} y1={42} x2={914} y2={45} stroke="#1F2937" strokeWidth={3} />
        </g>

        {/* ===== SALA DE DESCANSO (izquierda) ===== */}
        <rect x={24} y={104} width={176} height={468} rx={8} fill={dark ? '#38BDF8' : t.rug} opacity={dark ? 0.12 : 0.16} />
        <text x={112} y={126} textAnchor="middle" fontSize={12} fill={ink} fontFamily="monospace" fontWeight="bold">SALA DE DESCANSO</text>
        <g>
          <rect x={40} y={430} width={150} height={56} rx={12} fill={themeId === 'marketing' ? '#DB2777' : dark ? '#1E293B' : '#7C3AED'} stroke={t.wallDark} strokeWidth={3} />
          <rect x={40} y={420} width={150} height={24} rx={10} fill={themeId === 'marketing' ? '#F472B6' : dark ? '#334155' : '#8B5CF6'} />
        </g>
        <g>
          <rect x={62} y={498} width={104} height={32} rx={4} fill={t.desk} stroke={t.deskEdge} strokeWidth={3} />
          <circle cx={92} cy={514} r={7} fill="#EF4444" />
          <circle cx={92} cy={508} r={4} fill="#E5E7EB" className="sc-steam" />
        </g>
        <g>
          <rect x={46} y={150} width={56} height={96} rx={4} fill={dark ? '#334155' : '#E5E7EB'} stroke={t.wallDark} strokeWidth={3} />
          <rect x={46} y={186} width={56} height={4} fill={t.wallDark} />
          <rect x={58} y={164} width={32} height={16} fill="#60A5FA" opacity={0.7} />
        </g>

        {/* ===== MESA/PIZARRA DE PROYECTOS ACTIVOS (escoger) — forma por tema ===== */}
        <ProjectBoard variant={t.boardShape} t={t} title={t.pickTitle} count={activeProjects.length} />

        {/* ===== MESA DE PROYECTOS ENTREGADOS ===== */}
        <g transform={`translate(${(DONE_POS.x / 100) * CW},${(DONE_POS.y / 100) * CH})`}>
          <ellipse cx={0} cy={44} rx={118} ry={16} fill="rgba(0,0,0,.18)" />
          <rect x={-120} y={-74} width={240} height={150} rx={6} fill={dark ? '#071018' : '#FFFBEB'} stroke="#22C55E" strokeWidth={4} />
          <text x={0} y={-54} textAnchor="middle" fontSize={11} fill={dark ? '#4ADE80' : '#166534'} fontFamily="monospace" fontWeight="bold">{t.doneTitle}</text>
          <line x1={-110} y1={-44} x2={110} y2={-44} stroke="#22C55E" strokeWidth={1} opacity={0.5} />
        </g>

        {/* server rack */}
        <g>
          <rect x={44} y={538} width={86} height={34} rx={4} fill="#111827" stroke="#374151" strokeWidth={3} />
          {[546, 560].map((y, i) => (
            <g key={y}>
              <rect x={52} y={y} width={70} height={10} fill="#1F2937" stroke="#374151" />
              <circle cx={60} cy={y + 5} r={3} fill={i % 2 ? '#22C55E' : '#EF4444'} className="sc-light" />
              <circle cx={72} cy={y + 5} r={3} fill="#EAB308" className="sc-light" />
            </g>
          ))}
        </g>
        {dark && (
          <g>
            <rect x={884} y={492} width={44} height={56} rx={8} fill="#94A3B8" stroke="#475569" strokeWidth={3} />
            <rect x={890} y={468} width={32} height={26} rx={6} fill="#CBD5E1" stroke="#475569" strokeWidth={3} />
            <circle cx={899} cy={481} r={4} fill="#22D3EE" className="sc-light" />
            <circle cx={913} cy={481} r={4} fill="#22D3EE" className="sc-light" />
            <line x1={906} y1={468} x2={906} y2={458} stroke="#475569" strokeWidth={3} />
            <circle cx={906} cy={455} r={4} fill="#EF4444" className="sc-light" />
          </g>
        )}

        <Plant x={910} y={300} />
        <Plant x={250} y={560} />
        <Plant x={600} y={560} />
        {themeId === 'marketing' && <Plant x={300} y={130} s={1.1} />}

        {/* puerta + tapete */}
        <g>
          <rect x={430} y={562} width={100} height={26} fill={dark ? '#020617' : '#334155'} />
          <rect x={410} y={530} width={140} height={26} rx={4} fill={themeId === 'marketing' ? '#DB2777' : t.accent} />
          <text x={480} y={548} textAnchor="middle" fontSize={13} fill="#fff" fontFamily="monospace" fontWeight="bold">seecontrol</text>
        </g>

        {/* ===== ESCRITORIOS (1-2 agentes c/u) ===== */}
        {deskGroups.map((g, s) => {
          if (g.length === 0) return null
          const base = DESK_SLOTS[s]
          const lit = g.some((a) => isTyping(a) || a.status === 'completed')
          const building2 = g.some((a) => isBuilding(a.id))
          return (
            <DeskUnit
              key={`desk-${s}`} x={base.x} y={base.y} t={t}
              seats={g.length} lit={lit} building={building2}
              highlight={expandedDesk === s}
              onClick={() => setExpandedDesk((d) => (d === s ? null : s))}
            />
          )
        })}

        {/* ===== ESCRITORIO DEL BOSS (orquestador) — mesa real, clicable ===== */}
        {boss && (
          <DeskUnit
            x={BOSS_POS.x} y={BOSS_POS.y} t={t}
            seats={1} boss
            lit={isTyping(boss) || boss.status === 'completed' || activeProjects.length > 0}
            building={isBuilding(boss.id)}
            highlight={expandedDesk === 'boss'}
            onClick={() => setExpandedDesk((d) => (d === 'boss' ? null : 'boss'))}
          />
        )}
      </svg>

      {/* ===== fichas de PROYECTOS ACTIVOS (sobre la pizarra) ===== */}
      {activeProjects.slice(0, 2).map((p, i) => (
        <ProjectChip
          key={p.id} p={p} active
          left={PICK_POS.x - 7 + (i % 2) * 14}
          top={PICK_POS.y + 3}
          i={i}
          selected={selectedProjectId === p.id}
          onClick={() => onSelectProject?.(selectedProjectId === p.id ? null : p.id)}
          onDelete={onDeleteProject ? () => onDeleteProject(p.id, p.name) : undefined}
        />
      ))}
      {activeProjects.length > 2 && (
        <div style={{ position: 'absolute', left: `${PICK_POS.x}%`, top: `${PICK_POS.y + 11}%`, transform: 'translateX(-50%)', fontSize: 9, fontFamily: 'monospace', background: 'rgba(0,0,0,.7)', color: '#fff', borderRadius: 8, padding: '2px 8px', zIndex: 7 }}>
          +{activeProjects.length - 2} más
        </div>
      )}

      {/* ===== fichas de PROYECTOS ENTREGADOS (mesa derecha) ===== */}
      {doneProjects.slice(0, 2).map((p, i) => (
        <ProjectChip
          key={p.id} p={p} active={false}
          left={DONE_POS.x - 6 + (i % 2) * 12}
          top={DONE_POS.y - 6}
          i={i}
          selected={selectedProjectId === p.id}
          onClick={() => onSelectProject?.(selectedProjectId === p.id ? null : p.id)}
          onDelete={onDeleteProject ? () => onDeleteProject(p.id, p.name) : undefined}
          onDownload={onDownloadProject ? () => onDownloadProject(p.id, p.name) : undefined}
        />
      ))}
      {doneProjects.length > 2 && (
        <div style={{ position: 'absolute', left: `${DONE_POS.x}%`, top: `${DONE_POS.y + 7}%`, transform: 'translateX(-50%)', fontSize: 9, fontFamily: 'monospace', background: 'rgba(0,0,0,.7)', color: '#fff', borderRadius: 8, padding: '2px 8px', zIndex: 7 }}>
          +{doneProjects.length - 2} más en Kanban
        </div>
      )}

      {/* ===== AGENTES ===== */}
      {seated.map((a) => {
        const p = seatPos(a)
        const fat = fatigueOf(a.energy)
        const aura = !a.is_active ? '#4B5563' : a.resting ? FATIGUE_META.burnout.color : FATIGUE_META[fat].color
        const showBubble = a.is_active && (a.mood || isBuilding(a.id) || a.trip === 'table' || a.status === 'working' || a.status === 'blocked' || a.status === 'thinking' || a.status === 'paused' || a.resting || a.meeting || a.character === 'boss')
        const isSel = selectedId === a.id
        const seatedDesk = isSeatedDesk(a)
        return (
          <motion.div
            key={a.id}
            title={`${a.name} · ${a.role} — clic para chatear 💬`}
            onClick={() => onAgentClick?.(a.id)}
            initial={false}
            animate={{ left: `${p.x}%`, top: `${p.y}%`, scale: isSel ? 1.08 : 1 }}
            transition={{ duration: 1.4, ease: 'easeInOut' }}
            style={{ position: 'absolute', transform: seatedDesk ? 'translate(-50%,-108%)' : 'translate(-50%,-100%)', zIndex: isSel ? 8 : 5, cursor: 'pointer', opacity: a.is_active ? 1 : 0.5, filter: a.is_active ? 'none' : 'grayscale(0.8)' }}
          >
            {showBubble && (
              <div className="sc-bubble" style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translate(-50%,0)', marginBottom: 52, background: a.mood ? '#FEF3C7' : '#fff', color: '#111', fontSize: 10, padding: '4px 8px', borderRadius: 8, border: a.mood ? '2px solid #F59E0B' : '2px solid #111', whiteSpace: a.mood ? 'normal' : 'nowrap', width: a.mood ? 190 : undefined, fontFamily: 'monospace', zIndex: 6 }}>
                {a.mood ? (
                  <span><b>{a.mood.headline}</b><br /><span style={{ fontSize: 8, color: '#78716C' }}>{a.mood.detail}</span></span>
                ) : bubbleFor(a)}
              </div>
            )}
            <AgentSprite
              hair={a.hair} shirt={a.shirt} cut={a.cut} px={4}
              status={isBuilding(a.id) ? 'idle' : spriteStatus(a)} aura={aura} selected={isSel}
              seated={seatedDesk && !isBuilding(a.id)}
              glasses={a.glasses ?? a.character === 'data'}
              skin={a.skin}
            />
            {nameTag(a)}
          </motion.div>
        )
      })}

      {/* caminante (Scout) */}
      {walkers.map((a) => (
        <motion.div
          key={a.id}
          title={`${a.name} · ${a.role} — clic para chatear 💬`}
          style={{ position: 'absolute', left: '30%', top: '48%', zIndex: selectedId === a.id ? 8 : 5, cursor: 'pointer' }}
          animate={{ left: ['30%', '60%', '60%', '30%', '30%'], top: ['48%', '48%', '66%', '66%', '48%'] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          onClick={() => onAgentClick?.(a.id)}
        >
          <div style={{ transform: 'translate(-50%,-100%)' }}>
            <div className="sc-bubble" style={{ position: 'absolute', bottom: '100%', left: '50%', marginBottom: 52, background: '#fff', color: '#111', fontSize: 10, padding: '4px 8px', borderRadius: 8, border: '2px solid #111', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
              🚶 {bubbleFor(a)}
            </div>
            <AgentSprite hair={a.hair} shirt={a.shirt} cut={a.cut} px={4} status="working" aura={FATIGUE_META[fatigueOf(a.energy)].color} selected={selectedId === a.id} glasses={a.glasses} skin={a.skin} />
            {nameTag(a)}
          </div>
        </motion.div>
      ))}

      {/* ===== DRILLDOWN del escritorio (panel con tareas de ambos agentes) ===== */}
      <AnimatePresence>
        {expandedDesk != null && expandedAgents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.18 }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(5,7,12,.55)', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setExpandedDesk(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: '72%', maxHeight: '82%', overflowY: 'auto', background: '#121820', border: `2px solid ${t.accent}`, borderRadius: 14, padding: 16, fontFamily: 'monospace', boxShadow: '0 10px 40px rgba(0,0,0,.6)' }}
            >
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
              <div style={{ fontSize: 11, color: '#78716C', marginBottom: 8 }}>TAREAS DE ESTE ESCRITORIO ({expandedTasks.length})</div>
              {expandedTasks.length === 0 ? (
                <div style={{ fontSize: 12, color: '#57534E' }}>Sin tareas asignadas todavía.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
                  {expandedTasks.map((tk) => {
                    const col = tk.status === 'completed' ? '#22C55E' : tk.status === 'blocked' ? '#EF4444' : tk.status === 'paused' ? '#F59E0B' : '#38BDF8'
                    return (
                      <button key={tk.id} onClick={() => onOpenTask?.(tk.id)} style={{ textAlign: 'left', background: '#1A1F29', border: '1px solid #2A2F3A', borderLeft: `3px solid ${col}`, borderRadius: 8, padding: 9, cursor: 'pointer', color: '#fff' }}>
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* selector de ambiente */}
      <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4, zIndex: 10 }}>
        {(Object.keys(THEMES) as OfficeThemeId[]).map((id) => (
          <button
            key={id}
            onClick={() => pick(id)}
            title={THEMES[id].label}
            style={{
              fontSize: 8, fontFamily: "'Press Start 2P', monospace", padding: '7px 8px', borderRadius: 6, cursor: 'pointer',
              border: themeId === id ? '2px solid #22C55E' : '1px solid #444',
              background: themeId === id ? 'rgba(5,46,22,.9)' : 'rgba(10,10,10,.8)',
              color: themeId === id ? '#22C55E' : '#A8A29E',
            }}
          >
            {THEMES[id].icon} {THEMES[id].label}
          </button>
        ))}
      </div>

      {/* barra de stats */}
      <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 14, alignItems: 'center', background: 'rgba(10,10,10,.85)', border: '1px solid #333', borderRadius: 8, padding: '6px 14px', fontFamily: 'monospace', fontSize: 11, color: '#fff', zIndex: 9, whiteSpace: 'nowrap' }}>
        <span><b style={{ color: '#22C55E' }}>{stats.total}</b> Agentes</span>
        <span><b style={{ color: '#22C55E' }}>{stats.working}</b> Trabajando</span>
        <span><b style={{ color: '#EF4444' }}>{stats.blocked}</b> Bloqueados</span>
        <span><b style={{ color: '#38BDF8' }}>{activeProjects.length}</b> Proy.</span>
        <span><b style={{ color: '#22C55E' }}>{stats.global}%</b> Global</span>
        {(stats.off ?? 0) > 0 && <span><b style={{ color: '#9CA3AF' }}>💤{stats.off}</b> Off</span>}
      </div>
    </div>
  )
}

// Pizarra de proyectos con forma distinta por tema (cork / neon / whiteboard)
function ProjectBoard({ variant, t, title, count }: { variant: Theme['boardShape']; t: Theme; title: string; count: number }) {
  const bx = 632, by = 92, bw = 236, bh = 132
  if (variant === 'neon') {
    // marco redondeado con marquesina de neón (marketing)
    return (
      <g>
        <rect x={bx} y={by} width={bw} height={bh} rx={18} fill="#2A0A24" stroke="#F472B6" strokeWidth={4} />
        <rect x={bx} y={by} width={bw} height={bh} rx={18} fill="none" stroke="#F0ABFC" strokeWidth={2} opacity={0.6}>
          <animate attributeName="opacity" values="0.3;0.9;0.3" dur="1.8s" repeatCount="indefinite" />
        </rect>
        {Array.from({ length: 14 }).map((_, i) => (
          <circle key={i} cx={bx + 14 + i * 16} cy={by + 10} r={3} fill={i % 2 ? '#FDE68A' : '#F472B6'} className="sc-light" />
        ))}
        <text x={bx + bw / 2} y={by + 34} textAnchor="middle" fontSize={13} fill="#FDF4FF" fontFamily="monospace" fontWeight="bold">{title}</text>
        <text x={bx + bw / 2} y={by + bh - 10} textAnchor="middle" fontSize={9} fill="#F0ABFC" fontFamily="monospace">{count} en marcha</text>
      </g>
    )
  }
  if (variant === 'whiteboard') {
    // terminal oscuro (lab)
    return (
      <g>
        <rect x={bx} y={by} width={bw} height={bh} rx={6} fill="#020617" stroke={t.accent} strokeWidth={3} />
        <rect x={bx} y={by} width={bw} height={20} fill="#0B1220" />
        {['#EF4444', '#F59E0B', '#22C55E'].map((c, i) => <circle key={c} cx={bx + 14 + i * 14} cy={by + 10} r={4} fill={c} />)}
        <text x={bx + 12} y={by + 40} fontSize={12} fill="#4ADE80" fontFamily="monospace">{title}</text>
        <text x={bx + 12} y={by + 60} fontSize={11} fill="#22C55E" fontFamily="monospace">&gt; {count} proceso(s) activo(s)</text>
        <rect x={bx + 12} y={by + 70} width={8} height={12} fill="#22C55E" className="sc-light" />
      </g>
    )
  }
  // cork board (seria): corcho con marco de madera y chinchetas
  return (
    <g>
      <rect x={bx - 4} y={by - 4} width={bw + 8} height={bh + 8} rx={6} fill="#7C5A32" />
      <rect x={bx} y={by} width={bw} height={bh} rx={3} fill="#C9A66B" />
      <rect x={bx} y={by} width={bw} height={bh} rx={3} fill="#000" opacity={0.05} />
      <text x={bx + bw / 2} y={by + 26} textAnchor="middle" fontSize={13} fill="#4A3418" fontFamily="monospace" fontWeight="bold">{title}</text>
      <line x1={bx + 16} y1={by + 36} x2={bx + bw - 16} y2={by + 36} stroke="#4A3418" strokeWidth={1} opacity={0.3} />
      {[0, 1, 2, 3].map((i) => <circle key={i} cx={bx + 30 + i * 60} cy={by + 12} r={3} fill={['#DC2626', '#2563EB', '#16A34A', '#CA8A04'][i]} />)}
      <text x={bx + bw / 2} y={by + bh - 10} textAnchor="middle" fontSize={9} fill="#6B4E26" fontFamily="monospace">{count} proyecto(s) en el sprint</text>
    </g>
  )
}
