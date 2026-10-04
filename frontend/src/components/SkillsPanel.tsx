import { useEffect, useMemo, useState } from 'react'
import { ensureAuth, getSkills, updateSkill, createSkill, deleteSkill, type BackendSkill } from '../api'
import type { LiveAgent } from '../hooks/useLiveOffice'

interface Props {
  agents: LiveAgent[]
  onAttachSkill: (agentId: string, skillName: string) => void
  refreshToken: number
  onChanged: () => void
}

const GB = "'Press Start 2P', monospace"
const MONO = "ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace"
const CATS = ['writing', 'image', 'video', 'research', 'data', 'code', 'general']
const CAT_COLOR: Record<string, string> = {
  writing: '#F472B6', image: '#A78BFA', video: '#F87171', research: '#38BDF8',
  data: '#22C55E', code: '#FBBF24', general: '#9CA3AF',
}

// Parsea un SKILL.md del estándar abierto Agent Skills (agentskills.io):
// frontmatter --- name: / description: --- + cuerpo como instrucciones.
export function parseSkillMd(raw: string, url: string): Record<string, unknown> | null {
  try {
    let front = ''
    let body = raw
    const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
    if (m) {
      front = m[1]
      body = m[2]
    }
    const meta: Record<string, string> = {}
    front.split('\n').forEach((line) => {
      const i = line.indexOf(':')
      if (i > 0) meta[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
    })
    const name = (meta.name || url.split('/').slice(-2, -1)[0] || 'skill-importada').replace(/[^A-Za-z0-9_.-]/g, '_')
    const blob = `${meta.description ?? ''}\n${body}`.toLowerCase()
    const guess =
      /test|tdd|commit|pr |código|code|review/.test(blob) ? 'code'
      : /seo|blog|writ|redact|copy/.test(blob) ? 'writing'
      : /sql|datos|data|migrat/.test(blob) ? 'data'
      : /imagen|image|pixel|diseño|design/.test(blob) ? 'image'
      : /search|research|investigar|benchmark/.test(blob) ? 'research'
      : /video/.test(blob) ? 'video' : 'general'
    return {
      name: name.startsWith('Skill_') ? name : `Skill_${name}`,
      description: meta.description || body.split('\n').find((l) => l.trim().length > 20)?.slice(0, 200) || 'Skill importada del estándar Agent Skills.',
      category: guess,
      instructions: body.trim().slice(0, 6000) || 'Ver fuente original.',
      author: 'AgentSkills-Import',
      author_id: 'import',
      triggers: [],
      tags: ['importada', 'agent-skills'],
    }
  } catch {
    return null
  }
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box' as const, background: '#111', border: '1px solid #333',
  borderRadius: 6, padding: '7px 9px', fontSize: 12, color: '#fff', fontFamily: MONO,
}

export function SkillsPanel({ agents, onAttachSkill, refreshToken, onChanged }: Props) {
  const [skills, setSkills] = useState<BackendSkill[]>([])
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('all')
  const [selected, setSelected] = useState<BackendSkill | null>(null)
  const [editing, setEditing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [attachFor, setAttachFor] = useState<string | null>(null)
  const [importUrl, setImportUrl] = useState('')
  const [importMsg, setImportMsg] = useState('')
  const [form, setForm] = useState({ name: '', description: '', category: 'general', instructions: '', examples: '', triggers: '', tags: '', version: '1.0.0', author: 'SeeControl', is_active: true })

  const load = async () => {
    await ensureAuth()
    setSkills(await getSkills())
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken])

  const filtered = useMemo(
    () => skills.filter((s) => (cat === 'all' || s.category === cat) && (`${s.name} ${s.description} ${(s.tags ?? []).join(' ')}`.toLowerCase().includes(q.toLowerCase()))),
    [skills, q, cat],
  )

  const openEdit = (s: BackendSkill) => {
    setSelected(s)
    setForm({
      name: s.name, description: s.description, category: s.category, instructions: s.instructions,
      examples: (s.examples ?? []).join('\n'), triggers: (s.triggers ?? []).join(', '),
      tags: (s.tags ?? []).join(', '), version: s.version, author: s.author, is_active: s.is_active,
    })
    setEditing(true)
    setCreating(false)
  }

  const openCreate = () => {
    setSelected(null)
    setForm({ name: '', description: '', category: 'general', instructions: '', examples: '', triggers: '', tags: '', version: '1.0.0', author: 'SeeControl', is_active: true })
    setImportUrl('')
    setImportMsg('')
    setCreating(true)
    setEditing(false)
  }

  const saveEdit = async () => {
    if (!selected) return
    await updateSkill(selected.id, {
      name: form.name, description: form.description, category: form.category,
      instructions: form.instructions, examples: form.examples.split('\n').map((x) => x.trim()).filter(Boolean),
      triggers: form.triggers.split(',').map((x) => x.trim()).filter(Boolean),
      tags: form.tags.split(',').map((x) => x.trim()).filter(Boolean),
      version: form.version, author: form.author, is_active: form.is_active,
    })
    setEditing(false)
    setSelected(null)
    await load()
    onChanged()
  }

  const saveCreate = async () => {
    await createSkill({
      name: form.name, description: form.description, category: form.category,
      instructions: form.instructions || 'Pendiente de documentar.',
      examples: form.examples.split('\n').map((x) => x.trim()).filter(Boolean),
      author: form.author || 'SeeControl', author_id: 'studio',
      triggers: form.triggers.split(',').map((x) => x.trim()).filter(Boolean),
      tags: form.tags.split(',').map((x) => x.trim()).filter(Boolean),
      version: form.version || '1.0.0', is_active: form.is_active,
    })
    setCreating(false)
    await load()
    onChanged()
  }

  const doImport = async () => {
    setImportMsg('⏳ descargando…')
    try {
      const res = await fetch(importUrl.trim())
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const parsed = parseSkillMd(await res.text(), importUrl.trim())
      if (!parsed) throw new Error('no se pudo parsear')
      setForm((f) => ({
        ...f,
        name: String(parsed.name ?? f.name),
        description: String(parsed.description ?? f.description),
        category: String(parsed.category ?? f.category),
        instructions: String(parsed.instructions ?? f.instructions),
        author: String(parsed.author ?? f.author),
        tags: ['importada', 'agent-skills'].join(', '),
      }))
      setImportMsg('✓ importado — revisa y guarda')
    } catch (e) {
      setImportMsg(`❌ ${e instanceof Error ? e.message : 'error'}`)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Buscar skills…" style={{ ...inputStyle, maxWidth: 260 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all', ...CATS].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              style={{ fontSize: 11, fontFamily: MONO, padding: '5px 10px', borderRadius: 12, cursor: 'pointer', border: cat === c ? '2px solid #22C55E' : '1px solid #333', background: cat === c ? '#052E16' : '#141414', color: cat === c ? '#22C55E' : '#A8A29E' }}
            >
              {c}
            </button>
          ))}
        </div>
        <button onClick={openCreate} style={{ marginLeft: 'auto', fontSize: 12, fontFamily: MONO, fontWeight: 'bold', background: '#22C55E', color: '#052E16', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>
          ＋ Nueva / Importar
        </button>
      </div>
      <div style={{ fontSize: 11, color: '#78716C', marginBottom: 10 }}>
        Catálogo compatible con el estándar abierto <b>Agent Skills</b> (SKILL.md) — el mismo que usan
        repos populares como <b>obra/superpowers</b> y <b>addyosmani/agent-skills</b>. {skills.length} skills instaladas.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
        {filtered.map((s) => (
          <div key={s.id} style={{ background: '#141414', border: '1px solid #2A2A2A', borderLeft: `4px solid ${CAT_COLOR[s.category] ?? '#9CA3AF'}`, borderRadius: 10, padding: 12, opacity: s.is_active ? 1 : 0.55 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <b style={{ fontSize: 13, color: '#fff' }}>{s.name}</b>
              <span style={{ fontSize: 10, color: s.is_certified ? '#22C55E' : '#78716C' }}>{s.is_certified ? '★ certificada' : `v${s.version}`}</span>
            </div>
            <div style={{ fontSize: 11, color: '#A8A29E', marginBottom: 8, minHeight: 28 }}>{s.description}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 10, background: '#262626', borderRadius: 8, padding: '2px 8px', color: CAT_COLOR[s.category] ?? '#fff' }}>{s.category}</span>
              {(s.triggers ?? []).slice(0, 3).map((t) => (
                <span key={t} style={{ fontSize: 10, background: '#1E1E1E', border: '1px solid #333', borderRadius: 8, padding: '2px 8px', color: '#78716C' }}>⚡{t}</span>
              ))}
              {(s.examples ?? []).length > 0 && <span style={{ fontSize: 10, color: '#57534E' }}>📝 {s.examples.length} ejemplos</span>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => openEdit(s)} style={{ flex: 1, fontSize: 11, fontFamily: MONO, background: '#262626', color: '#fff', border: '1px solid #333', borderRadius: 6, padding: '6px 0', cursor: 'pointer' }}>
                👁 Ver / ✏ Editar
              </button>
              <button onClick={() => setAttachFor(attachFor === s.id ? null : s.id)} style={{ flex: 1, fontSize: 11, fontFamily: MONO, background: '#052E16', color: '#22C55E', border: '1px solid #14532D', borderRadius: 6, padding: '6px 0', cursor: 'pointer' }}>
                ＋ Adjuntar
              </button>
            </div>
            {attachFor === s.id && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {agents.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      onAttachSkill(a.id, s.name)
                      setAttachFor(null)
                    }}
                    style={{ fontSize: 11, fontFamily: MONO, textAlign: 'left', background: '#111', color: '#D6D3D1', border: '1px solid #333', borderRadius: 6, padding: '5px 8px', cursor: 'pointer' }}
                  >
                    → {a.name} <span style={{ color: '#78716C' }}>({a.role})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {filtered.length === 0 && <div style={{ color: '#57534E', textAlign: 'center', padding: 24 }}>Sin resultados.</div>}

      {/* modal ver/editar/crear */}
      {(editing || creating) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => { setEditing(false); setCreating(false) }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 640, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', background: '#141414', border: '2px solid #333', borderRadius: 12, padding: 16, fontFamily: MONO }}>
            <div style={{ fontFamily: GB, fontSize: 11, color: '#fff', marginBottom: 10 }}>
              {creating ? '＋ NUEVA SKILL / IMPORTAR' : `✏ ${selected?.name}`}
            </div>
            {creating && (
              <div style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#A8A29E', marginBottom: 6 }}>
                  Importar SKILL.md por URL (p. ej. <span style={{ color: '#38BDF8' }}>https://raw.githubusercontent.com/…/SKILL.md</span> de obra/superpowers o addyosmani/agent-skills):
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://raw.githubusercontent.com/…" style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={doImport} style={{ fontSize: 11, fontFamily: MONO, background: '#1E3A8A', color: '#fff', border: 'none', borderRadius: 6, padding: '0 12px', cursor: 'pointer' }}>↓ Importar</button>
                </div>
                {importMsg && <div style={{ fontSize: 11, color: '#FBBF24', marginTop: 6 }}>{importMsg}</div>}
              </div>
            )}
            <label style={{ fontSize: 11, color: '#A8A29E' }}>Nombre</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ ...inputStyle, marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#A8A29E' }}>Categoría</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle}>
                  {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#A8A29E' }}>Versión</label>
                <input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#A8A29E' }}>Autor</label>
                <input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <label style={{ fontSize: 11, color: '#A8A29E' }}>Descripción (incluye “Úsala cuando…”)</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} style={{ ...inputStyle, marginBottom: 8, resize: 'vertical' }} />
            <label style={{ fontSize: 11, color: '#A8A29E' }}>Instrucciones (Overview → Proceso → Verificación)</label>
            <textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} rows={8} style={{ ...inputStyle, marginBottom: 8, resize: 'vertical', whiteSpace: 'pre-wrap' }} />
            <label style={{ fontSize: 11, color: '#A8A29E' }}>Ejemplos (uno por línea)</label>
            <textarea value={form.examples} onChange={(e) => setForm({ ...form, examples: e.target.value })} rows={3} style={{ ...inputStyle, marginBottom: 8, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#A8A29E' }}>Triggers (coma)</label>
                <input value={form.triggers} onChange={(e) => setForm({ ...form, triggers: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#A8A29E' }}>Tags (coma)</label>
                <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <label style={{ fontSize: 12, color: '#D6D3D1', display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}>
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Activa
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {editing && selected && (
                <button
                  onClick={async () => {
                    if (!window.confirm(`¿Eliminar ${selected.name}?`)) return
                    await deleteSkill(selected.id)
                    setEditing(false)
                    setSelected(null)
                    await load()
                    onChanged()
                  }}
                  style={{ fontSize: 12, fontFamily: MONO, background: '#450A0A', color: '#FCA5A5', border: '1px solid #7F1D1D', borderRadius: 8, padding: '9px 14px', cursor: 'pointer' }}
                >
                  🗑
                </button>
              )}
              <button onClick={() => { setEditing(false); setCreating(false) }} style={{ flex: 1, fontSize: 12, fontFamily: MONO, background: '#1E1E1E', color: '#A8A29E', border: '1px solid #333', borderRadius: 8, padding: 9, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={editing ? saveEdit : saveCreate} disabled={creating && !form.name.trim()} style={{ flex: 2, fontSize: 12, fontFamily: MONO, fontWeight: 'bold', background: '#22C55E', color: '#052E16', border: 'none', borderRadius: 8, padding: 9, cursor: 'pointer' }}>
                💾 Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
