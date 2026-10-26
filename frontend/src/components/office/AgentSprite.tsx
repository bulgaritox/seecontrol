import { useEffect, useMemo, useState } from 'react'

// Sprite chibi estilo Pokémon 12x16: cabezota, brillo en el pelo,
// mejillas y patitas que alternan al caminar.
// H = pelo · W = brillo · S = piel · E = ojos · M = boca · T = camisa · P = pantalón · B = botas
const HEAD_SHORT = [
  '....HHHH....',
  '..HHHHHHHH..',
  '.HHWHHHHHHH.',
  '.HHHHHHHHHH.',
  '.HHSSSSSSHH.',
  '..SSESSESS..',
  '..SSSMMMSS..',
  '.HHSSSSSSHH.',
]

const HEAD_LONG = [
  '....HHHH....',
  '..HHHHHHHH..',
  '.HHWHHHHHHH.',
  '.HHHHHHHHHH.',
  '.HSSESSESSH.',
  '.HSSSMMMSSH.',
  '.HHSSSSSSHH.',
  '.H..TTTT..H.',
]

const HEAD_SPIKY = [
  '..H.HHHH.H..',
  '..HHHHHHHH..',
  '.HHWHHHHHHH.',
  '.HHHHHHHHHH.',
  '.HHSSSSSSHH.',
  '..SSESSESS..',
  '..SSSMMMSS..',
  '.HHSSSSSSHH.',
]

const BODY = [
  '....TTTT....',
  '...TTTTTT...',
  '..TTTTTTTT..',
  '..STTTTTTS..',
]

const LEGS_A = ['...PP..PP...', '...PP..PP...', '...BB..BB...', '...BB..BB...']
const LEGS_B = ['....PPPP....', '....PPPP....', '....BBBB....', '....BBBB....']

const SKIN = '#F2C89B'
const EYES = '#1A1A1A'
const MOUTH = '#B4573E'
const SHINE = '#FFFFFF'
const PANTS = '#2B3A55'
const BOOTS = '#1F2937'

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

interface Props {
  hair: string
  shirt: string
  cut?: string
  px?: number
  status?: string
  aura?: string
  selected?: boolean
}

export function AgentSprite({ hair, shirt, cut = 'short', px = 4, status = 'idle', aura = 'transparent', selected = false }: Props) {
  const [frame, setFrame] = useState(0)
  const moving = status === 'working' || status === 'progress'
  const head = cut === 'long' ? HEAD_LONG : cut === 'spiky' ? HEAD_SPIKY : HEAD_SHORT
  const colors = useMemo(
    () => ({ H: hair, W: SHINE, S: SKIN, E: EYES, M: MOUTH, T: shirt, P: PANTS, B: BOOTS }),
    [hair, shirt],
  )
  const headShadow = useMemo(() => shadows(head, px, colors), [px, colors, head])
  const bodyShadow = useMemo(() => shadows(BODY, px, colors), [px, colors])
  const legsShadow = useMemo(
    () => [shadows(LEGS_A, px, colors), shadows(LEGS_B, px, colors)],
    [px, colors],
  )

  useEffect(() => {
    const iv = window.setInterval(() => setFrame((f) => (moving ? 1 - f : 0)), moving ? 300 : 700)
    return () => window.clearInterval(iv)
  }, [moving])

  const W = 12 * px
  const H = 16 * px
  const burn = status === 'blocked'
  const done = status === 'completed'
  const paused = status === 'paused'

  return (
    <div style={{ position: 'relative', width: W, height: H + 8 }}>
      <style>{`
        @keyframes sc-bob { 0%,100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(-3px) scaleY(1.02); } }
        @keyframes sc-work { 0%,100% { transform: translateY(0) rotate(-2deg); } 25% { transform: translateY(-4px) rotate(2deg); } 75% { transform: translateY(1px) rotate(-1deg); } }
        @keyframes sc-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes sc-sway { 0%,100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
        @keyframes sc-shadow { 0%,100% { transform: translateX(-50%) scaleX(1); opacity:.85; } 50% { transform: translateX(-50%) scaleX(.82); opacity:.6; } }
        @keyframes sc-ring { 0%,100% { opacity:.55; transform: translateX(-50%) scale(1); } 50% { opacity:1; transform: translateX(-50%) scale(1.08); } }
        @keyframes sc-done-pop { 0% { transform: scale(.8); } 60% { transform: scale(1.15); } 100% { transform: scale(1); } }
      `}</style>
      {/* anillo de "agente seleccionado" (indicador sombreado) */}
      {selected && (
        <div
          style={{
            position: 'absolute', bottom: -2, left: '50%',
            width: W * 1.25, height: 16, borderRadius: '50%',
            border: `2px solid ${shirt}`,
            boxShadow: `0 0 12px ${shirt}`,
            animation: 'sc-ring 1.6s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
      )}
      {/* sombra proyectada que "respira" con el bob */}
      <div
        style={{
          position: 'absolute', bottom: 1, left: '50%',
          width: W * 0.8, height: 7, borderRadius: '50%',
          background: 'rgba(0,0,0,.35)',
          animation: moving ? 'sc-shadow .6s ease-in-out infinite' : 'sc-shadow 2.4s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />
      {/* aura de fatiga */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: W * 0.95,
          height: 10,
          borderRadius: '50%',
          background: `radial-gradient(ellipse at center, ${aura} 0%, transparent 70%)`,
          opacity: 0.9,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: W,
          height: H,
          animation: burn
            ? 'sc-blink 0.9s steps(2) infinite'
            : moving
              ? 'sc-work 0.6s ease-in-out infinite'
              : status === 'thinking'
                ? 'sc-sway 2.2s ease-in-out infinite'
                : 'sc-bob 2.4s ease-in-out infinite',
          filter: done
            ? 'drop-shadow(0 0 6px #22C55E)'
            : burn
              ? 'drop-shadow(0 0 6px #EF4444)'
              : paused
                ? 'grayscale(0.9) drop-shadow(2px 2px 0 rgba(0,0,0,.35))'
                : 'drop-shadow(2px 2px 0 rgba(0,0,0,.35))',
          opacity: paused ? 0.75 : 1,
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, width: px, height: px, boxShadow: headShadow }} />
        {/* parpadeo: tapa los ojos un instante cada ~3.5s cuando no está en burnout */}
        {!burn && (
          <div
            style={{
              position: 'absolute', top: 5 * px, left: 4 * px, width: 4 * px, height: px,
              background: SKIN, animation: 'sc-eyeblink 3.6s steps(1) infinite',
            }}
          />
        )}
        <div
          style={{
            position: 'absolute', top: 0, left: 0, width: px, height: px,
            transform: `translateY(${8 * px}px)`, boxShadow: bodyShadow,
          }}
        />
        <div
          style={{
            position: 'absolute', top: 0, left: 0, width: px, height: px,
            transform: `translateY(${12 * px}px)`, boxShadow: legsShadow[frame],
          }}
        />
      </div>
      <style>{`@keyframes sc-eyeblink { 0%,96%,100% { opacity: 0; } 98% { opacity: 1; } }`}</style>
    </div>
  )
}
