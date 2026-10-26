import { useState } from 'react'
import { useProviders, modelsForProvider, refreshProviders } from '../hooks/useProviders'
import { testCredential, createCredential } from '../api'

const GB = "'Press Start 2P', monospace"
const MONO = "ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace"

const field = {
  width: '100%', boxSizing: 'border-box' as const, background: '#fff',
  border: '1px solid #D6D0BF', borderRadius: 6, padding: '7px 9px',
  fontSize: 12, color: '#111', fontFamily: MONO,
}

/**
 * Sidebar exclusivo de la ruta /proveedores. Dos pestañas:
 *  - Playground: probar modelos temporalmente (NO guarda historial).
 *  - Nuevo proveedor: dar de alta un proveedor custom (nombre + api_url + key),
 *    se valida con una llamada real y solo se guarda si responde.
 */
export function ProvidersSidebar({ onChanged }: { onChanged?: () => void }) {
  const [tab, setTab] = useState<'playground' | 'custom'>('playground')
  const { catalog } = useProviders()

  // --- Playground ---
  const [pgProvider, setPgProvider] = useState('groq')
  const [pgModel, setPgModel] = useState('')
  const [pgMsg, setPgMsg] = useState('Escribe un haiku sobre el código limpio.')
  const [pgBusy, setPgBusy] = useState(false)
  const [pgOut, setPgOut] = useState<{ ok: boolean; text: string; tokens?: number } | null>(null)
  const pgModels = modelsForProvider(catalog, pgProvider)
  const effModel = pgModels.includes(pgModel) ? pgModel : (pgModels[0] ?? '')

  const runPlayground = async () => {
    if (!effModel || pgBusy) return
    setPgBusy(true)
    setPgOut(null)
    try {
      const r = await testCredential({ provider_id: pgProvider, model: effModel, message: pgMsg })
      setPgOut({ ok: r.ok, text: r.ok ? (r.reply ?? '') : (r.error ?? 'Error'), tokens: r.tokens })
    } catch (e) {
      setPgOut({ ok: false, text: String(e) })
    } finally {
      setPgBusy(false)
    }
  }

  // --- Nuevo proveedor custom ---
  const [cName, setCName] = useState('')
  const [cUrl, setCUrl] = useState('')
  const [cKey, setCKey] = useState('')
  const [cModel, setCModel] = useState('')
  const [cBusy, setCBusy] = useState(false)
  const [cResult, setCResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [cTested, setCTested] = useState(false)

  const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const testCustom = async () => {
    if (!cName.trim() || !cUrl.trim() || !cKey.trim() || !cModel.trim() || cBusy) return
    setCBusy(true)
    setCResult(null)
    try {
      const r = await testCredential({
        provider_id: slug(cName), api_key: cKey.trim(), api_url: cUrl.trim(),
        model: cModel.trim(), is_custom: true, message: 'Responde solo: OK',
      })
      setCResult({ ok: r.ok, text: r.ok ? (r.reply ?? 'OK') : (r.error ?? 'Error') })
      setCTested(r.ok)
    } catch (e) {
      setCResult({ ok: false, text: String(e) })
      setCTested(false)
    } finally {
      setCBusy(false)
    }
  }

  const saveCustom = async () => {
    if (!cTested) return
    await createCredential({
      provider_id: slug(cName), label: `${cName.trim()} key`, api_key: cKey.trim(),
      is_custom: true, label_display: cName.trim(), api_url: cUrl.trim(),
      models: [cModel.trim()], make_active: true,
    })
    await refreshProviders()
    onChanged?.()
    setCName(''); setCUrl(''); setCKey(''); setCModel(''); setCResult(null); setCTested(false)
  }

  return (
    <div style={{ background: '#F5F2EA', borderRadius: 12, border: '2px solid #2A2A2A', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 560, overflow: 'hidden', color: '#1F2937', fontFamily: MONO }}>
      <div style={{ display: 'flex', gap: 6, padding: 10, borderBottom: '1px solid #E5E0D5' }}>
        {([['playground', '🧪 PLAYGROUND'], ['custom', '➕ PROVEEDOR']] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 9, fontFamily: GB, background: tab === t ? '#111827' : '#E7E2D5', color: tab === t ? '#fff' : '#57534E' }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'playground' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: '#78716C' }}>
            Prueba un modelo al vuelo. <b>No se guarda</b> en el historial de agentes.
          </div>
          <label style={{ fontSize: 11, color: '#57534E' }}>Proveedor</label>
          <select value={pgProvider} onChange={(e) => { setPgProvider(e.target.value); setPgModel('') }} style={field}>
            {catalog.filter((p) => p.enabled).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <label style={{ fontSize: 11, color: '#57534E' }}>Modelo</label>
          <select value={effModel} onChange={(e) => setPgModel(e.target.value)} style={field}>
            {pgModels.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <label style={{ fontSize: 11, color: '#57534E' }}>Mensaje</label>
          <textarea value={pgMsg} onChange={(e) => setPgMsg(e.target.value)} rows={3} style={{ ...field, resize: 'vertical' }} />
          <button
            onClick={runPlayground}
            disabled={pgBusy || !effModel}
            style={{ background: '#111827', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 0', cursor: pgBusy ? 'wait' : 'pointer', fontWeight: 'bold', fontFamily: MONO, fontSize: 12, opacity: effModel ? 1 : 0.5 }}
          >
            {pgBusy ? 'Probando…' : '▶ Ejecutar prueba'}
          </button>
          {pgOut && (
            <div style={{ background: pgOut.ok ? '#052E16' : '#450A0A', border: `1px solid ${pgOut.ok ? '#14532D' : '#7F1D1D'}`, borderRadius: 8, padding: 10, marginTop: 4 }}>
              <div style={{ fontSize: 10, color: pgOut.ok ? '#22C55E' : '#FCA5A5', marginBottom: 4 }}>
                {pgOut.ok ? `✓ respuesta${pgOut.tokens != null ? ` · ${pgOut.tokens} tok` : ''}` : '✕ error'}
              </div>
              <div style={{ fontSize: 12, color: pgOut.ok ? '#D1FAE5' : '#FECACA', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflowY: 'auto' }}>
                {pgOut.text}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: '#78716C' }}>
            Da de alta un proveedor OpenAI-compatible. Se prueba antes de guardar; solo si
            responde se agrega a Modelos integrados y Soberanía.
          </div>
          <label style={{ fontSize: 11, color: '#57534E' }}>Nombre</label>
          <input value={cName} onChange={(e) => { setCName(e.target.value); setCTested(false) }} placeholder="Ej. Together AI" style={field} />
          <label style={{ fontSize: 11, color: '#57534E' }}>API URL base</label>
          <input value={cUrl} onChange={(e) => { setCUrl(e.target.value); setCTested(false) }} placeholder="https://api.together.xyz" style={field} />
          <div style={{ fontSize: 10, color: '#A8A29E' }}>Se llamará a <code>{'{url}'}/v1/chat/completions</code></div>
          <label style={{ fontSize: 11, color: '#57534E' }}>API key</label>
          <input value={cKey} onChange={(e) => { setCKey(e.target.value); setCTested(false) }} type="password" placeholder="sk-…" style={field} />
          <label style={{ fontSize: 11, color: '#57534E' }}>Modelo de prueba</label>
          <input value={cModel} onChange={(e) => { setCModel(e.target.value); setCTested(false) }} placeholder="model-id" style={field} />
          <button
            onClick={testCustom}
            disabled={cBusy || !cName.trim() || !cUrl.trim() || !cKey.trim() || !cModel.trim()}
            style={{ background: '#1E3A8A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 0', cursor: cBusy ? 'wait' : 'pointer', fontWeight: 'bold', fontFamily: MONO, fontSize: 12 }}
          >
            {cBusy ? 'Probando…' : '⚡ Probar conexión'}
          </button>
          {cResult && (
            <div style={{ background: cResult.ok ? '#052E16' : '#450A0A', border: `1px solid ${cResult.ok ? '#14532D' : '#7F1D1D'}`, borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 12, color: cResult.ok ? '#D1FAE5' : '#FECACA', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {cResult.ok ? `✓ ${cResult.text}` : `✕ ${cResult.text}`}
              </div>
            </div>
          )}
          <button
            onClick={saveCustom}
            disabled={!cTested}
            title={cTested ? 'Guardar proveedor' : 'Primero prueba la conexión'}
            style={{ background: cTested ? '#22C55E' : '#1E1E1E', color: cTested ? '#052E16' : '#57534E', border: 'none', borderRadius: 8, padding: '10px 0', cursor: cTested ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontFamily: MONO, fontSize: 12 }}
          >
            💾 Guardar proveedor
          </button>
        </div>
      )}
    </div>
  )
}
