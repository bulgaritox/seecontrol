// Datos de producto: roster, matriz BYOK (paper Industrium), telemetría de fatiga.

export interface RosterAgent {
  character: string
  name: string
  role: string
  mention: string
  hair: string
  shirt: string
  cut: 'short' | 'long' | 'spiky'
  provider: string
  model: string
  desk: number // índice de escritorio 0-5 (6 = podio Boss, 7 = caminante, 8 = café)
}

export const ROSTER: RosterAgent[] = [
  { character: 'boss', name: 'Boss', role: 'Orquestador · Master AI', mention: '@boss', hair: '#5A3A1A', shirt: '#7A2EA0', cut: 'short', provider: 'openai', model: 'gpt-4o-mini', desk: 6 },
  { character: 'luna', name: 'Luna', role: 'Copywriter', mention: '@luna', hair: '#FF69B4', shirt: '#FF9EC7', cut: 'long', provider: 'anthropic', model: 'claude-3-5-sonnet', desk: 0 },
  { character: 'max', name: 'Max', role: 'Developer', mention: '@max', hair: '#1E3A5F', shirt: '#00BFFF', cut: 'spiky', provider: 'anthropic', model: 'claude-3-5-sonnet', desk: 1 },
  { character: 'pixel', name: 'Pixel', role: 'Designer', mention: '@pixel', hair: '#1F7A1F', shirt: '#32CD32', cut: 'long', provider: 'openai', model: 'gpt-4o-mini', desk: 2 },
  { character: 'data', name: 'Data', role: 'Data Analyst', mention: '@data', hair: '#0E5A5A', shirt: '#00FFFF', cut: 'short', provider: 'deepseek', model: 'deepseek-chat', desk: 3 },
  { character: 'scout', name: 'Scout', role: 'Researcher', mention: '@scout', hair: '#6B4A1A', shirt: '#FFD700', cut: 'spiky', provider: 'deepseek', model: 'deepseek-chat', desk: 7 },
  { character: 'layout', name: 'Layout', role: 'Layout Assistant', mention: '@layout', hair: '#5F3A10', shirt: '#FFA500', cut: 'short', provider: 'mistral', model: 'mistral-large', desk: 4 },
  { character: 'nex', name: 'Nex', role: 'Generalist · QA', mention: '@nex', hair: '#14532D', shirt: '#00FF7F', cut: 'short', provider: 'groq', model: 'llama-3.1-70b', desk: 5 },
]

export type FatigueLevel = 'optimo' | 'exhausto' | 'burnout'

export function fatigueOf(energy: number): FatigueLevel {
  if (energy >= 90) return 'burnout'
  if (energy >= 61) return 'exhausto'
  return 'optimo'
}

export const FATIGUE_META: Record<FatigueLevel, { label: string; color: string; desc: string }> = {
  optimo: { label: 'Óptimo', color: '#22C55E', desc: 'Velocidad máxima' },
  exhausto: { label: 'Exhausto', color: '#F59E0B', desc: 'Ahorro de verbosidad' },
  burnout: { label: 'Burnout', color: '#EF4444', desc: 'A sala de descanso' },
}

export interface ProviderInfo {
  id: string
  name: string
  models: string
  use: string
  hemisphere: 'global' | 'asia'
  color: string
}

export const PROVIDERS: ProviderInfo[] = [
  { id: 'openai', name: 'OpenAI', models: 'GPT-4o / o1', use: 'Razonamiento y planeación de la IA Directora', hemisphere: 'global', color: '#10A37F' },
  { id: 'anthropic', name: 'Anthropic', models: 'Claude 3.5 Sonnet', use: 'Código, redacción y documentos extensos', hemisphere: 'global', color: '#D97757' },
  { id: 'gemini', name: 'Google', models: 'Gemini 1.5 Pro', use: 'Multimodal masivo · contexto 2M tokens', hemisphere: 'global', color: '#4285F4' },
  { id: 'deepseek', name: 'DeepSeek', models: 'V3 / R1', use: 'Costo extremo-optimizado · auditoría y código', hemisphere: 'asia', color: '#7C3AED' },
  { id: 'qwen', name: 'Alibaba · Qwen', models: 'Qwen-2.5-72B', use: 'Multilingüe y datos estructurados', hemisphere: 'asia', color: '#FF6A00' },
  { id: 'yi', name: '01.AI · Yi', models: 'Yi-Large', use: 'Síntesis profunda y traducción contextual', hemisphere: 'asia', color: '#E11D48' },
  { id: 'mistral', name: 'Mistral', models: 'Mistral Large', use: 'Formato y documentos europeos', hemisphere: 'global', color: '#F59E0B' },
  { id: 'groq', name: 'Groq', models: 'Llama-3.1-70B', use: 'Inferencia ultra-rápida · QA', hemisphere: 'global', color: '#EF4444' },
]

export const FAILOVER_ORDER = ['anthropic', 'openai', 'deepseek', 'mistral', 'groq']

export const CHATTER: string[] = [
  'compilando módulo…',
  'revisando diff del PR…',
  'pasando tests en local…',
  'leyendo docs de la API…',
  'optimizando prompt…',
  'subiendo artefacto…',
  'analizando métricas…',
  'pidiendo revisión…',
]

export const ACTIVITY_TPL: Record<string, string[]> = {
  working: ['está {task}', 'avanzó al {n}% en {task}', 'consumió tokens en {task}'],
  thinking: ['está pensando: {task}', 'diseñando {task}'],
  completed: ['completó {task}', 'entregó {task} para revisión'],
  blocked: ['levantó bandera en {task}: necesita soporte', 'esperando revisión en {task}'],
  idle: ['quedó libre, tomando siguiente tarea', 'en espera de asignación'],
}
