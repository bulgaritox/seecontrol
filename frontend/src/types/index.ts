// Tipos principales de SeeControl

// ============================================
// TIPOS DE AUTENTICACIÓN
// ============================================

export type UserRole = 'owner' | 'admin' | 'viewer'

export interface User {
  id: string
  email: string
  workspace_name: string
  role: UserRole
  api_key?: string
  provider?: string
  custom_endpoint?: string
  default_model?: string
  created_at: string
  updated_at: string
}

export interface UserCreate {
  email: string
  password: string
  workspace_name: string
  role?: UserRole
  api_key?: string
  provider?: string
  custom_endpoint?: string
  default_model?: string
}

export interface UserLogin {
  email: string
  password: string
}

export interface AuthResponse {
  user: User
  access_token: string
  refresh_token: string
  token_type: string
}

// ============================================
// TIPOS DE AGENTES
// ============================================

export type AgentStatus = 
  | 'idle' 
  | 'working' 
  | 'progress' 
  | 'blocked' 
  | 'completed' 
  | 'failed' 
  | 'paused'
  | 'thinking'

export interface Agent {
  id: string
  name: string
  role: string
  character_type: string
  status: AgentStatus
  progress: number
  current_task?: string
  skills: string[]
  tools: string[]
  memory?: string
  model?: string
  provider?: string
  created_at: string
  updated_at: string
  workspace_id: string
}

export interface AgentCreate {
  name: string
  role: string
  character_type?: string
  status?: AgentStatus
  progress?: number
  current_task?: string
  skills?: string[]
  tools?: string[]
  memory?: string
  model?: string
  provider?: string
}

export interface AgentUpdate {
  name?: string
  role?: string
  character_type?: string
  status?: AgentStatus
  progress?: number
  current_task?: string
  skills?: string[]
  tools?: string[]
  memory?: string
  model?: string
  provider?: string
}

// ============================================
// TIPOS DE SKILLS
// ============================================

export type SkillCategory = 
  | 'writing' 
  | 'image' 
  | 'video' 
  | 'research' 
  | 'data' 
  | 'code' 
  | 'general'

export interface Skill {
  id: string
  name: string
  description: string
  category: SkillCategory
  instructions: string
  examples?: string[]
  version: string
  author: string
  triggers?: string[]
  dependencies?: string[]
  marketplace?: boolean
  price?: number
  rating?: number
  created_at: string
  updated_at: string
}

export interface SkillCreate {
  name: string
  description: string
  category: SkillCategory
  instructions: string
  examples?: string[]
  version?: string
  triggers?: string[]
  dependencies?: string[]
}

// ============================================
// TIPOS DE TAREAS
// ============================================

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type TaskStatus = 
  | 'pending' 
  | 'in_progress' 
  | 'completed' 
  | 'failed' 
  | 'blocked' 
  | 'paused'

export interface Task {
  id: string
  title: string
  description: string
  priority: TaskPriority
  status: TaskStatus
  progress: number
  agent_id?: string
  agent?: Agent
  dependencies?: string[]
  created_at: string
  updated_at: string
  completed_at?: string
  workspace_id: string
}

export interface TaskCreate {
  title: string
  description: string
  priority?: TaskPriority
  agent_id?: string
  dependencies?: string[]
}

export interface TaskUpdate {
  title?: string
  description?: string
  priority?: TaskPriority
  status?: TaskStatus
  progress?: number
  agent_id?: string
  dependencies?: string[]
}

// ============================================
// TIPOS DE MISIONES
// ============================================

export type MissionDifficulty = 'easy' | 'medium' | 'hard'

export type MissionStatus = 
  | 'open' 
  | 'in_progress' 
  | 'delivered' 
  | 'completed' 
  | 'failed'

export interface Mission {
  id: string
  title: string
  description: string
  difficulty: MissionDifficulty
  reward: number
  deadline?: string
  required_skills: string[]
  status: MissionStatus
  agent_team?: string[]
  created_at: string
  updated_at: string
  workspace_id: string
}

export interface MissionCreate {
  title: string
  description: string
  difficulty: MissionDifficulty
  reward: number
  deadline?: string
  required_skills: string[]
}

// ============================================
// TIPOS DE WORKSPACE
// ============================================

export type WorkspacePlan = 'free' | 'startup' | 'growth' | 'enterprise'

export interface Workspace {
  id: string
  name: string
  plan: WorkspacePlan
  credits: number
  max_agents: number
  max_tasks: number
  max_automations: number
  max_workflows: number
  theme: string
  settings: WorkspaceSettings
  created_at: string
  updated_at: string
}

export interface WorkspaceSettings {
  default_model?: string
  default_provider?: string
  max_parallel_agents?: number
  token_budget?: number
  escalation_policy?: string
  heartbeat_interval?: number
  memory_scope?: string
  max_task_runtime?: number
  web_research_limit?: number
  file_analysis_limit?: number
}

// ============================================
// TIPOS DE TOKEN USAGE
// ============================================

export interface TokenUsage {
  id: string
  workspace_id: string
  agent_id?: string
  model: string
  provider: string
  tokens_used: number
  cost: number
  task_id?: string
  created_at: string
}

// ============================================
// TIPOS DE WEBSOCKET
// ============================================

export type WebSocketEventType = 
  | 'agent.started' 
  | 'agent.thinking' 
  | 'agent.blocked' 
  | 'agent.completed' 
  | 'agent.failed' 
  | 'progress.update' 
  | 'token.threshold' 
  | 'task.created' 
  | 'task.updated' 
  | 'mission.created' 
  | 'mission.updated'

export interface WebSocketEvent {
  type: WebSocketEventType
  data: any
  timestamp: string
  agent_id?: string
  task_id?: string
}

export interface OfficeState {
  agents: Agent[]
  tasks: Task[]
  theme: string
  layout: any
  last_updated: string
}

// ============================================
// TIPOS DE API RESPONSE
// ============================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// ============================================
// TIPOS DE CONFIGURACIÓN
// ============================================

export interface AppConfig {
  app_name: string
  app_version: string
  app_env: string
  app_debug: boolean
  api_url: string
  ws_url: string
}

export interface LLMConfig {
  default_provider: string
  providers: Record<string, {
    api_key?: string
    api_url?: string
    timeout?: number
  }>
}

// ============================================
// EXPORTS DE PIXEL ART
// ============================================

export * from './pixel-art'
