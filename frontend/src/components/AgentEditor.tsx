import { useEffect, useState } from 'react'
import type { LiveAgent } from '../hooks/useLiveOffice'
import { AgentSprite } from './office/AgentSprite'
import { ROSTER, FATIGUE_META, fatigueOf } from '../data/demo'
import { useProviders, modelsForProvider, defaultModelFor } from '../hooks/useProviders'
import { ensureAuth, getSkills, pingAgent, type AgentPatch, type PingResult } from '../api'

interface Props {
  agent: LiveAgent
  onClose: () => void
  onSave: (id: string, patch: AgentPatch) => void
  onLook: (key: string, look: { hair: string; shirt: string; character: string; cut?: string; glasses?: boolean; skin?: string }) => void
  onPause: (id: string) => void
  onResume: (id: string) => void
  onTogglePower: (id: string) => void
  onRemove: (id: string) => void
  onMood: (id: string, mood: PingResult['mood']) => void
}

const GB = "'Press Start 2P', monospace"
const MONO = "ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace"

// tonos de piel (el primero es el default del sprite)
const SKIN_TONES = ['#F2C89B', '#FFE0BD', '#E8B48C', '#C68642', '#8D5524', '#5C3A21']
// cortes de pelo disponibles en el sprite
const CUTS: { id: string; label: string }[] = [
  { id: 'short', label: 'Corto' },
  { id: 'long', label: 'Largo' },
  { id: 'spiky', label: 'Pinchos' },
  { id: 'bun', label: 'Moño' },
  { id: 'cap', label: 'Gorra' },
]
// colores rápidos de pelo
const HAIR_SWATCHES = ['#1E1E1E', '#5A3A1A', '#8B5A2B', '#E0B050', '#C0392B', '#1E3A5F', '#1F7A1F', '#7A2EA0', '#FF69B4', '#9CA3AF', '#FFFFFF', '#00BFFF']
// colores rápidos de camisa
const SHIRT_SWATCHES = ['#7A2EA0', '#00BFFF', '#32CD32', '#00FFFF', '#FFD700', '#FFA500', '#00FF7F', '#FF9EC7', '#EF4444', '#3B82F6', '#111827', '#E5E7EB']
// presets combinados (look completo rápido)
const PRESETS: { name: string; hair: string; shirt: string; cut: string; glasses?: boolean }[] = [
  { name: 'Hacker', hair: '#1E1E1E', shirt: '#111827', cut: 'spiky', glasses: true },
  { name: 'Creativa', hair: '#FF69B4', shirt: '#FF9EC7', cut: 'long' },
  { name: 'Clásico', hair: '#5A3A1A', shirt: '#3B82F6', cut: 'short' },
  { name: 'Analista', hair: '#0E5A5A', shirt: '#00FFFF', cut: 'short', glasses: true },
  { name: 'Casual', hair: '#E0B050', shirt: '#FFA500', cut: 'cap' },
  { name: 'Ninja', hair: '#1E3A5F', shirt: '#1F2937', cut: 'bun' },
]

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box' as const,
  background: '#111',
  border: '1px solid #333',
  borderRadius: 6,
  padding: '7px 9px',
  fontSize: 12,
  color: '#fff',
  fontFamily: MONO,
}

export function AgentEditor({ agent, onClose, onSave, onLook, onPause, onResume, onTogglePower, onRemove, onMood }: Props) {
  const [name, setName] = useState(agent.name)
  const [role, setRole] = useState(agent.role)
  const [desc, setDesc] = useState(agent.description)
  const [provider, setProvider] = useState(agent.provider)
  const [model, setModel] = useState(agent.model)
  const [customModel, setCustomModel] = useState(false)
  const [temperature, setTemperature] = useState(0.7)
  const [skills, setSkills] = useState<string[]>(agent.skills ?? [])
  const [character, setCharacter] = useState(agent.character)
  const [cut, setCut] = useState(agent.cut ?? 'short')
  const [hair, setHair] = useState(agent.hair)
  const [shirt, setShirt] = useState(agent.shirt)
  const [glasses, setGlasses] = useState<boolean>(agent.glasses ?? false)
  const [skin, setSkin] = useState<string>(agent.skin ?? SKIN_TONES[0])
  const [catalog, setCatalog] = useState<{ id: string; name: string; category: string }[]>([])
  const [customSkill, setCustomSkill] = useState('')
  const [saved, setSaved] = useState(false)
  const [pingMsg, setPingMsg] = useState('Sigues en línea? Responde solo: OK')
  const [pinging, setPinging] = useState(false)
  const [pingResult, setPingResult] = useState<PingResult | null>(null)

  const fat = fatigueOf(agent.energy)
  const paused = agent.status === 'paused'
  const { catalog: provCatalog } = useProviders()

  useEffect(() => {
    let off = false
    ;(async () => {
      await ensureAuth()
      if (off) return
      setCatalog(await getSkills())
    })()
    return () => {
      off = true
    }
  }, [])

  const pickCharacter = (c: string) => {
    setCharacter(c)
    const base = ROSTER.find((r) => r.character === c)
    if (base) {
      setHair(base.hair)
      setShirt(base.shirt)
      setCut(base.cut)
    }
  }

  const toggleSkill = (s: string) => {
    setSkills((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  const save = () => {
    onSave(agent.id, {
      name,
      role,
      description: desc,
      character_type: character,
      provider,
      model,
      temperature,
      skills,
    })
    onLook(agent.backendId ?? agent.id, { hair, shirt, character, cut, glasses, skin })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  const provModels = modelsForProvider(provCatalog, provider)
  const pickProvider = (p: string) => {
    setProvider(p)
    setModel(defaultModelFor(provCatalog, p))
    setCustomModel(false)
  }

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 340, maxWidth: '92vw', background: '#141414', borderLeft: '2px solid #333', zIndex: 50, display: 'flex', flexDirection: 'column', fontFamily: MONO }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderBottom: '1px solid #2A2A2A' }}>
        <AgentSprite hair={hair} shirt={shirt} cut={cut} glasses={glasses} skin={skin} px={3} status={agent.status} aura={FATIGUE_META[fat].color} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: GB, fontSize: 11, color: FATIGUE_META[fat].color }}>⚙ {name}</div>
          <div style={{ fontSize: 11, color: '#A8A29E' }}>{role} · {agent.provider}/{agent.model}</div>
        </div>
        <button onClick={onClose} style={{ background: '#262626', color: '#fff', border: '1px solid #333', borderRadius: 6, cursor: 'pointer', padding: '4px 10px' }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <section>
          <div style={{ fontFamily: GB, fontSize: 9, color: '#78716C', marginBottom: 6 }}>IDENTIDAD</div>
          <label style={{ fontSize: 11, color: '#A8A29E' }}>Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          <label style={{ fontSize: 11, color: '#A8A29E', marginTop: 6, display: 'block' }}>Rol (default del agente)</label>
          <input value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle} />
          <label style={{ fontSize: 11, color: '#A8A29E', marginTop: 6, display: 'block' }}>Descripción / núcleo</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
        </section>

        <section>
          <div style={{ fontFamily: GB, fontSize: 9, color: '#78716C', marginBottom: 6 }}>MOTOR LINGÜÍSTICO</div>
          <label style={{ fontSize: 11, color: '#A8A29E' }}>Proveedor (primero)</label>
          <select value={provider} onChange={(e) => pickProvider(e.target.value)} style={inputStyle}>
            {provCatalog.map((p) => (
              <option key={p.id} value={p.id}>{p.enabled ? '✓' : '○'} {p.label}{p.note ? ` — ${p.note}` : ''}</option>
            ))}
          </select>
          <label style={{ fontSize: 11, color: '#A8A29E', marginTop: 6, display: 'block' }}>Modelo (del proveedor)</label>
          <select
            value={customModel ? '__custom' : model}
            onChange={(e) => {
              if (e.target.value === '__custom') setCustomModel(true)
              else {
                setCustomModel(false)
                setModel(e.target.value)
              }
            }}
            style={inputStyle}
          >
            {provModels.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
            <option value="__custom">✏ personalizado…</option>
          </select>
          {customModel && (
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="model-id exacto" style={{ ...inputStyle, marginTop: 6 }} />
          )}
          <label style={{ fontSize: 11, color: '#A8A29E', marginTop: 6, display: 'block' }}>Temperatura: {temperature.toFixed(1)}</label>
          <input type="range" min={0} max={2} step={0.1} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} style={{ width: '100%' }} />
        </section>

        <section>
          <div style={{ fontFamily: GB, fontSize: 9, color: '#78716C', marginBottom: 6 }}>CINTURÓN DE SKILLS ({skills.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {catalog.map((s) => {
              const on = skills.includes(s.name)
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSkill(s.name)}
                  title={s.category}
                  style={{
                    fontSize: 11,
                    fontFamily: MONO,
                    padding: '4px 10px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    border: on ? '2px solid #22C55E' : '1px solid #333',
                    background: on ? '#052E16' : '#1E1E1E',
                    color: on ? '#22C55E' : '#A8A29E',
                  }}
                >
                  {on ? '✓ ' : '+ '}{s.name}
                </button>
              )
            })}
            {catalog.length === 0 && <span style={{ fontSize: 11, color: '#57534E' }}>Sin catálogo (backend offline) — añade manual:</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input value={customSkill} onChange={(e) => setCustomSkill(e.target.value)} placeholder="Skill_Custom…" style={{ ...inputStyle, flex: 1 }} />
            <button
              onClick={() => {
                const s = customSkill.trim()
                if (s && !skills.includes(s)) setSkills((p) => [...p, s])
                setCustomSkill('')
              }}
              style={{ background: '#262626', color: '#fff', border: '1px solid #333', borderRadius: 6, cursor: 'pointer', padding: '0 12px' }}
            >
              +
            </button>
          </div>
          {skills.filter((s) => !catalog.some((c) => c.name === s)).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {skills.filter((s) => !catalog.some((c) => c.name === s)).map((s) => (
                <button key={s} onClick={() => toggleSkill(s)} style={{ fontSize: 11, fontFamily: MONO, padding: '4px 10px', borderRadius: 12, cursor: 'pointer', border: '2px solid #F59E0B', background: '#451A03', color: '#FBBF24' }}>
                  ✓ {s} ✕
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <div style={{ fontFamily: GB, fontSize: 9, color: '#78716C', marginBottom: 6 }}>ASPECTO (CUSTOMIZADOR)</div>

          {/* presets rápidos */}
          <label style={{ fontSize: 11, color: '#A8A29E' }}>Presets de estilo</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 10 }}>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => { setHair(p.hair); setShirt(p.shirt); setCut(p.cut); setGlasses(!!p.glasses) }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: MONO, padding: '4px 9px', borderRadius: 12, cursor: 'pointer', border: '1px solid #333', background: '#1E1E1E', color: '#D6D3D1' }}
                title={`${p.name}: pelo/camisa/corte`}
              >
                <span style={{ width: 10, height: 10, borderRadius: 2, background: p.hair, border: '1px solid #000' }} />
                <span style={{ width: 10, height: 10, borderRadius: 2, background: p.shirt, border: '1px solid #000' }} />
                {p.name}
              </button>
            ))}
          </div>

          <label style={{ fontSize: 11, color: '#A8A29E' }}>Personaje base</label>
          <select value={character} onChange={(e) => pickCharacter(e.target.value)} style={inputStyle}>
            {ROSTER.map((r) => (
              <option key={r.character} value={r.character}>{r.name} — {r.role}</option>
            ))}
            <option value="custom">custom</option>
          </select>

          {/* corte de pelo (botones) */}
          <label style={{ fontSize: 11, color: '#A8A29E', marginTop: 10, display: 'block' }}>Corte de pelo</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {CUTS.map((c) => (
              <button
                key={c.id}
                onClick={() => setCut(c.id)}
                style={{ fontSize: 11, fontFamily: MONO, padding: '5px 11px', borderRadius: 10, cursor: 'pointer', border: cut === c.id ? '2px solid #22C55E' : '1px solid #333', background: cut === c.id ? '#052E16' : '#1E1E1E', color: cut === c.id ? '#22C55E' : '#A8A29E' }}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* color de pelo: swatches + picker */}
          <label style={{ fontSize: 11, color: '#A8A29E', marginTop: 10, display: 'block' }}>Color de pelo</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {HAIR_SWATCHES.map((c) => (
              <button key={c} onClick={() => setHair(c)} title={c} style={{ width: 20, height: 20, borderRadius: 5, cursor: 'pointer', background: c, border: hair.toLowerCase() === c.toLowerCase() ? '2px solid #22C55E' : '1px solid #000' }} />
            ))}
            <input type="color" value={hair} onChange={(e) => setHair(e.target.value)} title="Personalizado" style={{ width: 28, height: 24, background: 'transparent', border: 'none', cursor: 'pointer' }} />
          </div>

          {/* color de camisa: swatches + picker */}
          <label style={{ fontSize: 11, color: '#A8A29E', marginTop: 10, display: 'block' }}>Color de camisa</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {SHIRT_SWATCHES.map((c) => (
              <button key={c} onClick={() => setShirt(c)} title={c} style={{ width: 20, height: 20, borderRadius: 5, cursor: 'pointer', background: c, border: shirt.toLowerCase() === c.toLowerCase() ? '2px solid #22C55E' : '1px solid #000' }} />
            ))}
            <input type="color" value={shirt} onChange={(e) => setShirt(e.target.value)} title="Personalizado" style={{ width: 28, height: 24, background: 'transparent', border: 'none', cursor: 'pointer' }} />
          </div>

          {/* tono de piel */}
          <label style={{ fontSize: 11, color: '#A8A29E', marginTop: 10, display: 'block' }}>Tono de piel</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {SKIN_TONES.map((c) => (
              <button key={c} onClick={() => setSkin(c)} title={c} style={{ width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', background: c, border: skin.toLowerCase() === c.toLowerCase() ? '2px solid #22C55E' : '1px solid #000' }} />
            ))}
          </div>

          {/* accesorios */}
          <label style={{ fontSize: 11, color: '#A8A29E', marginTop: 10, display: 'block' }}>Accesorios</label>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button
              onClick={() => setGlasses((g) => !g)}
              style={{ fontSize: 11, fontFamily: MONO, padding: '5px 12px', borderRadius: 10, cursor: 'pointer', border: glasses ? '2px solid #22C55E' : '1px solid #333', background: glasses ? '#052E16' : '#1E1E1E', color: glasses ? '#22C55E' : '#A8A29E' }}
            >
              {glasses ? '✓ Gafas' : '+ Gafas'}
            </button>
          </div>
        </section>

        <section>
          <div style={{ fontFamily: GB, fontSize: 9, color: '#78716C', marginBottom: 6 }}>CONTROL</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => onTogglePower(agent.id)}
              style={{ flex: 1, padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 12, background: agent.is_active ? '#052E16' : '#262626', color: agent.is_active ? '#22C55E' : '#9CA3AF', fontFamily: MONO }}
            >
              {agent.is_active ? '⏻ Encendido' : '💤 Apagado'}
            </button>
            <button
              onClick={() => (paused ? onResume(agent.id) : onPause(agent.id))}
              style={{ flex: 1, padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 12, background: paused ? '#052E16' : '#451A03', color: paused ? '#22C55E' : '#FBBF24', fontFamily: MONO }}
            >
              {paused ? '▶ Reanudar actividad' : '⏸ Detener actividad'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#78716C', marginTop: 6 }}>
            Estado actual: <b style={{ color: '#fff' }}>{agent.status}</b> ·{' '}
            energía {Math.round(agent.energy)}% · {FATIGUE_META[fat].label}
          </div>
          <button
            onClick={() => {
              if (window.confirm(`¿Eliminar a ${agent.name} del equipo?`)) {
                onRemove(agent.id)
                onClose()
              }
            }}
            style={{ width: '100%', marginTop: 8, padding: 8, borderRadius: 8, border: '1px solid #7F1D1D', cursor: 'pointer', fontSize: 12, background: '#450A0A', color: '#FCA5A5', fontFamily: MONO }}
          >
            🗑 Quitar agente del equipo
          </button>
        </section>

        <section>
          <div style={{ fontFamily: GB, fontSize: 9, color: '#78716C', marginBottom: 6 }}>⚡ PROBAR EN VIVO</div>
          <div style={{ fontSize: 11, color: '#78716C', marginBottom: 6 }}>
            Pregunta mínima a su proveedor ({agent.provider}/{agent.model}) — gasta poquísimos tokens.
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={pingMsg} onChange={(e) => setPingMsg(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <button
              disabled={pinging || !agent.backendId}
              onClick={async () => {
                if (!agent.backendId) return
                setPinging(true)
                setPingResult(null)
                try {
                  const r = await pingAgent(agent.backendId, pingMsg)
                  setPingResult(r)
                  onMood(agent.id, r.mood)
                } catch {
                  setPingResult({ ok: false, mood: { headline: `${agent.name}: no pude contactar al backend 😵`, detail: 'error de red local', code: 'generic' } })
                } finally {
                  setPinging(false)
                }
              }}
              title={agent.backendId ? 'Enviar 1 pregunta mínima' : 'Solo agentes del backend'}
              style={{ fontSize: 12, fontFamily: MONO, fontWeight: 'bold', background: '#1E3A8A', color: '#fff', border: 'none', borderRadius: 6, padding: '0 12px', cursor: agent.backendId ? 'pointer' : 'not-allowed', opacity: agent.backendId ? 1 : 0.5 }}
            >
              {pinging ? '…' : '⚡'}
            </button>
          </div>
          {pingResult && (
            <div style={{ marginTop: 8, background: pingResult.ok ? '#052E16' : '#FEF3C7', border: `2px solid ${pingResult.ok ? '#22C55E' : '#F59E0B'}`, borderRadius: 8, padding: 10 }}>
              {pingResult.ok ? (
                <div style={{ fontSize: 13, color: '#BBF7D0' }}>
                  💬 <b>{pingResult.agent}</b> ({pingResult.tokens} tok): “{pingResult.reply}”
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 13, color: '#111' }}><b>{pingResult.mood?.headline}</b></div>
                  <div style={{ fontSize: 10, color: '#78716C', marginTop: 4 }}>{pingResult.mood?.detail}</div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <div style={{ padding: 12, borderTop: '1px solid #2A2A2A', display: 'flex', gap: 8 }}>
        <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #333', background: '#1E1E1E', color: '#A8A29E', cursor: 'pointer', fontFamily: MONO, fontSize: 12 }}>
          Cancelar
        </button>
        <button onClick={save} style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: '#22C55E', color: '#052E16', cursor: 'pointer', fontWeight: 'bold', fontFamily: MONO, fontSize: 12 }}>
          {saved ? '✓ Guardado' : '💾 Guardar (backend + local)'}
        </button>
      </div>
    </div>
  )
}
