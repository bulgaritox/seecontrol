import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CharacterType, 
  OfficeTheme,
  OfficeLayout,
  DecorationType,
  CHARACTERS,
  OFFICE_THEMES,
  DEFAULT_LAYOUT,
  DECORATIONS,
  STATUS_ICONS,
  STATUS_LABELS,
  STATUS_COLORS,
  agentStatusToAnimationStatus,
  getThemeConfig
} from '../../types/pixel-art'
import { PixelAgent } from './PixelAgent'

// ============================================
// INTERFACES
// ============================================

interface OfficeAgent {
  id: string
  character: CharacterType
  status: string
  progress: number
  name: string
  role: string
  currentTask?: string
  position?: { x: number; y: number }
}

interface ActivityItem {
  id: string
  timestamp: Date
  agentId: string
  agentName: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

interface PixelOfficeProps {
  /** Agentes a mostrar en la oficina */
  agents?: OfficeAgent[]
  /** Tema de la oficina */
  theme?: OfficeTheme
  /** Layout de la oficina */
  layout?: OfficeLayout
  /** Tamaño de celda en píxeles */
  cellSize?: number
  /** ¿Mostrar decoraciones? */
  showDecorations?: boolean
  /** ¿Mostrar feed de actividad? */
  showActivityFeed?: boolean
  /** ¿Mostrar barra de progreso global? */
  showGlobalProgress?: boolean
  /** Callback al hacer click en un agente */
  onAgentClick?: (agentId: string) => void
  /** Callback al cambiar el tema */
  onThemeChange?: (theme: OfficeTheme) => void
  /** Estilo adicional */
  className?: string
  /** Altura máxima de la oficina */
  maxHeight?: string | number
}

// ============================================
// ESTILOS CSS
// ============================================

const styles = {
  // Contenedor principal de la oficina
  officeContainer: (theme: OfficeTheme, maxHeight?: string | number) => ({
    position: 'relative' as const,
    width: '100%',
    maxHeight: maxHeight || '600px',
    overflow: 'hidden',
    background: getThemeConfig(theme).background,
    borderRadius: '8px',
    boxShadow: '0 0 20px rgba(0, 0, 0, 0.5)',
    border: `2px solid ${getThemeConfig(theme).wall}`,
    // Estilo GameBoy: bordes con efecto pixelado
    imageRendering: 'pixelated' as const,
  }),

  // Grid de la oficina
  officeGrid: (layout: OfficeLayout) => ({
    position: 'relative' as const,
    display: 'grid',
    gridTemplateColumns: `repeat(${layout.columns}, ${layout.cellSize + layout.cellSpacing}px)`,
    gridTemplateRows: `repeat(${layout.rows}, ${layout.cellSize * 2 + layout.cellSpacing}px)`,
    gap: `${layout.cellSpacing}px`,
    padding: `${layout.cellSpacing * 2}px`,
    width: '100%',
    height: '100%',
    minHeight: `${(layout.cellSize * 2 + layout.cellSpacing) * layout.rows + layout.cellSpacing * 4}px`,
  }),

  // Celda del grid
  gridCell: (layout: OfficeLayout) => ({
    position: 'relative' as const,
    width: `${layout.cellSize}px`,
    height: `${layout.cellSize * 2}px`,
    // Fondo de celda estilo GameBoy
    background: `repeating-linear-gradient(
      0px, 
      ${getThemeConfig('pixel').floor} 0px, 
      ${getThemeConfig('pixel').floor} 2px, 
      transparent 2px, 
      transparent 4px
    ), 
    repeating-linear-gradient(
      0px 90deg, 
      ${getThemeConfig('pixel').floor} 0px, 
      ${getThemeConfig('pixel').floor} 2px, 
      transparent 2px, 
      transparent 4px
    )`,
    backgroundSize: `${layout.cellSize}px ${layout.cellSize * 2}px`,
    border: `1px solid ${getThemeConfig('pixel').wall}`,
    borderRadius: '2px',
  }),

  // Contenedor del agente en el grid
  agentContainer: (isEmpty: boolean) => ({
    position: 'absolute' as const,
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    opacity: isEmpty ? 0.3 : 1,
    transition: 'opacity 0.2s ease',
  }),

  // Decoraciones
  decoration: (size: number, type: DecorationType) => {
    const decoration = DECORATIONS[type]
    return {
      position: 'absolute' as const,
      width: `${decoration.size.width * (size / 16)}px`,
      height: `${decoration.size.height * (size / 16)}px`,
      backgroundImage: `url('${decoration.sprite}')`,
      backgroundSize: 'contain',
      backgroundRepeat: 'no-repeat' as const,
      backgroundPosition: 'center' as const,
      imageRendering: 'pixelated' as const,
      zIndex: 0,
    }
  },

  // Feed de actividad
  activityFeed: {
    position: 'absolute' as const,
    bottom: '0',
    left: '0',
    right: '0',
    background: 'rgba(0, 0, 0, 0.8)',
    padding: '12px',
    fontSize: '12px',
    fontFamily: 'monospace',
    overflowY: 'auto' as const,
    maxHeight: '120px',
    borderTop: '2px solid #333',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },

  activityItem: (type: string) => {
    const colors = {
      info: '#4CAF50',
      success: '#8BC34A',
      warning: '#FFC107',
      error: '#F44336',
    }
    return {
      display: 'flex',
      alignItems: 'center' as const,
      gap: '8px',
      color: colors[type as keyof typeof colors] || '#CCCCCC',
      padding: '4px 8px',
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '4px',
      borderLeft: `3px solid ${colors[type as keyof typeof colors] || '#CCCCCC'}`,
      animation: 'fadeIn 0.3s ease',
    }
  },

  // Barra de progreso global
  globalProgress: {
    position: 'absolute' as const,
    top: '0',
    left: '0',
    right: '0',
    height: '4px',
    background: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },

  globalProgressFill: (progress: number) => ({
    height: '100%',
    width: `${progress}%`,
    background: `linear-gradient(90deg, #FF0000, #FF8800, #FFFF00, #88FF00, #00FF00)`,
    transition: 'width 0.5s ease',
  }),

  // Selector de tema
  themeSelector: {
    position: 'absolute' as const,
    top: '8px',
    right: '8px',
    zIndex: 100,
    display: 'flex',
    gap: '4px',
    background: 'rgba(0, 0, 0, 0.7)',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #333',
  },

  themeButton: (isActive: boolean, theme: OfficeTheme) => {
    const themeConfig = getThemeConfig(theme)
    return {
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      background: themeConfig.primary,
      border: isActive ? `2px solid ${themeConfig.accent}` : '2px solid transparent',
      cursor: 'pointer' as const,
      transition: 'all 0.2s ease',
      boxShadow: isActive ? `0 0 8px ${themeConfig.primary}` : 'none',
    }
  },

  // Info del agente seleccionado
  agentDetail: {
    position: 'absolute' as const,
    top: '8px',
    left: '8px',
    zIndex: 100,
    background: 'rgba(0, 0, 0, 0.9)',
    border: '1px solid #333',
    borderRadius: '6px',
    padding: '12px',
    minWidth: '200px',
    maxWidth: '280px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
  },

  // Estadísticas de la oficina
  officeStats: {
    position: 'absolute' as const,
    top: '8px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 100,
    background: 'rgba(0, 0, 0, 0.7)',
    border: '1px solid #333',
    borderRadius: '6px',
    padding: '8px 16px',
    display: 'flex',
    gap: '16px',
    fontSize: '12px',
    fontFamily: 'monospace',
  },

  statItem: (_value: string | number, _label: string) => ({
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
  }),

  // Barra de estado inferior (celda + tema + sync)
  statusBar: {
    display: 'flex',
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: '6px 12px',
    fontSize: '10px',
    fontFamily: 'monospace',
    color: '#888',
    borderTop: '1px solid #2A2A2A',
    marginTop: '8px',
  },

  statValue: {
    fontSize: '16px',
    fontWeight: 'bold' as const,
    color: '#00FFFF',
  },

  statLabel: {
    fontSize: '10px',
    color: '#888',
  },

  // Botón de acción
  actionButton: {
    padding: '4px 8px',
    fontSize: '10px',
    background: '#00BFFF',
    color: '#000',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer' as const,
    fontWeight: 'bold' as const,
    transition: 'all 0.2s ease',
  },
}

// ============================================
// DATOS DE EJEMPLO
// ============================================

const SAMPLE_AGENTS: OfficeAgent[] = [
  {
    id: '1',
    character: 'luna',
    status: 'working',
    progress: 67,
    name: 'Luna',
    role: 'Copywriter',
    currentTask: 'Redactando artículo',
    position: { x: 0, y: 0 },
  },
  {
    id: '2',
    character: 'max',
    status: 'working',
    progress: 82,
    name: 'Max',
    role: 'Developer',
    currentTask: 'Generando imágenes',
    position: { x: 2, y: 0 },
  },
  {
    id: '3',
    character: 'pixel',
    status: 'idle',
    progress: 0,
    name: 'Pixel',
    role: 'Designer',
    currentTask: 'Esperando instrucciones',
    position: { x: 4, y: 0 },
  },
  {
    id: '4',
    character: 'data',
    status: 'working',
    progress: 95,
    name: 'Data',
    role: 'Data Analyst',
    currentTask: 'Analizando métricas',
    position: { x: 6, y: 0 },
  },
  {
    id: '5',
    character: 'scout',
    status: 'completed',
    progress: 100,
    name: 'Scout',
    role: 'Researcher',
    currentTask: 'Investigación completada',
    position: { x: 0, y: 2 },
  },
  {
    id: '6',
    character: 'layout',
    status: 'blocked',
    progress: 45,
    name: 'Layout',
    role: 'Layout Assistant',
    currentTask: 'Esperando aprobación',
    position: { x: 2, y: 2 },
  },
  {
    id: '7',
    character: 'nex',
    status: 'thinking',
    progress: 25,
    name: 'Nex',
    role: 'Generalist',
    currentTask: 'Planificando estrategia',
    position: { x: 4, y: 2 },
  },
  {
    id: '8',
    character: 'boss',
    status: 'working',
    progress: 75,
    name: 'Boss',
    role: 'Orchestrator',
    currentTask: 'Coordinando equipo',
    position: { x: 6, y: 2 },
  },
]

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

/**
 * Componente PixelOffice - Oficina virtual pixel art estilo GameBoy
 */
export const PixelOffice: React.FC<PixelOfficeProps> = ({
  agents = SAMPLE_AGENTS,
  theme = 'pixel',
  layout = DEFAULT_LAYOUT,
  cellSize = 40,
  showDecorations = true,
  showActivityFeed = true,
  showGlobalProgress = true,
  onAgentClick,
  onThemeChange,
  className = '',
  maxHeight,
}) => {
  // Estado local
  const [selectedAgent, setSelectedAgent] = useState<OfficeAgent | null>(null)
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([])
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null)
  const [globalProgress, setGlobalProgress] = useState(0)
  const [lastUpdate, setLastUpdate] = useState(Date.now())

  // Configuración del tema
  const themeConfig = getThemeConfig(theme)

  // Layout adaptado al cellSize
  const adaptedLayout = useMemo(() => ({
    ...layout,
    cellSize,
    cellSpacing: Math.max(2, Math.floor(cellSize * 0.1)),
  }), [layout, cellSize])

  // Calcular progreso global
  useEffect(() => {
    if (agents.length === 0) {
      setGlobalProgress(0)
      return
    }

    const totalProgress = agents.reduce((sum, agent) => sum + agent.progress, 0)
    const averageProgress = totalProgress / agents.length
    setGlobalProgress(averageProgress)
  }, [agents])

  // Simular actividad (para demo)
  useEffect(() => {
    const interval = setInterval(() => {
      // Generar actividad aleatoria
      const randomAgent = agents[Math.floor(Math.random() * agents.length)]
      const messages = [
        `${randomAgent.name} completó una subtarea`,
        `${randomAgent.name} está ${randomAgent.currentTask || 'trabajando'}`,
        `${randomAgent.name} consumió tokens`,
        `${randomAgent.name} encontró un resultado`,
        `${randomAgent.name} necesita revisión`,
      ]
      const message = messages[Math.floor(Math.random() * messages.length)]
      const types: ('info' | 'success' | 'warning' | 'error')[] = ['info', 'success', 'warning', 'success']
      const type = types[Math.floor(Math.random() * types.length)]

      setActivityItems(prev => [
        {
          id: Date.now().toString(),
          timestamp: new Date(),
          agentId: randomAgent.id,
          agentName: randomAgent.name,
          message,
          type,
        },
        ...prev.slice(0, 9), // Mantener solo los últimos 10
      ])

      setLastUpdate(Date.now())
    }, 3000)

    return () => clearInterval(interval)
  }, [agents])

  // Manejar click en agente
  const handleAgentClick = useCallback((agent: OfficeAgent) => {
    setSelectedAgent(prev => prev?.id === agent.id ? null : agent)
    if (onAgentClick) {
      onAgentClick(agent.id)
    }
  }, [onAgentClick])

  // Manejar cambio de tema
  const handleThemeChange = useCallback((newTheme: OfficeTheme) => {
    if (onThemeChange) {
      onThemeChange(newTheme)
    }
  }, [onThemeChange])

  // Obtener agente en una posición específica
  const getAgentAtPosition = useCallback((x: number, y: number): OfficeAgent | null => {
    return agents.find(agent => 
      agent.position && agent.position.x === x && agent.position.y === y
    ) || null
  }, [agents])

  // Renderizar celda del grid
  const renderGridCell = useCallback((x: number, y: number) => {
    const agent = getAgentAtPosition(x, y)
    const isEmpty = !agent

    return (
      <motion.div
        key={`cell-${x}-${y}`}
        style={styles.gridCell(adaptedLayout)}
        onHoverStart={() => setHoveredCell({ x, y })}
        onHoverEnd={() => setHoveredCell(null)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: (x + y) * 0.02 }}
      >
        {/* Decoraciones para esta celda */}
        {showDecorations && Object.entries(adaptedLayout.decorationPositions || {}).map(([key, dec]) => {
          if (dec.x === x && dec.y === y) {
            return (
              <motion.div
                key={`dec-${key}`}
                style={styles.decoration(adaptedLayout.cellSize, dec.type)}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: Math.random() * 0.5 }}
              />
            )
          }
          return null
        })}

        {/* Agente en esta celda */}
        {agent && (
          <motion.div
            style={styles.agentContainer(false)}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: (x + y) * 0.05 }}
          >
            <PixelAgent
              character={agent.character}
              status={agent.status}
              progress={agent.progress}
              name={agent.name}
              role={agent.role}
              currentTask={agent.currentTask}
              size={adaptedLayout.cellSize}
              showProgress
              showTooltip={false}
              onClick={() => handleAgentClick(agent)}
            />
          </motion.div>
        )}

        {/* Posición vacía */}
        {isEmpty && showDecorations && (
          <motion.div
            style={styles.agentContainer(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{ duration: 0.5 }}
          >
            <div style={{
              width: `${adaptedLayout.cellSize}px`,
              height: `${adaptedLayout.cellSize * 2}px`,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px dashed rgba(255, 255, 255, 0.2)',
              borderRadius: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: `${adaptedLayout.cellSize * 0.3}px`,
              color: 'rgba(255, 255, 255, 0.3)',
            }}>
              +{x},{y}
            </div>
          </motion.div>
        )}
      </motion.div>
    )
  }, [adaptedLayout, agents, getAgentAtPosition, handleAgentClick, showDecorations])

  // Renderizar selector de tema
  const renderThemeSelector = () => {
    const themes: OfficeTheme[] = ['pixel', 'cyberpunk', 'minimal', 'dark', 'light']

    return (
      <motion.div
        style={styles.themeSelector}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.5 }}
      >
        {themes.map(t => (
          <motion.div
            key={t}
            style={styles.themeButton(theme === t, t)}
            onClick={() => handleThemeChange(t)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title={OFFICE_THEMES[t].name}
          />
        ))}
      </motion.div>
    )
  }

  // Renderizar feed de actividad
  const renderActivityFeed = () => {
    if (!showActivityFeed) return null

    return (
      <motion.div
        style={styles.activityFeed}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.5 }}
      >
        {activityItems.map(item => (
          <motion.div
            key={item.id}
            style={styles.activityItem(item.type)}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <span style={{ fontWeight: 'bold' }}>{item.agentName}:</span>
            <span>{item.message}</span>
            <span style={{ color: '#666', fontSize: '10px' }}>
              {item.timestamp.toLocaleTimeString()}
            </span>
          </motion.div>
        ))}
      </motion.div>
    )
  }

  // Renderizar barra de progreso global
  const renderGlobalProgress = () => {
    if (!showGlobalProgress) return null

    return (
      <motion.div
        style={styles.globalProgress}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <motion.div
          style={styles.globalProgressFill(globalProgress)}
          initial={{ width: 0 }}
          animate={{ width: `${globalProgress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </motion.div>
    )
  }

  // Renderizar detalles del agente seleccionado
  const renderAgentDetail = () => {
    if (!selectedAgent) return null

    const character = CHARACTERS[selectedAgent.character]
    const status = agentStatusToAnimationStatus(selectedAgent.status)

    return (
      <motion.div
        style={styles.agentDetail}
        initial={{ opacity: 0, x: -20, y: -20 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, x: -20, y: -20 }}
        transition={{ duration: 0.2 }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '12px',
          paddingBottom: '12px',
          borderBottom: '1px solid #333',
        }}>
          <div style={{
            width: '48px',
            height: '96px',
            background: `url('${character.sprite.idle}')`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            imageRendering: 'pixelated',
          }} />
          <div>
            <h3 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 'bold',
              color: character.colors.primary,
            }}>
              {selectedAgent.name}
            </h3>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '12px',
              color: '#888',
            }}>
              {selectedAgent.role}
            </p>
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: '12px', color: '#888' }}>Estado:</span>
            <span style={{
              fontSize: '12px',
              fontWeight: 'bold',
              color: STATUS_COLORS[status],
            }}>
              {STATUS_ICONS[status]} {STATUS_LABELS[status]}
            </span>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: '12px', color: '#888' }}>Progreso:</span>
            <span style={{
              fontSize: '12px',
              fontWeight: 'bold',
              color: STATUS_COLORS[status],
            }}>
              {selectedAgent.progress}%
            </span>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: '12px', color: '#888' }}>Tarea:</span>
            <span style={{
              fontSize: '12px',
              fontStyle: 'italic',
              color: '#4CAF50',
            }}>
              {selectedAgent.currentTask || 'Sin tarea'}
            </span>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid #333',
          }}>
            <button
              style={styles.actionButton}
              onClick={() => setSelectedAgent(null)}
            >
              Cerrar
            </button>
            <button
              style={{ ...styles.actionButton, background: '#4CAF50' }}
              onClick={() => {
                // Acción: Chatear con el agente
                alert(`Chateando con ${selectedAgent.name}`)
              }}
            >
              Chatear
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  // Renderizar estadísticas de la oficina
  const renderOfficeStats = () => {
    const totalAgents = agents.length
    const workingAgents = agents.filter(a => ['working', 'progress', 'thinking'].includes(a.status)).length
    const blockedAgents = agents.filter(a => a.status === 'blocked').length
    const completedAgents = agents.filter(a => a.status === 'completed').length

    return (
      <motion.div
        style={styles.officeStats}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <div style={styles.statItem(totalAgents, 'Total')}>
          <span style={styles.statValue}>{totalAgents}</span>
          <span style={styles.statLabel}>Agentes</span>
        </div>
        <div style={styles.statItem(workingAgents, 'Trabajando')}>
          <span style={{ ...styles.statValue, color: STATUS_COLORS.working }}>{workingAgents}</span>
          <span style={styles.statLabel}>Trabajando</span>
        </div>
        <div style={styles.statItem(blockedAgents, 'Bloqueados')}>
          <span style={{ ...styles.statValue, color: STATUS_COLORS.blocked }}>{blockedAgents}</span>
          <span style={styles.statLabel}>Bloqueados</span>
        </div>
        <div style={styles.statItem(completedAgents, 'Completados')}>
          <span style={{ ...styles.statValue, color: STATUS_COLORS.completed }}>{completedAgents}</span>
          <span style={styles.statLabel}>Listos</span>
        </div>
        <div style={styles.statItem(Math.round(globalProgress), 'Progreso')}>
          <span style={styles.statValue}>{Math.round(globalProgress)}%</span>
          <span style={styles.statLabel}>Global</span>
        </div>
      </motion.div>
    )
  }

  // Renderizar decoraciones adicionales (fondo)
  const renderBackgroundDecorations = () => {
    if (!showDecorations) return null

    // Decoraciones de fondo según el tema
    const backgroundDecs = [
      { type: 'window' as DecorationType, x: 0, y: 0, size: 0.5 },
      { type: 'server' as DecorationType, x: 80, y: 10, size: 0.4 },
      { type: 'plant' as DecorationType, x: 90, y: 60, size: 0.6 },
      { type: 'clock' as DecorationType, x: 85, y: 0, size: 0.4 },
      { type: 'fan' as DecorationType, x: 70, y: 40, size: 0.3 },
    ]

    return (
      <>
        {backgroundDecs.map((dec, index) => {
          const decoration = DECORATIONS[dec.type]
          return (
            <motion.div
              key={`bg-dec-${index}`}
              style={{
                position: 'absolute' as const,
                left: `${dec.x}%`,
                top: `${dec.y}%`,
                width: `${decoration.size.width * dec.size}px`,
                height: `${decoration.size.height * dec.size}px`,
                backgroundImage: `url('${decoration.sprite}')`,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat' as const,
                backgroundPosition: 'center' as const,
                imageRendering: 'pixelated' as const,
                opacity: 0.3,
                zIndex: 0,
              }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 0.3, scale: 1 }}
              transition={{ duration: 0.8, delay: Math.random() * 0.5 }}
            />
          )
        })}
      </>
    )
  }

  return (
    <motion.div
      style={styles.officeContainer(theme, maxHeight)}
      className={`pixel-office ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Fondo con decoraciones */}
      {renderBackgroundDecorations()}

      {/* Barra de progreso global */}
      {renderGlobalProgress()}

      {/* Selector de tema */}
      {renderThemeSelector()}

      {/* Estadísticas de la oficina */}
      {renderOfficeStats()}

      {/* Detalles del agente seleccionado */}
      <AnimatePresence>
        {renderAgentDetail()}
      </AnimatePresence>

      {/* Grid de la oficina */}
      <motion.div
        style={styles.officeGrid(adaptedLayout)}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        {Array.from({ length: adaptedLayout.rows }).map((_, y) =>
          Array.from({ length: adaptedLayout.columns }).map((_, x) =>
            renderGridCell(x, y)
          )
        )}
      </motion.div>

      {/* Feed de actividad */}
      {renderActivityFeed()}

      {/* Barra de estado: celda + tema + última sync */}
      <div style={styles.statusBar}>
        <span>Celda {hoveredCell ? `${hoveredCell.x},${hoveredCell.y}` : '—'}</span>
        <span>Tema {themeConfig.name}</span>
        <span>sync {new Date(lastUpdate).toLocaleTimeString()}</span>
      </div>

      {/* Efecto de parpadeo estilo GameBoy */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none' as const,
          zIndex: 10,
          opacity: 0.05,
        }}
        animate={{
          opacity: [0.05, 0.1, 0.05],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Efecto de scanlines estilo CRT */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none' as const,
        zIndex: 11,
        background: `repeating-linear-gradient(
          to bottom,
          transparent 0px,
          rgba(0, 0, 0, 0.1) 1px,
          transparent 2px
        )`,
        opacity: 0.3,
      }} />
    </motion.div>
  )
}

// ============================================
// COMPONENTE SIMPLIFICADO (solo grid de agentes)
// ============================================

interface SimplePixelOfficeProps {
  agents: OfficeAgent[]
  size?: number
  onAgentClick?: (agentId: string) => void
}

/**
 * Versión simplificada de PixelOffice para uso en listas
 */
export const SimplePixelOffice: React.FC<SimplePixelOfficeProps> = ({
  agents,
  size = 32,
  onAgentClick,
}) => {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, minmax(${size * 2 + 8}px, 1fr))`,
      gap: '8px',
      padding: '8px',
    }}>
      {agents.map(agent => (
        <PixelAgent
          key={agent.id}
          character={agent.character}
          status={agent.status}
          progress={agent.progress}
          name={agent.name}
          role={agent.role}
          currentTask={agent.currentTask}
          size={size}
          showProgress
          showTooltip
          onClick={() => onAgentClick?.(agent.id)}
        />
      ))}
    </div>
  )
}

// ============================================
// COMPONENTE DE AGENTE EN MINIATURA
// ============================================

interface MiniAgentProps {
  agent: OfficeAgent
  size?: number
  onClick?: () => void
}

/**
 * Agente en miniatura para vistas compactas
 */
export const MiniPixelAgent: React.FC<MiniAgentProps> = ({
  agent,
  size = 24,
  onClick,
}) => {
  const character = CHARACTERS[agent.character]
  const status = agentStatusToAnimationStatus(agent.status)

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        padding: '4px',
      }}
    >
      <div style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size * 2}px`,
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          background: `url('${character.sprite[status]}')`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          imageRendering: 'pixelated',
        }} />
        <div style={{
          position: 'absolute',
          top: '-4px',
          right: '-4px',
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          background: STATUS_COLORS[status],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '8px',
          fontWeight: 'bold',
        }}>
          {STATUS_ICONS[status]}
        </div>
      </div>
      <div style={{
        fontSize: `${size * 0.4}px`,
        fontWeight: 'bold',
        color: '#FFF',
        textShadow: '1px 1px 2px #000',
        textAlign: 'center',
        whiteSpace: 'nowrap' as const,
        overflow: 'hidden',
        textOverflow: 'ellipsis' as const,
        maxWidth: `${size * 2}px`,
      }}>
        {agent.name}
      </div>
      <div style={{
        width: `${size * 2}px`,
        height: '4px',
        background: 'rgba(255, 255, 255, 0.2)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${agent.progress}%`,
          background: STATUS_COLORS[status],
          borderRadius: '2px',
        }} />
      </div>
    </motion.div>
  )
}

// ============================================
// EXPORTS
// ============================================

export default PixelOffice
