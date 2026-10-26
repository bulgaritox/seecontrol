// Cliente HTTP + WebSocket para el backend SeeControl.

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000'

const TOKEN_KEY = 'sc_token'
const CRED_KEY = 'sc_creds'

export interface BackendAgent {
  id: string
  name: string
  role: string
  character_type: string
  status: string
  progress: number
  current_task?: string | null
  provider?: string | null
  model?: string | null
  skills: string[]
  is_active: boolean
}

export interface BackendTask {
  id: string
  title: string
  description: string
  priority: string
  status: string
  progress: number
  agent_id?: string | null
  provider?: string | null
  model?: string | null
  result?: string | null
}

export interface BackendMission {
  id: string
  title: string
  description: string
  difficulty: string
  reward: number
  status: string
}

export interface BackendSkill {
  id: string
  name: string
  category: string
  description: string
  instructions: string
  examples: string[]
  triggers: string[]
  tags: string[]
  version: string
  author: string
  is_active: boolean
  is_certified: boolean
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  const tok = getToken()
  if (tok) headers['Authorization'] = `Bearer ${tok}`
  let payload: string | undefined
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(`${API_URL}${path}`, { method, headers, body: payload })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export async function ensureAuth(): Promise<boolean> {
  const saved = localStorage.getItem(CRED_KEY)
  const creds = saved ? JSON.parse(saved) : { email: 'admin@seecontrol.io', password: 'admin123' }
  // Login OAuth2 (form)
  const form = new URLSearchParams({ username: creds.email, password: creds.password })
  try {
    const res = await fetch(`${API_URL}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    if (!res.ok) return false
    const data = await res.json()
    localStorage.setItem(TOKEN_KEY, data.access_token)
    return true
  } catch {
    return false
  }
}

export async function getHealth(): Promise<{ status: string; version: string; services: Record<string, string> } | null> {
  try {
    const res = await fetch(`${API_URL}/health`)
    if (!res.ok) return null
    return (await res.json()) as { status: string; version: string; services: Record<string, string> }
  } catch {
    return null
  }
}

export async function getAgents(): Promise<BackendAgent[]> {
  const data = await req<{ agents: BackendAgent[] }>('GET', '/api/agents/')
  return data.agents ?? []
}

export async function getTasks(): Promise<BackendTask[]> {
  try {
    const data = await req<{ tasks: BackendTask[] }>('GET', '/api/tasks/')
    return data.tasks ?? []
  } catch {
    return []
  }
}

export async function getMissions(): Promise<BackendMission[]> {
  try {
    const data = await req<{ missions: BackendMission[] }>('GET', '/api/missions/')
    return data.missions ?? []
  } catch {
    return []
  }
}

export async function createTask(
  title: string,
  description: string,
  priority = 'medium',
  provider?: string,
  model?: string,
): Promise<{ id: string }> {
  return req<{ id: string }>('POST', '/api/tasks/', { title, description, priority, provider, model })
}

export async function getSkills(): Promise<BackendSkill[]> {
  try {
    const data = await req<{ skills: BackendSkill[] }>('GET', '/api/skills/')
    return data.skills ?? []
  } catch {
    return []
  }
}

export interface AgentPatch {
  name?: string
  role?: string
  description?: string
  character_type?: string
  status?: string
  progress?: number
  skills?: string[]
  provider?: string
  model?: string
  temperature?: number
  current_task?: string | null
  is_active?: boolean
}

export async function updateAgent(id: string, patch: AgentPatch): Promise<void> {
  await req('PUT', `/api/agents/${id}`, patch)
}

export interface AgentMood {
  headline: string
  detail: string
  code: string
}

export interface PingResult {
  ok: boolean
  reply?: string
  tokens?: number
  provider?: string
  model?: string
  agent?: string
  mood?: AgentMood
}

export async function pingAgent(
  id: string,
  message?: string,
  maxTokens?: number,
  override?: { provider?: string; model?: string },
): Promise<PingResult> {
  return req<PingResult>('POST', `/api/agents/${id}/ping`, {
    message: message ?? 'Responde solo: OK',
    max_tokens: maxTokens ?? 15,
    provider: override?.provider,
    model: override?.model,
  })
}

// ============================================
// ORQUESTACIÓN: boss delega la generación de código a pixel/max
// ============================================

export interface OrchestrateStep {
  agent: string
  role: string
  provider: string
  model: string
  tokens: number
}

export interface OrchestrateResult {
  ok: boolean
  final?: string
  html?: string
  css?: string
  js?: string
  steps?: OrchestrateStep[]
  subtask_ids?: string[]
  total_tokens?: number
  override?: boolean
  provider?: string
  model?: string
  error?: string
}

export async function orchestrateCode(
  request: string,
  override?: { provider?: string; model?: string },
): Promise<OrchestrateResult> {
  return req<OrchestrateResult>('POST', '/api/agents/orchestrate/code', {
    request,
    provider: override?.provider,
    model: override?.model,
  })
}

export interface ProviderCatalogEntry {
  id: string
  label: string
  enabled: boolean
  models: string[]
  note: string
  default_model: string | null
  api_url?: string
  is_custom?: boolean
}

export async function getProviders(): Promise<ProviderCatalogEntry[]> {
  try {
    const data = await req<{ providers: ProviderCatalogEntry[] }>('GET', '/api/agents/providers')
    return data.providers ?? []
  } catch {
    return []
  }
}

// ============================================
// CREDENCIALES DE PROVEEDORES (gestión desde la UI)
// ============================================

export interface Credential {
  id: string
  provider_id: string
  label: string
  api_key_masked: string
  is_active: boolean
  is_custom: boolean
  label_display: string | null
  api_url: string | null
  models: string[]
}

export async function getCredentials(): Promise<Credential[]> {
  try {
    const d = await req<{ credentials: Credential[] }>('GET', '/api/credentials/')
    return d.credentials ?? []
  } catch {
    return []
  }
}

export async function createCredential(body: {
  provider_id: string
  label: string
  api_key: string
  is_custom?: boolean
  label_display?: string
  api_url?: string
  models?: string[]
  make_active?: boolean
}): Promise<Credential> {
  return req<Credential>('POST', '/api/credentials/', body)
}

export async function updateCredential(id: string, body: {
  label?: string
  api_key?: string
  api_url?: string
  models?: string[]
  label_display?: string
}): Promise<Credential> {
  return req<Credential>('PUT', `/api/credentials/${id}`, body)
}

export async function activateCredential(id: string): Promise<void> {
  await req('POST', `/api/credentials/${id}/activate`, {})
}

export async function deleteCredential(id: string): Promise<void> {
  await req('DELETE', `/api/credentials/${id}`)
}

export interface TestResult {
  ok: boolean
  reply?: string
  tokens?: number
  provider?: string
  model?: string
  error?: string
}

export async function testCredential(body: {
  provider_id: string
  api_key?: string
  api_url?: string
  model: string
  message?: string
  is_custom?: boolean
}): Promise<TestResult> {
  return req<TestResult>('POST', '/api/credentials/test', body)
}

export interface UsageInfo {
  available: boolean
  note?: string
  provider?: string
  usage?: number
  limit?: number
  is_free_tier?: boolean
  label?: string
}

export async function getProviderUsage(providerId: string): Promise<UsageInfo> {
  try {
    return await req<UsageInfo>('GET', `/api/credentials/usage/${providerId}`)
  } catch {
    return { available: false, note: 'No disponible' }
  }
}

export async function createAgent(payload: Record<string, unknown>): Promise<void> {
  await req('POST', '/api/agents/', payload)
}

export async function deleteAgent(id: string): Promise<void> {
  await req('DELETE', `/api/agents/${id}`)
}

export async function postAgentStatus(agentId: string, status: string, progress?: number): Promise<void> {
  await req('POST', '/api/office/agent-status', { agent_id: agentId, status, progress })
}

export interface SkillPatch {
  name?: string
  description?: string
  category?: string
  instructions?: string
  examples?: string[]
  triggers?: string[]
  tags?: string[]
  version?: string
  author?: string
  is_active?: boolean
}

export async function updateSkill(id: string, patch: SkillPatch): Promise<void> {
  await req('PATCH', `/api/skills/${id}`, patch)
}

export async function createSkill(payload: Record<string, unknown>): Promise<void> {
  await req('POST', '/api/skills/', payload)
}

export async function deleteSkill(id: string): Promise<void> {
  await req('DELETE', `/api/skills/${id}`)
}

export interface TaskPatch {
  title?: string
  description?: string
  priority?: string
  status?: string
  progress?: number
  agent_id?: string | null
  provider?: string
  model?: string
  result?: string
  tokens_used?: number
}

export async function updateTask(id: string, patch: TaskPatch): Promise<void> {
  await req('PUT', `/api/tasks/${id}`, patch)
}

export function connectOfficeWS(onMessage: (msg: Record<string, unknown>) => void): () => void {
  try {
    const ws = new WebSocket(`${WS_URL}/ws/office`)
    ws.onmessage = (ev) => {
      try {
        onMessage(JSON.parse(ev.data) as Record<string, unknown>)
      } catch {
        /* noop */
      }
    }
    return () => {
      try {
        ws.close()
      } catch {
        /* noop */
      }
    }
  } catch {
    return () => undefined
  }
}

export { API_URL, WS_URL }
