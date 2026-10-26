import { useCallback, useEffect, useState } from 'react'
import { useProviders, refreshProviders } from '../hooks/useProviders'
import {
  ensureAuth,
  getCredentials, createCredential, updateCredential, activateCredential, deleteCredential,
  getProviderUsage, type Credential, type ProviderCatalogEntry, type UsageInfo,
} from '../api'

const GB = "'Press Start 2P', monospace"
const MONO = "ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace"

function loadPrefs(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem('sc_model_prefs') ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

export function ProvidersPanel({ onProviderSaved, refreshToken }: { onProviderSaved?: (id: string) => void; refreshToken?: number }) {
  const [budget, setBudget] = useState('50000')
  const [escalation, setEscalation] = useState('notify_user')
  const { catalog, reload } = useProviders()
  const [prefs, setPrefs] = useState<Record<string, string>>(loadPrefs)
  const [creds, setCreds] = useState<Credential[]>([])

  const setPref = (providerId: string, model: string) => {
    const next = { ...prefs, [providerId]: model }
    setPrefs(next)
    try {
      localStorage.setItem('sc_model_prefs', JSON.stringify(next))
    } catch {
      /* noop */
    }
  }

  const reloadCreds = useCallback(async () => {
    await ensureAuth()
    setCreds(await getCredentials())
  }, [])

  useEffect(() => {
    void reloadCreds()
    try {
      const saved = JSON.parse(localStorage.getItem('sc_byok') ?? '{}') as { budget?: string; escalation?: string }
      setBudget(saved.budget ?? '50000')
      setEscalation(saved.escalation ?? 'notify_user')
    } catch {
      /* noop */
    }
  }, [reloadCreds, refreshToken])

  const saveGov = (b: string, e: string) => {
    setBudget(b)
    setEscalation(e)
    localStorage.setItem('sc_byok', JSON.stringify({ budget: b, escalation: e }))
  }

  const onCredsChanged = async (pid?: string) => {
    await reloadCreds()
    await refreshProviders()
    reload()
    if (pid) onProviderSaved?.(pid)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 10, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', color: '#fff', fontFamily: GB }}>
            🧩 PROVEEDORES, CREDENCIALES Y MODELOS
          </div>
          <button
            onClick={() => { reload(); void reloadCreds() }}
            style={{ fontSize: 11, fontFamily: MONO, background: '#1E1E1E', color: '#A8A29E', border: '1px solid #333', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
          >
            ↻ Recargar
          </button>
        </div>
        <div style={{ fontSize: 12, color: '#A8A29E', marginBottom: 12 }}>
          Gestiona tus API keys por proveedor (varias con nombre, una activa), su consumo cuando
          el proveedor lo expone, y los modelos permitidos. <b style={{ color: '#22C55E' }}>✓ activo</b> =
          hay una key válida. Las keys del <code>.env</code> aparecen como primera capa y quedan de respaldo.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
          {catalog.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              creds={creds.filter((c) => c.provider_id === p.id)}
              prefModel={prefs[p.id] ?? p.default_model ?? ''}
              onPrefModel={(m) => setPref(p.id, m)}
              onChanged={() => onCredsChanged(p.id)}
            />
          ))}
        </div>
      </div>

      <div style={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 10, padding: 14, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', color: '#fff', marginBottom: 6 }}>📊 Gobernanza de tokens</div>
          <label style={{ fontSize: 11, color: '#A8A29E' }}>Techo diario del workspace</label>
          <input
            type="number"
            value={budget}
            onChange={(e) => saveGov(e.target.value, escalation)}
            style={{ width: '100%', boxSizing: 'border-box', background: '#111', border: '1px solid #333', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: '#fff', marginTop: 4 }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', color: '#fff', marginBottom: 6 }}>🚨 Escalación</div>
          <label style={{ fontSize: 11, color: '#A8A29E' }}>Si un proveedor falla o se excede cuota</label>
          <select
            value={escalation}
            onChange={(e) => saveGov(budget, e.target.value)}
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

// ============================================
// Card de un proveedor: credenciales + modelos + uso
// ============================================

function ProviderCard({
  provider, creds, prefModel, onPrefModel, onChanged,
}: {
  provider: ProviderCatalogEntry
  creds: Credential[]
  prefModel: string
  onPrefModel: (m: string) => void
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newKey, setNewKey] = useState('')
  const [newModel, setNewModel] = useState('')
  const [busy, setBusy] = useState(false)

  const loadUsage = useCallback(async () => {
    setUsage(await getProviderUsage(provider.id))
  }, [provider.id])

  useEffect(() => {
    if (open && !usage) void loadUsage()
  }, [open, usage, loadUsage])

  const addKey = async () => {
    if (!newKey.trim() || busy) return
    setBusy(true)
    try {
      await createCredential({
        provider_id: provider.id, label: newLabel.trim() || 'key', api_key: newKey.trim(),
        is_custom: provider.is_custom, label_display: provider.is_custom ? provider.label : undefined,
        api_url: provider.is_custom ? provider.api_url ?? undefined : undefined, make_active: creds.length === 0,
      })
      setNewLabel(''); setNewKey('')
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const addModel = async () => {
    const m = newModel.trim()
    if (!m || provider.models.includes(m)) { setNewModel(''); return }
    // guardar modelos en la credencial activa (o la primera)
    const target = creds.find((c) => c.is_active) ?? creds[0]
    if (!target) return
    await updateCredential(target.id, { models: [...provider.models, m] })
    setNewModel('')
    onChanged()
  }

  const removeModel = async (m: string) => {
    const target = creds.find((c) => c.is_active) ?? creds[0]
    if (!target) return
    await updateCredential(target.id, { models: provider.models.filter((x) => x !== m) })
    onChanged()
  }

  const chipInput = {
    background: '#111', border: '1px solid #333', borderRadius: 6, padding: '5px 8px',
    fontSize: 11, color: '#fff', fontFamily: MONO,
  }

  return (
    <div style={{ background: '#1E1E1E', border: '1px solid #333', borderLeft: `4px solid ${provider.enabled ? '#22C55E' : '#44403C'}`, borderRadius: 8, padding: 11 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <b style={{ fontSize: 13, color: '#fff' }}>{provider.label}{provider.is_custom && <span style={{ fontSize: 9, color: '#A78BFA' }}> · custom</span>}</b>
        <span style={{ fontSize: 10, color: provider.enabled ? '#22C55E' : '#78716C' }}>{provider.enabled ? '✓ activo' : '○ sin key'}</span>
      </div>
      {provider.note && <div style={{ fontSize: 10, color: '#F59E0B', marginBottom: 6 }}>⚠ {provider.note}</div>}

      {/* modelo por defecto + chips editables */}
      <div style={{ fontSize: 10, color: '#78716C', margin: '6px 0 3px' }}>Modelo por defecto:</div>
      <select
        value={prefModel}
        onChange={(e) => onPrefModel(e.target.value)}
        disabled={provider.models.length === 0}
        style={{ width: '100%', boxSizing: 'border-box', background: '#111', border: '1px solid #333', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: '#fff', fontFamily: MONO, marginBottom: 6 }}
      >
        {provider.models.length === 0 && <option value="">(sin modelos)</option>}
        {provider.models.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {provider.models.map((m) => (
          <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: MONO, padding: '2px 6px', borderRadius: 10, border: prefModel === m ? '1px solid #22C55E' : '1px solid #333', background: prefModel === m ? '#052E16' : '#111', color: prefModel === m ? '#22C55E' : '#A8A29E' }}>
            {m}
            <button onClick={() => removeModel(m)} title="Quitar modelo" style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 11, padding: 0, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <input value={newModel} onChange={(e) => setNewModel(e.target.value)} placeholder="+ agregar model-id…" style={{ ...chipInput, flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter') void addModel() }} />
        <button onClick={addModel} style={{ background: '#262626', color: '#fff', border: '1px solid #333', borderRadius: 6, cursor: 'pointer', padding: '0 10px' }}>+</button>
      </div>

      {/* toggle gestión de credenciales */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ width: '100%', background: '#111827', color: '#fff', border: '1px solid #333', borderRadius: 6, padding: '6px 0', cursor: 'pointer', fontSize: 11, fontFamily: MONO }}
      >
        {open ? '▲ Ocultar credenciales' : `🔑 Credenciales (${creds.length})`}
      </button>

      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* uso / créditos */}
          {usage && (
            <div style={{ fontSize: 11, color: usage.available ? '#22C55E' : '#78716C', background: '#111', borderRadius: 6, padding: '6px 8px' }}>
              {usage.available
                ? <>📈 Uso: <b>{usage.label}</b>{usage.is_free_tier ? ' · free tier' : ''}</>
                : <>ℹ️ {usage.note}</>}
            </div>
          )}
          {/* lista de keys */}
          {creds.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#111', borderRadius: 6, padding: '6px 8px', border: c.is_active ? '1px solid #22C55E' : '1px solid #2A2A2A' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12, color: '#fff', fontWeight: 'bold' }}>{c.label}</span>
                <span style={{ fontSize: 10, color: '#78716C', marginLeft: 6, fontFamily: MONO }}>{c.api_key_masked}</span>
              </span>
              {c.is_active
                ? <span style={{ fontSize: 9, color: '#22C55E' }}>★ activa</span>
                : <button onClick={async () => { await activateCredential(c.id); onChanged() }} title="Usar esta key" style={{ fontSize: 9, background: '#1E1E1E', color: '#A8A29E', border: '1px solid #333', borderRadius: 5, cursor: 'pointer', padding: '2px 6px' }}>usar</button>}
              <button onClick={async () => { await deleteCredential(c.id); onChanged() }} title="Eliminar key" style={{ fontSize: 11, background: 'transparent', color: '#EF4444', border: 'none', cursor: 'pointer' }}>🗑</button>
            </div>
          ))}
          {creds.length === 0 && <div style={{ fontSize: 10, color: '#78716C' }}>Sin credenciales. Agrega una:</div>}
          {/* alta de nueva key */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px dashed #2A2A2A', paddingTop: 6 }}>
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="nombre/etiqueta (ej. granredy)" style={chipInput} />
            <div style={{ display: 'flex', gap: 4 }}>
              <input value={newKey} onChange={(e) => setNewKey(e.target.value)} type="password" placeholder="nueva API key…" style={{ ...chipInput, flex: 1 }} />
              <button onClick={addKey} disabled={busy || !newKey.trim()} style={{ background: '#22C55E', color: '#052E16', border: 'none', borderRadius: 6, cursor: busy ? 'wait' : 'pointer', padding: '0 12px', fontWeight: 'bold', opacity: newKey.trim() ? 1 : 0.5 }}>+</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
