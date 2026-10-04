// Tipos para Pixel Art y Oficinas Virtuales

// ============================================
// TIPOS DE PERSONAJES
// ============================================

/**
 * Tipos de personajes disponibles
 */
export type CharacterType = 
  | 'luna'      // Copywriter Creativa
  | 'max'       // Desarrollador Lógico
  | 'pixel'     // Diseñador Visual
  | 'data'      // Analista de Datos
  | 'scout'     // Investigador
  | 'layout'    // Organizador
  | 'boss'      // Orquestador (Master AI)
  | 'nex'       // Multipropósito
  | 'custom'    // Personalizado

/**
 * Información de un personaje
 */
export interface CharacterInfo {
  id: CharacterType
  name: string
  role: string
  description: string
  personality: string
  skills: string[]
  sprite: {
    idle: string
    working: string
    thinking: string
    blocked: string
    completed: string
    failed: string
  }
  colors: {
    primary: string
    secondary: string
    background: string
  }
  size: { width: number; height: number }
}

/**
 * Catálogo completo de personajes
 */
export const CHARACTERS: Record<CharacterType, CharacterInfo> = {
  luna: {
    id: 'luna',
    name: 'Luna',
    role: 'Copywriter',
    description: 'Especialista en contenido creativo y redacción',
    personality: 'Creativa, entusiasta, siempre con ideas frescas',
    skills: ['writing', 'copywriting', 'content_creation', 'seo', 'editing'],
    sprite: {
      idle: '/assets/pixel-art/characters/luna/idle.png',
      working: '/assets/pixel-art/characters/luna/working.png',
      thinking: '/assets/pixel-art/characters/luna/thinking.png',
      blocked: '/assets/pixel-art/characters/luna/blocked.png',
      completed: '/assets/pixel-art/characters/luna/completed.png',
      failed: '/assets/pixel-art/characters/luna/failed.png',
    },
    colors: {
      primary: '#FF69B4',  // Rosa
      secondary: '#FFFFFF', // Blanco
      background: '#000000', // Negro
    },
    size: { width: 16, height: 32 },
  },
  
  max: {
    id: 'max',
    name: 'Max',
    role: 'Developer',
    description: 'Programador y solucionador de problemas técnicos',
    personality: 'Analítico, metódico, obsesionado con la eficiencia',
    skills: ['coding', 'debugging', 'algorithm_design', 'system_architecture', 'testing'],
    sprite: {
      idle: '/assets/pixel-art/characters/max/idle.png',
      working: '/assets/pixel-art/characters/max/working.png',
      thinking: '/assets/pixel-art/characters/max/thinking.png',
      blocked: '/assets/pixel-art/characters/max/blocked.png',
      completed: '/assets/pixel-art/characters/max/completed.png',
      failed: '/assets/pixel-art/characters/max/failed.png',
    },
    colors: {
      primary: '#00BFFF',  // Azul
      secondary: '#FFFF00', // Amarillo
      background: '#000000', // Negro
    },
    size: { width: 16, height: 32 },
  },
  
  pixel: {
    id: 'pixel',
    name: 'Pixel',
    role: 'Designer',
    description: 'Generador de imágenes y arte digital',
    personality: 'Artístico, perfeccionista, siempre con un ojo para el detalle',
    skills: ['image_generation', 'graphic_design', 'visual_editing', 'color_theory', 'ui_design'],
    sprite: {
      idle: '/assets/pixel-art/characters/pixel/idle.png',
      working: '/assets/pixel-art/characters/pixel/working.png',
      thinking: '/assets/pixel-art/characters/pixel/thinking.png',
      blocked: '/assets/pixel-art/characters/pixel/blocked.png',
      completed: '/assets/pixel-art/characters/pixel/completed.png',
      failed: '/assets/pixel-art/characters/pixel/failed.png',
    },
    colors: {
      primary: '#32CD32',  // Verde
      secondary: '#8A2BE2', // Morado
      background: '#000000', // Negro
    },
    size: { width: 16, height: 32 },
  },
  
  data: {
    id: 'data',
    name: 'Data',
    role: 'Data Analyst',
    description: 'Especialista en análisis de datos y métricas',
    personality: 'Preciso, lógico, amante de los números',
    skills: ['data_analysis', 'statistics', 'visualization', 'reporting', 'insights'],
    sprite: {
      idle: '/assets/pixel-art/characters/data/idle.png',
      working: '/assets/pixel-art/characters/data/working.png',
      thinking: '/assets/pixel-art/characters/data/thinking.png',
      blocked: '/assets/pixel-art/characters/data/blocked.png',
      completed: '/assets/pixel-art/characters/data/completed.png',
      failed: '/assets/pixel-art/characters/data/failed.png',
    },
    colors: {
      primary: '#00FFFF',  // Cyan
      secondary: '#FF0000', // Rojo
      background: '#000000', // Negro
    },
    size: { width: 16, height: 32 },
  },
  
  scout: {
    id: 'scout',
    name: 'Scout',
    role: 'Researcher',
    description: 'Buscador de información y conocimiento',
    personality: 'Curioso, persistente, siempre en búsqueda',
    skills: ['research', 'web_search', 'information_gathering', 'fact_checking', 'summarization'],
    sprite: {
      idle: '/assets/pixel-art/characters/scout/idle.png',
      working: '/assets/pixel-art/characters/scout/working.png',
      thinking: '/assets/pixel-art/characters/scout/thinking.png',
      blocked: '/assets/pixel-art/characters/scout/blocked.png',
      completed: '/assets/pixel-art/characters/scout/completed.png',
      failed: '/assets/pixel-art/characters/scout/failed.png',
    },
    colors: {
      primary: '#FFD700',  // Dorado
      secondary: '#8B4513', // Marrón
      background: '#000000', // Negro
    },
    size: { width: 16, height: 32 },
  },
  
  layout: {
    id: 'layout',
    name: 'Layout',
    role: 'Layout Assistant',
    description: 'Asistente de diseño y organización visual',
    personality: 'Ordenado, eficiente, amante de la estructura',
    skills: ['layout_design', 'organization', 'visual_structure', 'grid_systems', 'typography'],
    sprite: {
      idle: '/assets/pixel-art/characters/layout/idle.png',
      working: '/assets/pixel-art/characters/layout/working.png',
      thinking: '/assets/pixel-art/characters/layout/thinking.png',
      blocked: '/assets/pixel-art/characters/layout/blocked.png',
      completed: '/assets/pixel-art/characters/layout/completed.png',
      failed: '/assets/pixel-art/characters/layout/failed.png',
    },
    colors: {
      primary: '#FFA500',  // Naranja
      secondary: '#1E90FF', // Azul
      background: '#000000', // Negro
    },
    size: { width: 16, height: 32 },
  },
  
  boss: {
    id: 'boss',
    name: 'Boss',
    role: 'Orchestrator',
    description: 'Jefe que coordina a todos los agentes',
    personality: 'Estratégico, sabio, siempre un paso adelante',
    skills: ['orchestration', 'strategy', 'management', 'coordination', 'planning'],
    sprite: {
      idle: '/assets/pixel-art/characters/boss/idle.png',
      working: '/assets/pixel-art/characters/boss/working.png',
      thinking: '/assets/pixel-art/characters/boss/thinking.png',
      blocked: '/assets/pixel-art/characters/boss/blocked.png',
      completed: '/assets/pixel-art/characters/boss/completed.png',
      failed: '/assets/pixel-art/characters/boss/failed.png',
    },
    colors: {
      primary: '#FFD700',  // Dorado
      secondary: '#800080', // Púrpura
      background: '#000000', // Negro
    },
    size: { width: 24, height: 32 }, // Más grande
  },
  
  nex: {
    id: 'nex',
    name: 'Nex',
    role: 'Generalist',
    description: 'Agente multipropósito para tareas diversas',
    personality: 'Adaptable, flexible, listo para cualquier cosa',
    skills: ['general_knowledge', 'adaptation', 'multitasking', 'problem_solving'],
    sprite: {
      idle: '/assets/pixel-art/characters/nex/idle.png',
      working: '/assets/pixel-art/characters/nex/working.png',
      thinking: '/assets/pixel-art/characters/nex/thinking.png',
      blocked: '/assets/pixel-art/characters/nex/blocked.png',
      completed: '/assets/pixel-art/characters/nex/completed.png',
      failed: '/assets/pixel-art/characters/nex/failed.png',
    },
    colors: {
      primary: '#00FF7F',  // Verde spring
      secondary: '#C0C0C0', // Plata
      background: '#000000', // Negro
    },
    size: { width: 16, height: 32 },
  },
  
  custom: {
    id: 'custom',
    name: 'Custom',
    role: 'Custom',
    description: 'Agente personalizado',
    personality: 'Personalizado',
    skills: [],
    sprite: {
      idle: '/assets/pixel-art/characters/custom/idle.png',
      working: '/assets/pixel-art/characters/custom/working.png',
      thinking: '/assets/pixel-art/characters/custom/thinking.png',
      blocked: '/assets/pixel-art/characters/custom/blocked.png',
      completed: '/assets/pixel-art/characters/custom/completed.png',
      failed: '/assets/pixel-art/characters/custom/failed.png',
    },
    colors: {
      primary: '#808080',  // Gris
      secondary: '#FFFFFF', // Blanco
      background: '#000000', // Negro
    },
    size: { width: 16, height: 32 },
  },
}

// ============================================
// ESTADOS DE ANIMACIÓN
// ============================================

/**
 * Estados posibles de un personaje
 */
export type AnimationStatus = 
  | 'idle'      // Inactivo
  | 'working'   // Trabajando
  | 'thinking'  // Pensando
  | 'progress'  // En progreso
  | 'blocked'   // Bloqueado
  | 'completed' // Completado
  | 'failed'    // Falló
  | 'paused'    // Pausado
  | 'walking'   // Caminando

/**
 * Configuración de animación para un estado
 */
export interface AnimationConfig {
  frames: number[]       // Frames a mostrar (índices)
  speed: number         // Velocidad en ms
  loop: boolean         // ¿Se repite?
  direction?: 'horizontal' | 'vertical'  // Dirección del sprite sheet
}

/**
 * Animaciones para cada personaje
 */
export const ANIMATIONS: Record<CharacterType, Record<AnimationStatus, AnimationConfig>> = {
  luna: {
    idle: { frames: [0, 1], speed: 2000, loop: true },
    working: { frames: [0, 1, 2, 1], speed: 500, loop: true },
    thinking: { frames: [0, 1], speed: 3000, loop: true },
    progress: { frames: [0, 1, 2, 1], speed: 500, loop: true },
    blocked: { frames: [0, 1], speed: 1000, loop: true },
    completed: { frames: [0, 1, 2, 1], speed: 1000, loop: false },
    failed: { frames: [0, 1], speed: 2000, loop: true },
    paused: { frames: [0], speed: 0, loop: false },
    walking: { frames: [0, 1, 2, 3], speed: 300, loop: true },
  },
  max: {
    idle: { frames: [0, 1], speed: 2000, loop: true },
    working: { frames: [0, 1, 2, 1], speed: 400, loop: true },
    thinking: { frames: [0, 1], speed: 2500, loop: true },
    progress: { frames: [0, 1, 2, 1], speed: 400, loop: true },
    blocked: { frames: [0, 1], speed: 800, loop: true },
    completed: { frames: [0, 1, 2, 1], speed: 800, loop: false },
    failed: { frames: [0, 1], speed: 2000, loop: true },
    paused: { frames: [0], speed: 0, loop: false },
    walking: { frames: [0, 1, 2, 3], speed: 250, loop: true },
  },
  pixel: {
    idle: { frames: [0, 1], speed: 1800, loop: true },
    working: { frames: [0, 1, 2, 3, 2, 1], speed: 300, loop: true },
    thinking: { frames: [0, 1], speed: 2800, loop: true },
    progress: { frames: [0, 1, 2, 3, 2, 1], speed: 300, loop: true },
    blocked: { frames: [0, 1], speed: 900, loop: true },
    completed: { frames: [0, 1, 2, 3, 2, 1], speed: 800, loop: false },
    failed: { frames: [0, 1], speed: 1800, loop: true },
    paused: { frames: [0], speed: 0, loop: false },
    walking: { frames: [0, 1, 2, 3], speed: 280, loop: true },
  },
  data: {
    idle: { frames: [0, 1], speed: 2200, loop: true },
    working: { frames: [0, 1, 2, 1], speed: 450, loop: true },
    thinking: { frames: [0, 1], speed: 3200, loop: true },
    progress: { frames: [0, 1, 2, 1], speed: 450, loop: true },
    blocked: { frames: [0, 1], speed: 1100, loop: true },
    completed: { frames: [0, 1, 2, 1], speed: 900, loop: false },
    failed: { frames: [0, 1], speed: 2200, loop: true },
    paused: { frames: [0], speed: 0, loop: false },
    walking: { frames: [0, 1, 2, 3], speed: 320, loop: true },
  },
  scout: {
    idle: { frames: [0, 1], speed: 2400, loop: true },
    working: { frames: [0, 1, 2, 3, 2, 1], speed: 350, loop: true },
    thinking: { frames: [0, 1], speed: 3000, loop: true },
    progress: { frames: [0, 1, 2, 3, 2, 1], speed: 350, loop: true },
    blocked: { frames: [0, 1], speed: 1200, loop: true },
    completed: { frames: [0, 1, 2, 3, 2, 1], speed: 1000, loop: false },
    failed: { frames: [0, 1], speed: 2400, loop: true },
    paused: { frames: [0], speed: 0, loop: false },
    walking: { frames: [0, 1, 2, 3], speed: 300, loop: true },
  },
  layout: {
    idle: { frames: [0, 1], speed: 1900, loop: true },
    working: { frames: [0, 1, 2, 1], speed: 420, loop: true },
    thinking: { frames: [0, 1], speed: 2700, loop: true },
    progress: { frames: [0, 1, 2, 1], speed: 420, loop: true },
    blocked: { frames: [0, 1], speed: 950, loop: true },
    completed: { frames: [0, 1, 2, 1], speed: 900, loop: false },
    failed: { frames: [0, 1], speed: 1900, loop: true },
    paused: { frames: [0], speed: 0, loop: false },
    walking: { frames: [0, 1, 2, 3], speed: 270, loop: true },
  },
  boss: {
    idle: { frames: [0, 1], speed: 2500, loop: true },
    working: { frames: [0, 1, 2, 3, 2, 1], speed: 500, loop: true },
    thinking: { frames: [0, 1], speed: 3500, loop: true },
    progress: { frames: [0, 1, 2, 3, 2, 1], speed: 500, loop: true },
    blocked: { frames: [0, 1], speed: 1300, loop: true },
    completed: { frames: [0, 1, 2, 3, 2, 1], speed: 1200, loop: false },
    failed: { frames: [0, 1], speed: 2500, loop: true },
    paused: { frames: [0], speed: 0, loop: false },
    walking: { frames: [0, 1, 2, 3], speed: 350, loop: true },
  },
  nex: {
    idle: { frames: [0, 1], speed: 2000, loop: true },
    working: { frames: [0, 1, 2, 1], speed: 400, loop: true },
    thinking: { frames: [0, 1], speed: 2800, loop: true },
    progress: { frames: [0, 1, 2, 1], speed: 400, loop: true },
    blocked: { frames: [0, 1], speed: 1000, loop: true },
    completed: { frames: [0, 1, 2, 1], speed: 900, loop: false },
    failed: { frames: [0, 1], speed: 2000, loop: true },
    paused: { frames: [0], speed: 0, loop: false },
    walking: { frames: [0, 1, 2, 3], speed: 280, loop: true },
  },
  custom: {
    idle: { frames: [0, 1], speed: 2000, loop: true },
    working: { frames: [0, 1], speed: 500, loop: true },
    thinking: { frames: [0, 1], speed: 3000, loop: true },
    progress: { frames: [0, 1], speed: 500, loop: true },
    blocked: { frames: [0, 1], speed: 1000, loop: true },
    completed: { frames: [0, 1], speed: 1000, loop: false },
    failed: { frames: [0, 1], speed: 2000, loop: true },
    paused: { frames: [0], speed: 0, loop: false },
    walking: { frames: [0, 1], speed: 300, loop: true },
  },
}

// ============================================
// ICONOS DE ESTADO
// ============================================

/**
 * Iconos para cada estado (emoji style)
 */
export const STATUS_ICONS: Record<AnimationStatus, string> = {
  idle: '⚪',
  working: '🟢',
  thinking: '💭',
  progress: '🟡',
  blocked: '🔴',
  completed: '✅',
  failed: '❌',
  paused: '⏸',
  walking: '👣',
}

/**
 * Nombres de estados para display
 */
export const STATUS_LABELS: Record<AnimationStatus, string> = {
  idle: 'Idle',
  working: 'Working',
  thinking: 'Thinking',
  progress: 'In Progress',
  blocked: 'Blocked',
  completed: 'Completed',
  failed: 'Failed',
  paused: 'Paused',
  walking: 'Walking',
}

/**
 * Colores de estado
 */
export const STATUS_COLORS: Record<AnimationStatus, string> = {
  idle: '#666666',
  working: '#4CAF50',
  thinking: '#2196F3',
  progress: '#FFC107',
  blocked: '#F44336',
  completed: '#4CAF50',
  failed: '#9C27B0',
  paused: '#FF9800',
  walking: '#FF5722',
}

// ============================================
// ELEMENTOS DE LA OFICINA
// ============================================

/**
 * Tipos de decoraciones para la oficina
 */
export type DecorationType = 
  | 'desk'           // Escritorio
  | 'chair'          // Silla
  | 'screen'         // Pantalla
  | 'whiteboard'     // Pizarra
  | 'plant'          // Planta
  | 'trash'          // Papelera
  | 'clock'          // Reloj
  | 'window'         // Ventana
  | 'fan'            // Ventilador
  | 'server'         // Servidor
  | 'cable'          // Cables
  | 'light'          // Luz
  | 'shelf'          // Estantería
  | 'coffee'         // Café
  | 'book'           // Libro
  | 'notebook'       // Cuaderno

/**
 * Información de una decoración
 */
export interface DecorationInfo {
  type: DecorationType
  sprite: string
  size: { width: number; height: number }
  offset: { x: number; y: number }
  animatable: boolean
  animation?: AnimationConfig
}

/**
 * Catálogo de decoraciones
 */
export const DECORATIONS: Record<DecorationType, DecorationInfo> = {
  desk: {
    type: 'desk',
    sprite: '/assets/pixel-art/office/desk.png',
    size: { width: 40, height: 20 },
    offset: { x: 0, y: 20 },
    animatable: false,
  },
  chair: {
    type: 'chair',
    sprite: '/assets/pixel-art/office/chair.png',
    size: { width: 16, height: 16 },
    offset: { x: 12, y: 24 },
    animatable: false,
  },
  screen: {
    type: 'screen',
    sprite: '/assets/pixel-art/office/screen.png',
    size: { width: 24, height: 16 },
    offset: { x: 8, y: 4 },
    animatable: true,
    animation: { frames: [0, 1, 2], speed: 3000, loop: true },
  },
  whiteboard: {
    type: 'whiteboard',
    sprite: '/assets/pixel-art/office/whiteboard.png',
    size: { width: 64, height: 32 },
    offset: { x: 0, y: 0 },
    animatable: false,
  },
  plant: {
    type: 'plant',
    sprite: '/assets/pixel-art/office/plant.png',
    size: { width: 16, height: 32 },
    offset: { x: 0, y: 0 },
    animatable: true,
    animation: { frames: [0, 1], speed: 5000, loop: true },
  },
  trash: {
    type: 'trash',
    sprite: '/assets/pixel-art/office/trash.png',
    size: { width: 16, height: 16 },
    offset: { x: 0, y: 0 },
    animatable: false,
  },
  clock: {
    type: 'clock',
    sprite: '/assets/pixel-art/office/clock.png',
    size: { width: 16, height: 16 },
    offset: { x: 0, y: 0 },
    animatable: true,
    animation: { frames: [0, 1, 2, 3], speed: 1000, loop: true },
  },
  window: {
    type: 'window',
    sprite: '/assets/pixel-art/office/window.png',
    size: { width: 32, height: 32 },
    offset: { x: 0, y: 0 },
    animatable: true,
    animation: { frames: [0, 1], speed: 8000, loop: true },
  },
  fan: {
    type: 'fan',
    sprite: '/assets/pixel-art/office/fan.png',
    size: { width: 16, height: 16 },
    offset: { x: 0, y: 0 },
    animatable: true,
    animation: { frames: [0, 1, 2, 3], speed: 200, loop: true },
  },
  server: {
    type: 'server',
    sprite: '/assets/pixel-art/office/server.png',
    size: { width: 24, height: 32 },
    offset: { x: 0, y: 0 },
    animatable: true,
    animation: { frames: [0, 1], speed: 4000, loop: true },
  },
  cable: {
    type: 'cable',
    sprite: '/assets/pixel-art/office/cable.png',
    size: { width: 32, height: 4 },
    offset: { x: 0, y: 0 },
    animatable: true,
    animation: { frames: [0, 1], speed: 2000, loop: true },
  },
  light: {
    type: 'light',
    sprite: '/assets/pixel-art/office/light.png',
    size: { width: 8, height: 8 },
    offset: { x: 0, y: 0 },
    animatable: true,
    animation: { frames: [0, 1], speed: 1500, loop: true },
  },
  shelf: {
    type: 'shelf',
    sprite: '/assets/pixel-art/office/shelf.png',
    size: { width: 32, height: 32 },
    offset: { x: 0, y: 0 },
    animatable: false,
  },
  coffee: {
    type: 'coffee',
    sprite: '/assets/pixel-art/office/coffee.png',
    size: { width: 12, height: 12 },
    offset: { x: 0, y: 0 },
    animatable: true,
    animation: { frames: [0, 1], speed: 3000, loop: true },
  },
  book: {
    type: 'book',
    sprite: '/assets/pixel-art/office/book.png',
    size: { width: 16, height: 12 },
    offset: { x: 0, y: 0 },
    animatable: false,
  },
  notebook: {
    type: 'notebook',
    sprite: '/assets/pixel-art/office/notebook.png',
    size: { width: 20, height: 16 },
    offset: { x: 0, y: 0 },
    animatable: false,
  },
}

// ============================================
// TEMAS DE OFICINA
// ============================================

/**
 * Tipos de temas para la oficina
 */
export type OfficeTheme = 
  | 'pixel'      // Estilo pixel art clásico
  | 'cyberpunk'  // Estilo cyberpunk con neón
  | 'minimal'    // Estilo minimalista
  | 'dark'       // Estilo oscuro
  | 'light'      // Estilo claro

/**
 * Configuración de un tema
 */
export interface ThemeConfig {
  name: string
  background: string
  floor: string
  wall: string
  desk: string
  text: string
  primary: string
  secondary: string
  accent: string
  error: string
  success: string
  agentColors: Record<AnimationStatus, string>
  decorations: DecorationType[]
}

/**
 * Configuración de todos los temas
 */
export const OFFICE_THEMES: Record<OfficeTheme, ThemeConfig> = {
  pixel: {
    name: 'Pixel Art',
    background: '#0A0A0A',
    floor: '#1A1A1A',
    wall: '#2A2A2A',
    desk: '#3A3A3A',
    text: '#FFFFFF',
    primary: '#4CAF50',
    secondary: '#2196F3',
    accent: '#FFC107',
    error: '#F44336',
    success: '#4CAF50',
    agentColors: STATUS_COLORS,
    decorations: ['desk', 'chair', 'screen', 'plant', 'clock'],
  },
  cyberpunk: {
    name: 'Cyberpunk',
    background: '#000000',
    floor: '#111111',
    wall: '#000022',
    desk: '#112233',
    text: '#00FFFF',
    primary: '#00FFFF',
    secondary: '#FF00FF',
    accent: '#FFFF00',
    error: '#FF0000',
    success: '#00FF00',
    agentColors: {
      idle: '#666666',
      working: '#00FF00',
      thinking: '#00FFFF',
      progress: '#FFFF00',
      blocked: '#FF0000',
      completed: '#00FF00',
      failed: '#FF00FF',
      paused: '#FF8800',
      walking: '#FF5500',
    },
    decorations: ['desk', 'chair', 'screen', 'server', 'cable', 'light', 'window'],
  },
  minimal: {
    name: 'Minimal',
    background: '#FFFFFF',
    floor: '#F5F5F5',
    wall: '#E0E0E0',
    desk: '#D0D0D0',
    text: '#000000',
    primary: '#000000',
    secondary: '#666666',
    accent: '#4CAF50',
    error: '#F44336',
    success: '#4CAF50',
    agentColors: STATUS_COLORS,
    decorations: ['desk', 'chair', 'screen', 'whiteboard'],
  },
  dark: {
    name: 'Dark',
    background: '#121212',
    floor: '#1E1E1E',
    wall: '#2A2A2A',
    desk: '#3A3A3A',
    text: '#E0E0E0',
    primary: '#BB86FC',
    secondary: '#03DAC6',
    accent: '#FF9800',
    error: '#CF6679',
    success: '#4CAF50',
    agentColors: STATUS_COLORS,
    decorations: ['desk', 'chair', 'screen', 'plant', 'clock'],
  },
  light: {
    name: 'Light',
    background: '#F5F5F5',
    floor: '#E0E0E0',
    wall: '#D0D0D0',
    desk: '#C0C0C0',
    text: '#212121',
    primary: '#2196F3',
    secondary: '#4CAF50',
    accent: '#FFC107',
    error: '#F44336',
    success: '#4CAF50',
    agentColors: STATUS_COLORS,
    decorations: ['desk', 'chair', 'screen', 'whiteboard', 'plant'],
  },
}

// ============================================
// LAYOUT DE OFICINA
// ============================================

/**
 * Posición en el grid de la oficina
 */
export interface OfficePosition {
  x: number
  y: number
}

/**
 * Configuración del layout de la oficina
 */
export interface OfficeLayout {
  columns: number
  rows: number
  cellSize: number
  cellSpacing: number
  agentPositions: Record<CharacterType, OfficePosition>
  decorationPositions: Record<string, OfficePosition & { type: DecorationType }>
}

/**
 * Layout por defecto para 8 columnas x 5 filas
 */
export const DEFAULT_LAYOUT: OfficeLayout = {
  columns: 8,
  rows: 5,
  cellSize: 40,
  cellSpacing: 4,
  agentPositions: {
    luna: { x: 0, y: 0 },
    max: { x: 2, y: 0 },
    pixel: { x: 4, y: 0 },
    data: { x: 6, y: 0 },
    scout: { x: 0, y: 2 },
    layout: { x: 2, y: 2 },
    nex: { x: 4, y: 2 },
    boss: { x: 6, y: 2 },
    custom: { x: 0, y: 4 },
  },
  decorationPositions: {
    'window_1': { x: 7, y: 0, type: 'window' },
    'plant_1': { x: 1, y: 1, type: 'plant' },
    'plant_2': { x: 5, y: 1, type: 'plant' },
    'clock_1': { x: 7, y: 1, type: 'clock' },
    'screen_1': { x: 3, y: 1, type: 'screen' },
    'server_1': { x: 7, y: 2, type: 'server' },
    'fan_1': { x: 5, y: 2, type: 'fan' },
    'whiteboard': { x: 0, y: 4, type: 'whiteboard' },
  },
}

/**
 * Layout alternativo para oficinas más grandes
 */
export const LARGE_LAYOUT: OfficeLayout = {
  columns: 10,
  rows: 6,
  cellSize: 36,
  cellSpacing: 4,
  agentPositions: {
    luna: { x: 1, y: 0 },
    max: { x: 3, y: 0 },
    pixel: { x: 5, y: 0 },
    data: { x: 7, y: 0 },
    scout: { x: 1, y: 2 },
    layout: { x: 3, y: 2 },
    nex: { x: 5, y: 2 },
    boss: { x: 7, y: 2 },
    custom: { x: 1, y: 4 },
  },
  decorationPositions: {
    'window_1': { x: 9, y: 0, type: 'window' },
    'window_2': { x: 9, y: 2, type: 'window' },
    'plant_1': { x: 0, y: 1, type: 'plant' },
    'plant_2': { x: 2, y: 1, type: 'plant' },
    'plant_3': { x: 6, y: 1, type: 'plant' },
    'plant_4': { x: 8, y: 1, type: 'plant' },
    'clock_1': { x: 9, y: 1, type: 'clock' },
    'screen_1': { x: 4, y: 1, type: 'screen' },
    'screen_2': { x: 8, y: 3, type: 'screen' },
    'server_1': { x: 9, y: 3, type: 'server' },
    'server_2': { x: 0, y: 3, type: 'server' },
    'fan_1': { x: 4, y: 3, type: 'fan' },
    'whiteboard': { x: 0, y: 5, type: 'whiteboard' },
    'coffee_1': { x: 2, y: 3, type: 'coffee' },
    'book_1': { x: 6, y: 3, type: 'book' },
  },
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Obtiene el personaje por ID
 */
export function getCharacterById(id: CharacterType): CharacterInfo {
  return CHARACTERS[id] || CHARACTERS.custom
}

/**
 * Obtiene la configuración de animación para un personaje y estado
 */
export function getAnimationConfig(character: CharacterType, status: AnimationStatus): AnimationConfig {
  return ANIMATIONS[character]?.[status] || ANIMATIONS.custom[status]
}

/**
 * Obtiene el icono de estado
 */
export function getStatusIcon(status: AnimationStatus): string {
  return STATUS_ICONS[status] || '❓'
}

/**
 * Obtiene el nombre del estado
 */
export function getStatusLabel(status: AnimationStatus): string {
  return STATUS_LABELS[status] || status
}

/**
 * Obtiene el color del estado
 */
export function getStatusColor(status: AnimationStatus): string {
  return STATUS_COLORS[status] || '#808080'
}

/**
 * Obtiene la configuración de un tema
 */
export function getThemeConfig(theme: OfficeTheme): ThemeConfig {
  return OFFICE_THEMES[theme] || OFFICE_THEMES.pixel
}

/**
 * Obtiene el layout por defecto
 */
export function getDefaultLayout(): OfficeLayout {
  return DEFAULT_LAYOUT
}

/**
 * Convierte un estado de Agent a AnimationStatus
 */
export function agentStatusToAnimationStatus(status: string): AnimationStatus {
  const statusMap: Record<string, AnimationStatus> = {
    'idle': 'idle',
    'working': 'working',
    'progress': 'progress',
    'blocked': 'blocked',
    'completed': 'completed',
    'failed': 'failed',
    'paused': 'paused',
  }
  return statusMap[status.toLowerCase()] || 'idle'
}
