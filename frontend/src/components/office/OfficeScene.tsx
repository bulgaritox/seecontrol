import { useState } from 'react'
import { motion } from 'framer-motion'
import { AgentSprite } from './AgentSprite'
import type { LiveAgent } from '../../hooks/useLiveOffice'
import { FATIGUE_META, fatigueOf } from '../../data/demo'

export type OfficeThemeId = 'seria' | 'marketing' | 'lab'

interface Theme {
  id: OfficeThemeId
  label: string
  icon: string
  floor: string
  floorAlt: string
  wall: string
  wallDark: string
  desk: string
  deskEdge: string
  deskTop: string
  rug: string
  screenA: string
  screenB: string
  posterTitle: string
  posterSub: string
  boardTitle: string
}

const THEMES: Record<OfficeThemeId, Theme> = {
  seria: {
    id: 'seria', label: 'OFICINA SERIA', icon: '🏢',
    floor: '#7FA8C9', floorAlt: '#74A0C4', wall: '#EDF1F5', wallDark: '#C9D4DE',
    desk: '#C7CFD6', deskEdge: '#8A94A0', deskTop: '#DDE3E9', rug: '#3B5B7A',
    screenA: '#0EA5E9', screenB: '#38BDF8',
    posterTitle: 'ROADMAP', posterSub: 'Q3 ✓  Q4 …',
    boardTitle: 'SPRINT Q3',
  },
  marketing: {
    id: 'marketing', label: 'AGENCIA MKT', icon: '🎨',
    floor: '#E8A94B', floorAlt: '#DE9C40', wall: '#FFF6E8', wallDark: '#F0DDBE',
    desk: '#D96C9B', deskEdge: '#8E3A63', deskTop: '#E78BB3', rug: '#7C3AED',
    screenA: '#F0ABFC', screenB: '#F472B6',
    posterTitle: '★ VIRAL ★', posterSub: 'like · share · loop',
    boardTitle: 'CAMPAÑA VERANO ☀',
  },
  lab: {
    id: 'lab', label: 'LAB TECH', icon: '🔬',
    floor: '#232F45', floorAlt: '#1E2A3F', wall: '#0E1526', wallDark: '#131D33',
    desk: '#3B4A63', deskEdge: '#1B2436', deskTop: '#46587A', rug: '#0E7490',
    screenA: '#22C55E', screenB: '#4ADE80',
    posterTitle: 'v2.0 SHIP', posterSub: 'ci ✓ cd ✓',
    boardTitle: '$ deploy --prod ⚡',
  },
}

// Posiciones de trabajo (%, sobre lienzo 960x600)
const DESKS = [
  { x: 33, y: 35 }, { x: 46, y: 35 }, { x: 59, y: 35 },
  { x: 33, y: 65 }, { x: 46, y: 65 }, { x: 59, y: 65 },
]
const BOSS_POS = { x: 80, y: 42 }
const COFFEE_POS = { x: 13, y: 52 }
const REST_POS = [{ x: 9, y: 84 }, { x: 16, y: 84 }, { x: 22, y: 84 }]

function Desk({ x, y, t }: { x: number; y: number; t: Theme }) {
  return (
    <g transform={`translate(${x * 9.6},${y * 6})`}>
      <rect x={-58} y={-20} width={116} height={64} rx={3} fill={t.desk} stroke={t.deskEdge} strokeWidth={3} />
      <rect x={-58} y={-20} width={116} height={10} rx={3} fill={t.deskTop} />
      <rect x={-40} y={-52} width={34} height={26} rx={2} fill="#1F2937" stroke="#0B0F16" strokeWidth={2} />
      <rect x={-36} y={-48} width={26} height={18} fill={t.screenA} className="sc-mon" />
      <rect x={6} y={-52} width={34} height={26} rx={2} fill="#1F2937" stroke="#0B0F16" strokeWidth={2} />
      <rect x={10} y={-48} width={26} height={18} fill={t.screenB} className="sc-mon2" />
      <rect x={-30} y={-8} width={60} height={10} rx={2} fill="#D1D5DB" stroke="#9CA3AF" strokeWidth={1.5} />
      <rect x={-24} y={48} width={48} height={14} rx={6} fill={t.deskEdge} />
      <circle cx={-86} cy={30} r={13} fill={t.id === 'lab' ? '#22D3EE' : '#22C55E'} />
      <circle cx={-78} cy={22} r={9} fill={t.id === 'lab' ? '#0EA5E9' : '#16A34A'} />
      <circle cx={-92} cy={20} r={7} fill={t.id === 'lab' ? '#67E8F6' : '#4ADE80'} />
      <rect x={-92} y={38} width={14} height={10} fill="#B45309" />
    </g>
  )
}

function Plant({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <circle cx={0} cy={-18} r={16} fill="#16A34A" />
      <circle cx={-12} cy={-8} r={11} fill="#22C55E" />
      <circle cx={12} cy={-8} r={11} fill="#4ADE80" />
      <rect x={-10} y={0} width={20} height={14} fill="#B45309" />
    </g>
  )
}

export function OfficeScene({
  agents,
  stats,
  onAgentClick,
}: {
  agents: LiveAgent[]
  stats: { total: number; working: number; blocked: number; done: number; global: number }
  onAgentClick?: (id: string) => void
}) {
  const [themeId, setThemeId] = useState<OfficeThemeId>(() => (localStorage.getItem('sc_theme') as OfficeThemeId) || 'seria')
  const t = THEMES[themeId]
  const pick = (id: OfficeThemeId) => {
    setThemeId(id)
    try {
      localStorage.setItem('sc_theme', id)
    } catch {
      /* noop */
    }
  }

  let restIdx = 0
  const posOf = (a: LiveAgent): { x: number; y: number } => {
    if (a.resting || a.meeting) return REST_POS[restIdx++ % REST_POS.length]
    if (a.desk === 6) return BOSS_POS
    if (a.desk === 8 || a.character === 'nex') return COFFEE_POS
    if (a.desk === 7) return { x: 45, y: 50 }
    return DESKS[a.desk % DESKS.length]
  }
  const walkers = agents.filter((a) => a.desk === 7 && !a.resting && !a.meeting)
  const seated = agents.filter((a) => !(a.desk === 7 && !a.resting && !a.meeting))
  const dark = themeId === 'lab'
  const ink = dark ? '#E2E8F0' : '#57534E'

  const bubbleFor = (a: LiveAgent): string =>
    a.meeting ? '☕ reunión BYOK' : a.resting ? 'Zzz…' : a.status === 'paused' ? '⏸ en pausa'
    : a.status === 'blocked' ? '🚩 ¡Necesito soporte!' : a.status === 'thinking' ? '💭…' : a.log

  const nameTag = (a: LiveAgent) => {
    const fat = fatigueOf(a.energy)
    return (
      <div style={{ textAlign: 'center', marginTop: -4 }}>
        <div style={{ fontSize: 10, fontWeight: 'bold', color: FATIGUE_META[fat].color, background: 'rgba(255,255,255,.92)', borderRadius: 4, padding: '0 4px', display: 'inline-block', fontFamily: 'monospace' }}>
          {a.name} · {Math.round(a.energy)}%
        </div>
        <div style={{ width: 52, height: 5, background: 'rgba(0,0,0,.45)', borderRadius: 3, margin: '2px auto 0', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, a.energy)}%`, height: '100%', background: FATIGUE_META[fat].color }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '960 / 600', borderRadius: 12, overflow: 'hidden', border: '2px solid #2A2A2A', background: '#0d0d0d' }}>
      <style>{`
        .sc-px { shape-rendering: crispEdges; }
        .sc-mon { animation: sc-mon 3.2s steps(2) infinite; }
        .sc-mon2 { animation: sc-mon 4.1s steps(2) infinite; }
        @keyframes sc-mon { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
        .sc-light { animation: sc-light 1.6s steps(2) infinite; }
        @keyframes sc-light { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }
        .sc-steam { animation: sc-steam 2.6s ease-in-out infinite; }
        @keyframes sc-steam { 0% { opacity: 0; transform: translateY(0); } 40% { opacity: .8; } 100% { opacity: 0; transform: translateY(-8px); } }
        .sc-bubble { animation: sc-bob 2.4s ease-in-out infinite; }
        @keyframes sc-bob { 0%,100% { transform: translate(-50%,0); } 50% { transform: translate(-50%,-3px); } }
      `}</style>

      <svg viewBox="0 0 960 600" className="sc-px" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {/* piso */}
        <rect x={0} y={0} width={960} height={600} fill={t.floor} />
        {Array.from({ length: 24 }).map((_, i) =>
          Array.from({ length: 12 }).map((_, j) =>
            (i + j) % 2 === 0 ? (
              <rect key={`${i}-${j}`} x={i * 40} y={72 + j * 44} width={40} height={44} fill={t.floorAlt} opacity={0.6} />
            ) : null,
          ),
        )}
        {/* muros */}
        <rect x={0} y={0} width={960} height={72} fill={t.wall} />
        <rect x={0} y={62} width={960} height={10} fill={t.wallDark} />
        <rect x={0} y={0} width={12} height={600} fill={t.wallDark} />
        <rect x={948} y={0} width={12} height={600} fill={t.wallDark} />
        <rect x={0} y={588} width={960} height={12} fill={t.wallDark} />

        {/* ventanas */}
        {[120, 300, 480].map((x) => (
          <g key={x}>
            <rect x={x} y={14} width={110} height={44} fill={dark ? '#1E293B' : '#7A6A55'} stroke={t.wallDark} strokeWidth={3} />
            <rect x={x + 6} y={20} width={46} height={32} fill={dark ? '#0E7490' : '#7DD3FC'} />
            <rect x={x + 58} y={20} width={46} height={32} fill={dark ? '#155E75' : '#38BDF8'} />
            <rect x={x + 52} y={20} width={6} height={32} fill={t.wallDark} />
          </g>
        ))}
        {/* poster principal */}
        <g>
          <rect x={640} y={12} width={120} height={50} fill={themeId === 'marketing' ? '#DB2777' : themeId === 'lab' ? '#052E16' : '#B91C1C'} stroke={t.wallDark} strokeWidth={3} />
          <text x={700} y={32} textAnchor="middle" fontSize={13} fill={themeId === 'lab' ? '#4ADE80' : '#FDE68A'} fontFamily="monospace" fontWeight="bold">{t.posterTitle}</text>
          <text x={700} y={48} textAnchor="middle" fontSize={10} fill={themeId === 'lab' ? '#22C55E' : '#FECACA'} fontFamily="monospace">{t.posterSub}</text>
        </g>
        {/* banderitas solo oficina seria */}
        {themeId === 'seria' && (
          <g>
            <rect x={786} y={14} width={34} height={22} fill="#fff" stroke="#64748B" strokeWidth={2} />
            {[18, 24, 30].map((y) => <rect key={y} x={786} y={y} width={34} height={3} fill="#DC2626" />)}
            <rect x={786} y={14} width={14} height={12} fill="#1D4ED8" />
            <rect x={828} y={14} width={34} height={22} fill="#012169" stroke="#64748B" strokeWidth={2} />
            <rect x={828} y={22} width={34} height={6} fill="#fff" />
            <rect x={839} y={14} width={8} height={22} fill="#fff" />
            <rect x={828} y={23.5} width={34} height={3} fill="#C8102E" />
            <rect x={840.5} y={14} width={5} height={22} fill="#C8102E" />
          </g>
        )}
        {/* neón solo marketing */}
        {themeId === 'marketing' && (
          <g>
            <text x={803} y={44} textAnchor="middle" fontSize={17} fill="#F0ABFC" fontFamily="monospace" fontWeight="bold" opacity={0.9}>★ OPEN ★</text>
            <text x={803} y={44} textAnchor="middle" fontSize={17} fill="#FDF4FF" fontFamily="monospace" fontWeight="bold" opacity={0.55}>★ OPEN ★</text>
          </g>
        )}
        {/* reloj */}
        <g>
          <circle cx={905} cy={37} r={20} fill="#F8FAFC" stroke="#1F2937" strokeWidth={3} />
          <line x1={905} y1={37} x2={905} y2={24} stroke="#1F2937" strokeWidth={3} />
          <line x1={905} y1={37} x2={914} y2={40} stroke="#1F2937" strokeWidth={3} />
        </g>

        {/* zona descanso (izquierda) */}
        <rect x={24} y={90} width={180} height={480} rx={8} fill={dark ? '#38BDF8' : t.rug} opacity={dark ? 0.15 : 0.18} />
        <text x={114} y={112} textAnchor="middle" fontSize={12} fill={ink} fontFamily="monospace" fontWeight="bold">SALA DE DESCANSO</text>
        <g>
          <rect x={40} y={130} width={64} height={110} rx={4} fill={dark ? '#334155' : '#E5E7EB'} stroke={t.wallDark} strokeWidth={3} />
          <rect x={40} y={168} width={64} height={4} fill={t.wallDark} />
          <rect x={52} y={146} width={12} height={10} fill="#F472B6" />
          <rect x={70} y={190} width={12} height={10} fill="#60A5FA" />
        </g>
        <g>
          <rect x={120} y={150} width={60} height={90} rx={4} fill="#374151" stroke="#111827" strokeWidth={3} />
          <rect x={130} y={165} width={40} height={26} fill={t.screenA} className="sc-mon" />
          <circle cx={168} cy={158} r={5} fill="#F59E0B" className="sc-light" />
          <circle cx={150} cy={130} r={4} fill="#E5E7EB" className="sc-steam" />
          <circle cx={156} cy={122} r={3} fill="#E5E7EB" className="sc-steam" />
        </g>
        <g>
          <rect x={36} y={440} width={150} height={60} rx={12} fill={themeId === 'marketing' ? '#DB2777' : '#7C3AED'} stroke={t.wallDark} strokeWidth={3} />
          <rect x={36} y={428} width={150} height={26} rx={10} fill={themeId === 'marketing' ? '#F472B6' : '#8B5CF6'} />
          <rect x={60} y={510} width={100} height={34} rx={4} fill={t.desk} stroke={t.deskEdge} strokeWidth={3} />
          <rect x={72} y={502} width={14} height={10} fill="#F8FAFC" stroke="#CBD5E1" />
          <rect x={92} y={502} width={14} height={10} fill="#F8FAFC" stroke="#CBD5E1" />
        </g>

        {/* escritorios centro */}
        {[317, 500, 624].map((x) =>
          [150, 330].map((y) => (
            <g key={`${x}-${y}`} transform={`translate(${x},${y})`}>
              <Desk x={0} y={0} t={t} />
            </g>
          )),
        )}

        {/* pizarra */}
        <g>
          <rect x={648} y={96} width={240} height={120} rx={4} fill={dark ? '#020617' : '#F8FAFC'} stroke={t.deskEdge} strokeWidth={6} />
          <text x={768} y={122} textAnchor="middle" fontSize={14} fill={dark ? '#4ADE80' : '#334155'} fontFamily="monospace" fontWeight="bold">{t.boardTitle}</text>
          <rect x={664} y={140} width={20} height={56} fill={t.screenA} />
          <rect x={692} y={128} width={20} height={68} fill={t.screenB} />
          <rect x={720} y={150} width={20} height={46} fill="#F59E0B" />
          <rect x={664} y={204} width={196} height={4} fill={dark ? '#1E293B' : '#94A3B8'} />
        </g>

        {/* mesa de juntas */}
        <g transform="translate(789,348)">
          <rect x={-120} y={-60} width={240} height={120} rx={6} fill={t.desk} stroke={t.deskEdge} strokeWidth={3} />
          <rect x={-104} y={-46} width={20} height={26} fill="#F8FAFC" stroke="#CBD5E1" />
          <rect x={-76} y={-46} width={20} height={26} fill="#F8FAFC" stroke="#CBD5E1" />
          <rect x={84} y={20} width={20} height={26} fill="#F8FAFC" stroke="#CBD5E1" />
          {[-90, -30, 30, 90].map((cx) => (
            <g key={cx}>
              <rect x={cx - 20} y={-86} width={40} height={18} rx={8} fill={t.deskEdge} />
              <rect x={cx - 20} y={68} width={40} height={18} rx={8} fill={t.deskEdge} />
            </g>
          ))}
        </g>

        {/* server rack (+ extra en lab) */}
        <g>
          <rect x={660} y={470} width={90} height={100} rx={4} fill="#111827" stroke="#374151" strokeWidth={3} />
          {[486, 508, 530, 552].map((y, i) => (
            <g key={y}>
              <rect x={668} y={y} width={74} height={14} fill="#1F2937" stroke="#374151" />
              <circle cx={678} cy={y + 7} r={3.5} fill={i % 2 ? '#22C55E' : '#EF4444'} className="sc-light" />
              <circle cx={690} cy={y + 7} r={3.5} fill="#EAB308" className="sc-light" />
            </g>
          ))}
        </g>
        {themeId === 'lab' && (
          <g>
            <rect x={556} y={470} width={90} height={100} rx={4} fill="#111827" stroke="#22D3EE" strokeWidth={2} />
            {[486, 508, 530, 552].map((y) => (
              <g key={y}>
                <rect x={564} y={y} width={74} height={14} fill="#0B1220" stroke="#164E63" />
                <circle cx={574} cy={y + 7} r={3.5} fill="#22D3EE" className="sc-light" />
              </g>
            ))}
            {/* robot */}
            <g>
              <rect x={880} y={470} width={44} height={56} rx={8} fill="#94A3B8" stroke="#475569" strokeWidth={3} />
              <rect x={886} y={446} width={32} height={26} rx={6} fill="#CBD5E1" stroke="#475569" strokeWidth={3} />
              <circle cx={895} cy={459} r={4} fill="#22D3EE" className="sc-light" />
              <circle cx={909} cy={459} r={4} fill="#22D3EE" className="sc-light" />
              <line x1={902} y1={446} x2={902} y2={436} stroke="#475569" strokeWidth={3} />
              <circle cx={902} cy={433} r={4} fill="#EF4444" className="sc-light" />
            </g>
          </g>
        )}
        <Plant x={910} y={250} />
        <Plant x={910} y={420} />
        <Plant x={250} y={540} />
        <Plant x={620} y={540} />
        {themeId === 'marketing' && <Plant x={300} y={120} s={1.2} />}
        {/* puerta + tapete */}
        <g>
          <rect x={430} y={560} width={100} height={28} fill={dark ? '#020617' : '#1F2937'} />
          <rect x={410} y={528} width={140} height={26} rx={4} fill={themeId === 'marketing' ? '#DB2777' : '#0EA5E9'} />
          <text x={480} y={546} textAnchor="middle" fontSize={13} fill="#fff" fontFamily="monospace" fontWeight="bold">seecontrol</text>
        </g>
      </svg>

      {/* agentes */}
      {seated.map((a) => {
        const p = posOf(a)
        const fat = fatigueOf(a.energy)
        const aura = a.resting ? FATIGUE_META.burnout.color : FATIGUE_META[fat].color
        return (
          <div
            key={a.id}
            title={`${a.name} · ${a.role} (clic para editar)`}
            onClick={() => onAgentClick?.(a.id)}
            style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%,-100%)', zIndex: 5, cursor: 'pointer' }}
          >
            {(a.status === 'working' || a.status === 'blocked' || a.status === 'thinking' || a.status === 'paused' || a.resting || a.meeting || a.character === 'boss') && (
              <div className="sc-bubble" style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translate(-50%,0)', marginBottom: 46, background: '#fff', color: '#111', fontSize: 10, padding: '4px 8px', borderRadius: 8, border: '2px solid #111', whiteSpace: 'nowrap', fontFamily: 'monospace', zIndex: 6 }}>
                {bubbleFor(a)}
              </div>
            )}
            <AgentSprite hair={a.hair} shirt={a.shirt} cut={a.cut} px={4} status={a.resting ? 'blocked' : a.status} aura={aura} />
            {nameTag(a)}
          </div>
        )
      })}

      {/* caminante (Scout) */}
      {walkers.map((a) => (
        <motion.div
          key={a.id}
          style={{ position: 'absolute', left: '30%', top: '44%', zIndex: 5, cursor: 'pointer' }}
          animate={{ left: ['30%', '60%', '60%', '30%', '30%'], top: ['44%', '44%', '62%', '62%', '44%'] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          onClick={() => onAgentClick?.(a.id)}
        >
          <div style={{ transform: 'translate(-50%,-100%)' }}>
            <div className="sc-bubble" style={{ position: 'absolute', bottom: '100%', left: '50%', marginBottom: 46, background: '#fff', color: '#111', fontSize: 10, padding: '4px 8px', borderRadius: 8, border: '2px solid #111', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
              🚶 {bubbleFor(a)}
            </div>
            <AgentSprite hair={a.hair} shirt={a.shirt} cut={a.cut} px={4} status="working" aura={FATIGUE_META[fatigueOf(a.energy)].color} />
            {nameTag(a)}
          </div>
        </motion.div>
      ))}

      {/* selector de ambiente */}
      <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4, zIndex: 10 }}>
        {(Object.keys(THEMES) as OfficeThemeId[]).map((id) => (
          <button
            key={id}
            onClick={() => pick(id)}
            title={THEMES[id].label}
            style={{
              fontSize: 8,
              fontFamily: "'Press Start 2P', monospace",
              padding: '7px 8px',
              borderRadius: 6,
              cursor: 'pointer',
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
        <span><b style={{ color: '#22C55E' }}>{stats.done}</b> Listos</span>
        <span><b style={{ color: '#22C55E' }}>{stats.global}%</b> Global</span>
        <span style={{ display: 'flex', gap: 4 }}>
          {agents.slice(0, 8).map((a) => (
            <span key={a.id} title={a.name} style={{ width: 14, height: 14, borderRadius: '50%', background: a.shirt, border: '2px solid #111', display: 'inline-block' }} />
          ))}
        </span>
      </div>
    </div>
  )
}
