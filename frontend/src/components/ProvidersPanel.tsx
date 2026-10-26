import { useEffect, useState } from 'react'
import { PROVIDERS, FAILOVER_ORDER } from '../data/demo'
import { useProviders } from '../hooks/useProviders'

const GB = "'Press Start 2P', monospace"
const MONO = "ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace"

// Modelo preferido por proveedor (elección del usuario), guardado localmente.
function loadPrefs(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem('sc_model_prefs') ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

export function ProvidersPanel({ onProviderSaved }: { onProviderSaved?: (id: string) => void }) {
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [budget, setBudget] = useState('50000')
  const [escalation, setEscalation] = useState('notify_user')
  const { catalog, reload } = useProviders()
  const [prefs, setPrefs] = useState<Record<string, string>>(loadPrefs)

  const setPref = (providerId: string, model: string) => {
    const next = { ...prefs, [providerId]: model }
    setPrefs(next)
    try {
      localStorage.setItem('sc_model_prefs', JSON.stringify(next))
    } catch {
      /* noop */
    }
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('sc_byok') ?? '{}') as {
        keys?: Record<string, string>
        budget?: string
        escalation?: string
      }
      setKeys(saved.keys ?? {})
      setBudget(saved.budget ?? '50000')
      setEscalation(saved.escalation ?? 'notify_user')
    } catch {
      /* noop */
    }
  }, [])

  const save = (k: Record<string, string>, b: string, e: string) => {
    setKeys(k)
    setBudget(b)
    setEscalation(e)
    localStorage.setItem('sc_byok', JSON.stringify({ keys: k, budget: b, escalation: e }))
  }

  const hemis = (h: 'global' | 'asia') => PROVIDERS.filter((p) => p.hemisphere === h)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ── Gestión de modelos integrados (fuente de verdad: backend) ── */}
      <div style={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 10, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', color: '#fff', fontFamily: GB }}>
            🧩 MODELOS INTEGRADOS POR PROVEEDOR
          </div>
          <button
            onClick={reload}
            style={{ fontSize: 11, fontFamily: MONO, background: '#1E1E1E', color: '#A8A29E', border: '1px solid #333', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
          >
            ↻ Recargar
          </button>
        </div>
        <div style={{ fontSize: 12, color: '#A8A29E', marginBottom: 12 }}>
          Solo los modelos verificados que la plataforma integra, listados por su proveedor.
          <b style={{ color: '#22C55E' }}> ✓ activo</b> = tiene API key en el backend ·
          <b style={{ color: '#78716C' }}> ○ sin key</b>. Elige el modelo por defecto de cada proveedor.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
          {catalog.map((p) => (
            <div
              key={p.id}
              style={{
                background: '#1E1E1E',
                border: '1px solid #333',
                borderLeft: `4px solid ${p.enabled ? '#22C55E' : '#44403C'}`,
                borderRadius: 8,
                padding: 10,
                opacity: p.enabled ? 1 : 0.7,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <b style={{ fontSize: 13, color: '#fff' }}>{p.label}</b>
                <span style={{ fontSize: 10, color: p.enabled ? '#22C55E' : '#78716C' }}>
                  {p.enabled ? '✓ activo' : '○ sin key'}
                </span>
              </div>
              {p.note && <div style={{ fontSize: 10, color: '#F59E0B', marginBottom: 6 }}>⚠ {p.note}</div>}
              <div style={{ fontSize: 10, color: '#78716C', marginBottom: 4 }}>
                {p.models.length} modelo{p.models.length === 1 ? '' : 's'} · por defecto:
              </div>
              <select
                value={prefs[p.id] ?? p.default_model ?? ''}
                onChange={(e) => setPref(p.id, e.target.value)}
                disabled={p.models.length === 0}
                style={{ width: '100%', boxSizing: 'border-box', background: '#111', border: '1px solid #333', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: '#fff', fontFamily: MONO, marginBottom: 6 }}
              >
                {p.models.length === 0 && <option value="">(sin modelos)</option>}
                {p.models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {p.models.map((m) => (
                  <span
                    key={m}
                    title={m}
                    style={{
                      fontSize: 10, fontFamily: MONO, padding: '2px 7px', borderRadius: 10,
                      border: (prefs[p.id] ?? p.default_model) === m ? '1px solid #22C55E' : '1px solid #333',
                      background: (prefs[p.id] ?? p.default_model) === m ? '#052E16' : '#111',
                      color: (prefs[p.id] ?? p.default_model) === m ? '#22C55E' : '#A8A29E',
                      whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 'bold', color: '#fff', marginBottom: 4, fontFamily: GB }}>
          🔑 SOBERANÍA DE INFRAESTRUCTURA (BYOK)
        </div>
        <div style={{ fontSize: 12, color: '#A8A29E', marginBottom: 12 }}>
          Industrium no revende cómputo: aporta tus llaves. Se guardan solo en tu navegador. Al guardar,
          los agentes de ese proveedor se reúnen en descanso. Failover automático:{' '}
          <b style={{ color: '#22C55E' }}>{FAILOVER_ORDER.join(' → ')}</b>
        </div>
        {(['global', 'asia'] as const).map((h) => (
          <div key={h} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 'bold', letterSpacing: 1, color: h === 'global' ? '#60A5FA' : '#F472B6', marginBottom: 8, fontFamily: GB }}>
              {h === 'global' ? '🌍 HEMISFERIO GLOBAL' : '🌏 ECOSISTEMA CHINO'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
              {hemis(h).map((p) => (
                <div key={p.id} style={{ background: '#1E1E1E', border: '1px solid #333', borderLeft: `4px solid ${p.color}`, borderRadius: 8, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <b style={{ fontSize: 13, color: '#fff' }}>{p.name}</b>
                    <span style={{ fontSize: 10, color: keys[p.id] ? '#22C55E' : '#78716C' }}>{keys[p.id] ? '● configurado' : '○ sin llave'}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#A8A29E', marginBottom: 2 }}>{p.models}</div>
                  <div style={{ fontSize: 11, color: '#78716C', marginBottom: 8 }}>{p.use}</div>
                  <input
                    type="password"
                    placeholder={p.id === 'openai' ? 'sk-…' : p.id === 'anthropic' ? 'sk-ant-…' : 'api key…'}
                    value={keys[p.id] ?? ''}
                    onChange={(e) => save({ ...keys, [p.id]: e.target.value }, budget, escalation)}
                    onBlur={() => {
                      if ((keys[p.id] ?? '').trim().length > 3) onProviderSaved?.(p.id)
                    }}
                    style={{ width: '100%', boxSizing: 'border-box', background: '#111', border: '1px solid #333', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: '#fff' }}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 10, padding: 14, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', color: '#fff', marginBottom: 6 }}>📊 Gobernanza de tokens</div>
          <label style={{ fontSize: 11, color: '#A8A29E' }}>Techo diario del workspace</label>
          <input
            type="number"
            value={budget}
            onChange={(e) => save(keys, e.target.value, escalation)}
            style={{ width: '100%', boxSizing: 'border-box', background: '#111', border: '1px solid #333', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: '#fff', marginTop: 4 }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', color: '#fff', marginBottom: 6 }}>🚨 Escalación</div>
          <label style={{ fontSize: 11, color: '#A8A29E' }}>Si un proveedor falla o se excede cuota</label>
          <select
            value={escalation}
            onChange={(e) => save(keys, budget, e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', background: '#111', border: '1px solid #333', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: '#fff', marginTop: 4 }}
          >
            <option value="notify_user">notify_user — avisar al humano</option>
            <option value="auto_retry">auto_retry — reintentar con siguiente proveedor</option>
            <option value="fail">fail — detener la misión</option>
          </select>
        </div>
      </div>
    </div>
  )
}
