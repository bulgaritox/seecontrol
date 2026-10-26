import { useEffect, useMemo, useState } from 'react'

// Sprite chibi estilo RPG dibujado con box-shadow (pixel-perfect), rejilla 16x22.
// Rediseño con mejor anatomía: cabeza redondeada con contorno limpio, ojos
// separados y centrados, nariz y boca sutiles, cuello, hombros y torso con
// manga; piernas que alternan al caminar. Accesorios y varios cortes de pelo.
//
// Leyenda de píxeles:
//   H = pelo         W = brillo del pelo     D = contorno del pelo
//   S = piel         K = sombra de piel      O = contorno oscuro (cara/cuerpo)
//   E = ojo          B = brillo del ojo      N = nariz   M = boca
//   T = camisa       U = sombra de camisa    C = cuello/piel
//   L = pantalón     Z = zapatos             G = gafas/gorra

// ---- CABEZAS (16 ancho x 11 alto) ----
const HEAD_SHORT = [
  '.....DDDDDD.....',
  '...DDHHHHHHDD...',
  '..DHHHHHHHHHHD..',
  '..DHHWWHHHHHHD..',
  '..OHHHHHHHHHHO..',
  '..OHSSSSSSSSHO..',
  '..OSSSSSSSSSSO..',
  '..OSEBSSSSEBSO..',
  '..OSSSSNNSSSSO..',
  '..OKSSSMMSSSKO..',
  '...OKSSSSSSKO...',
]

const HEAD_LONG = [
  '.....DDDDDD.....',
  '...DDHHHHHHDD...',
  '..DHHHHHHHHHHD..',
  '.DHHHWWHHHHHHHD.',
  '.OHHHHHHHHHHHHO.',
  '.OHHSSSSSSSSHHO.',
  '.OHSSSSSSSSSSHO.',
  '.OHSEBSSSSEBSHO.',
  '.OHSSSSNNSSSSHO.',
  '.OHKSSSMMSSSKHO.',
  '.OHHKSSSSSSKHHO.',
]

const HEAD_SPIKY = [
  '..D.DD.DD.DD.D..',
  '..DHHHHHHHHHHD..',
  '..DHHHHHHHHHHD..',
  '..DHHWWHHHHHHD..',
  '..OHHHHHHHHHHO..',
  '..OHSSSSSSSSHO..',
  '..OSSSSSSSSSSO..',
  '..OSEBSSSSEBSO..',
  '..OSSSSNNSSSSO..',
  '..OKSSSMMSSSKO..',
  '...OKSSSSSSKO...',
]

const HEAD_BUN = [
  '......HHHH......',
  '.....DHHHHD.....',
  '...DDHHHHHHDD...',
  '..DHHWWHHHHHHD..',
  '..OHHHHHHHHHHO..',
  '..OHSSSSSSSSHO..',
  '..OSSSSSSSSSSO..',
  '..OSEBSSSSEBSO..',
  '..OSSSSNNSSSSO..',
  '..OKSSSMMSSSKO..',
  '...OKSSSSSSKO...',
]

const HEAD_CAP = [
  '....GGGGGGGG....',
  '..GGGGGGGGGGGG..',
  '.GGGGGGGGGGGGGG.',
  '..GGGGGGGGGGGG..',
  '..OHSSSSSSSSHO..',
  '..OSSSSSSSSSSO..',
  '..OSSSSSSSSSSO..',
  '..OSEBSSSSEBSO..',
  '..OSSSSNNSSSSO..',
  '..OKSSSMMSSSKO..',
  '...OKSSSSSSKO...',
]

// overlay de gafas (fila de ojos ~7). Se superpone al rostro.
const GLASSES = [
  '...............',
  '...............',
  '...............',
  '...............',
  '...............',
  '...............',
  '...............',
  '..GGGGG.GGGGG..',
  '...............',
  '...............',
  '...............',
]

// ---- CUERPO (15 ancho x 7 alto): cuello, hombros, torso, manga ----
const BODY_IDLE = [
  '......CCC......',
  '....TTTTTTT....',
  '...TTTTTTTTT...',
  '..STTTUUUTTTS..',
  '..STTTUUUTTTS..',
  '..SSTTTTTTTSS..',
  '...TTTTTTTTT...',
]

// brazos al frente (tecleando / sosteniendo algo)
const BODY_ARMS_FWD = [
  '......CCC......',
  '....TTTTTTT....',
  '...TTTTTTTTT...',
  '...TTTUUUTTT...',
  '..STTTTTTTTTS..',
  '..SSSTTTTTSSS..',
  '...SSSSSSSSS...',
]

// ---- PIERNAS (15 ancho x 4 alto) ----
const LEGS_A = ['...LLLL.LLLL...', '...LLLL.LLLL...', '...ZZZL.LZZZ...', '...ZZZ...ZZZ...']
const LEGS_B = ['...LLLLLLLLL...', '...LLLL.LLLL...', '...ZZZ...ZZZ...', '...ZZZZ.ZZZZ...']
const LEGS_SIT = ['..LLLLLLLLLLL..', '..LLLLLLLLLLL..', '..ZZZ...ZZZ....', '...............']

const SKIN = '#F6CDA0'
const OUTLINE = '#3A2A1E'
const EYE = '#2A2320'
const EYE_SHINE = '#FFFFFF'
const NOSE = '#E0A878'
const MOUTH = '#B5654A'
const SHINE = '#FFFFFF'
const PANTS = '#2B3A55'
const BOOTS = '#1B2230'

function hairShade(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return '#000000'
  const n = parseInt(h, 16)
  const r = Math.max(0, ((n >> 16) & 255) * 0.55) | 0
  const g = Math.max(0, ((n >> 8) & 255) * 0.55) | 0
  const b = Math.max(0, (n & 255) * 0.55) | 0
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

function shirtShade(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return '#000000'
  const n = parseInt(h, 16)
  const r = Math.max(0, ((n >> 16) & 255) * 0.72) | 0
  const g = Math.max(0, ((n >> 8) & 255) * 0.72) | 0
  const b = Math.max(0, (n & 255) * 0.72) | 0
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

function shadows(rows: string[], px: number, colors: Record<string, string>): string {
  const out: string[] = []
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = colors[row[x]]
      if (c) out.push(`${x * px}px ${y * px}px 0 ${px}px ${c}`)
    }
  })
  return out.join(',')
}

export type SpriteStatus =
  | 'idle' | 'working' | 'progress' | 'thinking' | 'blocked'
  | 'completed' | 'paused' | 'typing' | 'carrying'

export type HairCut = 'short' | 'long' | 'spiky' | 'bun' | 'cap'

interface Props {
  hair: string
  shirt: string
  cut?: string
  px?: number
  status?: string
  aura?: string
  selected?: boolean
  /** gafas u otro accesorio en la cara */
  glasses?: boolean
  /** tono de piel (override) */
  skin?: string
  /** sentado detrás del escritorio (oculta piernas) */
  seated?: boolean
}

function headFor(cut: string): string[] {
  switch (cut) {
    case 'long': return HEAD_LONG
    case 'spiky': return HEAD_SPIKY
    case 'bun': return HEAD_BUN
    case 'cap': return HEAD_CAP
    default: return HEAD_SHORT
  }
}

export function AgentSprite({
  hair, shirt, cut = 'short', px = 4, status = 'idle',
  aura = 'transparent', selected = false, glasses = false, skin, seated = false,
}: Props) {
  const [frame, setFrame] = useState(0)
  const walking = status === 'working' || status === 'progress'
  const typing = status === 'typing'
  const carrying = status === 'carrying'
  const head = headFor(cut)
  const capColor = cut === 'cap' ? hair : '#1F2937'
  const skinColor = skin ?? SKIN

  const colors = useMemo(
    () => ({
      H: hair,
      W: SHINE,
      D: hairShade(hair),
      O: OUTLINE,
      S: skinColor,
      K: shirtShade(skinColor),
      C: skinColor,
      E: EYE,
      B: EYE_SHINE,
      N: NOSE,
      M: MOUTH,
      T: shirt,
      U: shirtShade(shirt),
      L: PANTS,
      Z: BOOTS,
      G: cut === 'cap' ? capColor : '#20232B',
    }),
    [hair, shirt, skinColor, cut, capColor],
  )

  const headShadow = useMemo(() => shadows(head, px, colors), [px, colors, head])
  const glassesShadow = useMemo(
    () => (glasses ? shadows(GLASSES, px, { G: '#20232B' }) : ''),
    [px, glasses],
  )
  const bodyIdle = useMemo(() => shadows(BODY_IDLE, px, colors), [px, colors])
  const bodyArmsFwd = useMemo(() => shadows(BODY_ARMS_FWD, px, colors), [px, colors])
  const legsShadow = useMemo(
    () => [shadows(LEGS_A, px, colors), shadows(LEGS_B, px, colors), shadows(LEGS_SIT, px, colors)],
    [px, colors],
  )

  const moving = walking || typing
  useEffect(() => {
    const speed = typing ? 180 : walking ? 300 : 700
    const iv = window.setInterval(() => setFrame((f) => (moving ? 1 - f : 0)), speed)
    return () => window.clearInterval(iv)
  }, [moving, typing, walking])

  const W = 16 * px
  const H = 22 * px
  const burn = status === 'blocked'
  const done = status === 'completed'
  const paused = status === 'paused'

  const bodyShadow = typing || carrying ? bodyArmsFwd : bodyIdle
  const legsIndex = seated ? 2 : walking ? frame : 0

  const bodyAnim = burn
    ? 'sc-blink 0.9s steps(2) infinite'
    : typing
      ? 'sc-type 0.36s ease-in-out infinite'
      : walking
        ? 'sc-work 0.6s ease-in-out infinite'
        : status === 'thinking'
          ? 'sc-sway 2.2s ease-in-out infinite'
          : carrying
            ? 'sc-carry 0.5s ease-in-out infinite'
            : 'sc-bob 2.4s ease-in-out infinite'

  return (
    <div style={{ position: 'relative', width: W, height: H + 8 }}>
      <style>{`
        @keyframes sc-bob { 0%,100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(-3px) scaleY(1.02); } }
        @keyframes sc-work { 0%,100% { transform: translateY(0) rotate(-2deg); } 25% { transform: translateY(-4px) rotate(2deg); } 75% { transform: translateY(1px) rotate(-1deg); } }
        @keyframes sc-type { 0%,100% { transform: translateY(0); } 50% { transform: translateY(1.5px); } }
        @keyframes sc-carry { 0%,100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-2px) rotate(1deg); } }
        @keyframes sc-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes sc-sway { 0%,100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
        @keyframes sc-shadow { 0%,100% { transform: translateX(-50%) scaleX(1); opacity:.85; } 50% { transform: translateX(-50%) scaleX(.82); opacity:.6; } }
        @keyframes sc-ring { 0%,100% { opacity:.55; transform: translateX(-50%) scale(1); } 50% { opacity:1; transform: translateX(-50%) scale(1.08); } }
        @keyframes sc-eyeblink { 0%,94%,100% { opacity: 0; } 97% { opacity: 1; } }
        @keyframes sc-sheet { 0%,100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-1.5px) rotate(-3deg); } }
      `}</style>

      {/* anillo de selección */}
      {selected && (
        <div
          style={{
            position: 'absolute', bottom: -2, left: '50%',
            width: W * 1.05, height: 13, borderRadius: '50%',
            border: `2px solid ${shirt}`,
            boxShadow: `0 0 12px ${shirt}`,
            animation: 'sc-ring 1.6s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* sombra proyectada */}
      {!seated && (
        <div
          style={{
            position: 'absolute', bottom: 1, left: '50%',
            width: W * 0.55, height: 6, borderRadius: '50%',
            background: 'rgba(0,0,0,.35)',
            animation: moving ? 'sc-shadow .6s ease-in-out infinite' : 'sc-shadow 2.4s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* aura de fatiga */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: W * 0.72, height: 9, borderRadius: '50%',
          background: `radial-gradient(ellipse at center, ${aura} 0%, transparent 70%)`,
          opacity: 0.9,
        }}
      />

      <div
        style={{
          position: 'absolute', top: 0, left: 0, width: W, height: H,
          animation: bodyAnim,
          filter: done
            ? 'drop-shadow(0 0 6px #22C55E)'
            : burn
              ? 'drop-shadow(0 0 6px #EF4444)'
              : paused
                ? 'grayscale(0.9) drop-shadow(2px 2px 0 rgba(0,0,0,.35))'
                : 'drop-shadow(1px 2px 0 rgba(0,0,0,.3))',
          opacity: paused ? 0.75 : 1,
        }}
      >
        {/* cabeza */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: px, height: px, boxShadow: headShadow }} />
        {/* gafas (overlay) */}
        {glasses && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: px, height: px, boxShadow: glassesShadow }} />
        )}
        {/* parpadeo: solo cubre la fila de ojos (y=7) en las dos posiciones */}
        {!burn && (
          <>
            <div
              style={{
                position: 'absolute', top: 7 * px, left: 4 * px, width: 2 * px, height: px,
                background: skinColor, animation: 'sc-eyeblink 4s steps(1) infinite',
              }}
            />
            <div
              style={{
                position: 'absolute', top: 7 * px, left: 10 * px, width: 2 * px, height: px,
                background: skinColor, animation: 'sc-eyeblink 4s steps(1) infinite',
              }}
            />
          </>
        )}
        {/* cuerpo */}
        <div
          style={{
            position: 'absolute', top: 0, left: 0, width: px, height: px,
            transform: `translateY(${11 * px}px)`, boxShadow: bodyShadow,
          }}
        />
        {/* piernas */}
        <div
          style={{
            position: 'absolute', top: 0, left: 0, width: px, height: px,
            transform: `translateY(${18 * px}px)`, boxShadow: legsShadow[legsIndex],
          }}
        />
        {/* hoja que lleva cuando va a entregar */}
        {carrying && (
          <div
            style={{
              position: 'absolute', top: 12 * px, left: 10 * px,
              width: 7 * px, height: 9 * px,
              background: '#FEF3C7', border: `${Math.max(1, px / 2)}px solid #F59E0B`,
              borderRadius: 1, animation: 'sc-sheet 0.5s ease-in-out infinite',
            }}
          />
        )}
      </div>
    </div>
  )
}
