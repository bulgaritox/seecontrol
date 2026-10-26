import { useState } from 'react'
import type { LiveDoc } from '../hooks/useLiveOffice'

interface Props {
  doc: LiveDoc
  onClose: () => void
  onFollowUp: (docId: string, text: string) => void
}

const GB = "'Press Start 2P', monospace"
const MONO = "ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace"

export function DocViewer({ doc, onClose, onFollowUp }: Props) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)

  const isCode = !!doc.code && /<html|<!doctype|function|const |=>|{|}/i.test(doc.code)

  const download = () => {
    const content = doc.code ?? doc.full
    const name = doc.filename ?? 'entregable.txt'
    const type = name.endsWith('.html') ? 'text/html' : 'text/plain'
    const blob = new Blob([content], { type: `${type};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(doc.code ?? doc.full)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* noop */
    }
  }

  const send = async () => {
    const clean = input.trim()
    if (!clean || sending) return
    setSending(true)
    setInput('')
    try {
      await onFollowUp(doc.id, clean)
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 65, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 620, maxWidth: '94vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: '#FDFBF4', color: '#1F2937', borderRadius: 12, border: '3px solid #F59E0B', overflow: 'hidden', fontFamily: MONO }}>
        <div style={{ padding: 14, borderBottom: '2px dashed #E5E0D5', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 28 }}>📄</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: GB, fontSize: 11, color: '#111' }}>{doc.title}</div>
            <div style={{ fontSize: 11, color: '#78716C', marginTop: 4 }}>
              {doc.agentName} · {doc.time} · pregunta: “{doc.question.slice(0, 90)}{doc.question.length > 90 ? '…' : ''}”
            </div>
          </div>
          {doc.code && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={copy} title="Copiar código" style={{ background: '#E7E2D5', color: '#111', border: '1px solid #D6D0BF', borderRadius: 6, cursor: 'pointer', padding: '4px 10px', fontSize: 11, fontFamily: MONO }}>
                {copied ? '✓ copiado' : '📋 copiar'}
              </button>
              <button onClick={download} title={`Descargar ${doc.filename}`} style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '4px 10px', fontSize: 11, fontFamily: MONO, fontWeight: 'bold' }}>
                ⬇ {doc.filename}
              </button>
            </div>
          )}
          <button onClick={onClose} style={{ background: '#111827', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '4px 10px' }}>✕</button>
        </div>
        {isCode ? (
          <div style={{ flex: 1, overflowY: 'auto', background: '#0F172A' }}>
            <pre style={{ margin: 0, padding: 16, fontSize: 12, lineHeight: 1.5, color: '#E2E8F0', fontFamily: MONO, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              <code>{doc.code}</code>
            </pre>
            {doc.artifacts && doc.artifacts.length > 0 && (
              <div style={{ padding: '10px 16px', borderTop: '1px solid #1E293B', color: '#94A3B8', fontSize: 11 }}>
                <div style={{ color: '#C7D2FE', marginBottom: 4 }}>📁 Artefactos del proyecto ({doc.workspaceDir}):</div>
                {doc.artifacts.map((a) => <div key={a}>• {a}</div>)}
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {doc.full}
          </div>
        )}
        <div style={{ padding: 12, borderTop: '2px dashed #E5E0D5', background: '#F5F0DF' }}>
          <div style={{ fontSize: 11, color: '#78716C', marginBottom: 6 }}>🧵 Continúa el hilo — se anexa a esta hoja:</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void send()
              }}
              placeholder="Ej. «y en consumo de memoria?»"
              style={{ flex: 1, border: '1px solid #D6D0BF', borderRadius: 8, padding: '8px 10px', fontSize: 12, background: '#fff', color: '#111', fontFamily: MONO }}
            />
            <button onClick={() => void send()} disabled={sending} style={{ background: '#111827', color: '#fff', border: 'none', borderRadius: 8, padding: '0 14px', cursor: 'pointer', fontWeight: 'bold' }}>
              {sending ? '…' : '↑'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
