import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CharacterType, 
  CHARACTERS, 
  ANIMATIONS, 
  STATUS_ICONS,
  STATUS_LABELS,
  STATUS_COLORS,
  agentStatusToAnimationStatus
} from '../../types/pixel-art'

// ============================================
// INTERFACES
// ============================================

interface PixelAgentProps {
  /** Tipo de personaje */
  character?: CharacterType
  /** Estado actual del agente */
  status: string
  /** Porcentaje de progreso (0-100) */
  progress: number
  /** Nombre del agente */
  name?: string
  /** Tarea actual */
  currentTask?: string
  /** Rol del agente */
  role?: string
  /** Tamaño del sprite (en píxeles) */
  size?: number
  /** ¿Mostrar barra de progreso? */
  showProgress?: boolean
  /** ¿Mostrar información al hacer hover? */
  showTooltip?: boolean
  /** Callback al hacer click */
  onClick?: () => void
  /** Callback al hacer hover */
  onHover?: (hovering: boolean) => void
  /** Estilo adicional */
  className?: string
}

// ============================================
// ESTILOS CSS
// ============================================

const styles = {
  container: (
    size: number,
    isSelected: boolean
  ) => ({
    position: 'relative' as const,
    width: `${size}px`,
    height: `${size * 2}px`, // 2:1 aspect ratio (16x32)
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'all 0.2s ease',
    transform: isSelected ? 'scale(1.05)' : 'scale(1)',
    zIndex: isSelected ? 10 : 1,
    boxShadow: isSelected 
      ? '0 0 12px rgba(0, 255, 255, 0.5)' 
      : '0 2px 4px rgba(0, 0, 0, 0.3)',
  }),
  
  sprite: (
    size: number,
    frameWidth: number,
    frameHeight: number,
    frameIndex: number
  ) => ({
    width: `${size}px`,
    height: `${size * 2}px`,
    backgroundSize: `${frameWidth * size}px ${frameHeight * size * 2}px`,
    backgroundPosition: `-${frameIndex * size}px 0`,
    imageRendering: 'pixelated' as const,
  }),
  
  statusIcon: {
    position: 'absolute' as const,
    top: '-8px',
    right: '-8px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    fontSize: '12px',
    fontWeight: 'bold' as const,
    boxShadow: '0 0 4px rgba(0, 0, 0, 0.5)',
  },
  
  progressBar: {
    position: 'absolute' as const,
    bottom: '0',
    left: '0',
    right: '0',
    height: '4px',
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '0 0 4px 4px',
    overflow: 'hidden' as const,
  },
  
  progressFill: (progress: number, status: string) => ({
    height: '100%',
    width: `${progress}%`,
    background: STATUS_COLORS[agentStatusToAnimationStatus(status)] || '#666666',
    borderRadius: '0 0 4px 4px',
    transition: 'width 0.3s ease',
  }),
  
  nameTag: {
    position: 'absolute' as const,
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%) translateY(-4px)',
    background: 'rgba(0, 0, 0, 0.8)',
    color: '#FFFFFF',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 'bold' as const,
    whiteSpace: 'nowrap' as const,
    pointerEvents: 'none' as const,
  },
  
  taskTag: {
    position: 'absolute' as const,
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%) translateY(4px)',
    background: 'rgba(0, 0, 0, 0.8)',
    color: '#FFFFFF',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '8px',
    whiteSpace: 'nowrap' as const,
    pointerEvents: 'none' as const,
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis' as const,
  },
  
  tooltip: {
    position: 'absolute' as const,
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%) translateY(-8px)',
    background: '#1A1A1A',
    border: '1px solid #3A3A3A',
    borderRadius: '6px',
    padding: '8px',
    minWidth: '160px',
    zIndex: 20,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
  },
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

/**
 * Componente PixelAgent - Representa un agente como sprite pixel art animado
 */
export const PixelAgent: React.FC<PixelAgentProps> = ({
  character = 'custom',
  status = 'idle',
  progress = 0,
  name,
  currentTask,
  role,
  size = 32,
  showProgress = true,
  showTooltip = true,
  onClick,
  onHover,
  className = '',
}) => {
  // Obtener información del personaje
  const charInfo = CHARACTERS[character] || CHARACTERS.custom
  
  // Convertir estado del agente a AnimationStatus
  const animationStatus = agentStatusToAnimationStatus(status)
  
  // Obtener configuración de animación
  const animationConfig = ANIMATIONS[character]?.[animationStatus] || 
    ANIMATIONS.custom[animationStatus]
  
  // Estado para el frame actual
  const [currentFrame, setCurrentFrame] = useState(0)
  const [isHovering, setIsHovering] = useState(false)
  const [isSelected, setIsSelected] = useState(false)
  
  // Ref para la animación
  const animationRef = useRef<number>()
  
  // Calcular el frame actual basado en la animación
  useEffect(() => {
    // Limpiar animación anterior
    if (animationRef.current) {
      clearInterval(animationRef.current)
    }
    
    // Si la animación no tiene loop y no es la primera vez, no animar
    if (!animationConfig.loop && currentFrame > 0) {
      return
    }
    
    // Configurar nueva animación
    const frames = animationConfig.frames
    let frameIndex = 0
    
    animationRef.current = window.setInterval(() => {
      frameIndex = (frameIndex + 1) % frames.length
      setCurrentFrame(frames[frameIndex])
    }, animationConfig.speed)
    
    // Limpiar al desmontar
    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current)
      }
    }
  }, [character, status, animationConfig])
  
  // Resetear frame cuando cambia el estado
  useEffect(() => {
    setCurrentFrame(animationConfig.frames[0])
  }, [status, animationConfig])
  
  // Manejar hover
  const handleMouseEnter = () => {
    setIsHovering(true)
    if (onHover) onHover(true)
  }
  
  const handleMouseLeave = () => {
    setIsHovering(false)
    if (onHover) onHover(false)
  }
  
  const handleClick = () => {
    setIsSelected(!isSelected)
    if (onClick) onClick()
  }
  
  // Estilo del contenedor
  const containerStyle = {
    ...styles.container(size, isSelected),
  }
  
  // Estilo del sprite
  const spriteStyle = {
    ...styles.sprite(
      size,
      charInfo.size.width,
      charInfo.size.height,
      currentFrame
    ),
    // Usar sprite sheet del personaje
    backgroundImage: `url('${charInfo.sprite[animationStatus]}')`,
  }
  
  // Color de estado
  const statusColor = STATUS_COLORS[animationStatus] || '#666666'
  
  // Renderizar tooltip
  const renderTooltip = () => {
    if (!showTooltip || !isHovering) return null
    
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.1 }}
        style={styles.tooltip}
      >
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
          {name || charInfo.name}
        </div>
        <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>
          {role || charInfo.role}
        </div>
        <div style={{ fontSize: '10px', color: '#888' }}>
          {STATUS_LABELS[animationStatus] || status}
        </div>
        {currentTask && (
          <div style={{ 
            fontSize: '10px', 
            color: '#4CAF50', 
            marginTop: '4px',
            fontStyle: 'italic'
          }}>
            {currentTask}
          </div>
        )}
        <div style={{ 
          fontSize: '10px', 
          color: '#666', 
          marginTop: '4px'
        }}>
          Progress: {progress}%
        </div>
      </motion.div>
    )
  }
  
  return (
    <motion.div
      style={containerStyle}
      className={`pixel-agent ${className}`}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: 1.05, y: -4 }}
      whileTap={{ scale: 0.95 }}
      animate={{
        boxShadow: isSelected 
          ? '0 0 12px rgba(0, 255, 255, 0.5)' 
          : '0 2px 4px rgba(0, 0, 0, 0.3)',
      }}
      transition={{ duration: 0.2 }}
    >
      {/* Tooltip */}
      <AnimatePresence>
        {renderTooltip()}
      </AnimatePresence>
      
      {/* Icono de estado */}
      <motion.div
        style={{ ...styles.statusIcon, background: statusColor }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 10, stiffness: 100 }}
      >
        {STATUS_ICONS[animationStatus]}
      </motion.div>
      
      {/* Sprite del personaje */}
      <motion.div
        style={spriteStyle}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      />
      
      {/* Barra de progreso */}
      {showProgress && (
        <div style={styles.progressBar}>
          <motion.div
            style={styles.progressFill(progress, status)}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      )}
      
      {/* Etiqueta de nombre */}
      {name && (
        <motion.div
          style={styles.nameTag}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.2 }}
        >
          {name}
        </motion.div>
      )}
      
      {/* Etiqueta de tarea */}
      {currentTask && (
        <motion.div
          style={styles.taskTag}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.2 }}
        >
          {currentTask}
        </motion.div>
      )}
    </motion.div>
  )
}

// ============================================
// COMPONENTE OPTIMIZADO PARA LISTAS
// ============================================

/**
 * Props para PixelAgentOptimized (versión optimizada para listas)
 */
interface PixelAgentOptimizedProps extends PixelAgentProps {
  /** Index para animación escalonada */
  index?: number
  /** ¿Está en modo compacto? */
  compact?: boolean
}

/**
 * Versión optimizada para renderizar múltiples agentes
 */
export const PixelAgentOptimized: React.FC<PixelAgentOptimizedProps> = ({
  character = 'custom',
  status = 'idle',
  progress = 0,
  name,
  currentTask: _currentTask,
  role: _role,
  size = 32,
  showProgress = true,
  showTooltip: _showTooltip = false,
  onClick,
  onHover,
  className = '',
  index = 0,
  compact = false,
}) => {
  const charInfo = CHARACTERS[character] || CHARACTERS.custom
  const animationStatus = agentStatusToAnimationStatus(status)
  const animationConfig = ANIMATIONS[character]?.[animationStatus] || 
    ANIMATIONS.custom[animationStatus]
  
  const [currentFrame, setCurrentFrame] = useState(0)
  const [isHovering, setIsHovering] = useState(false)
  
  useEffect(() => {
    if (animationRef.current) {
      clearInterval(animationRef.current)
    }
    
    if (!animationConfig.loop && currentFrame > 0) {
      return
    }
    
    const frames = animationConfig.frames
    let frameIndex = 0
    
    animationRef.current = window.setInterval(() => {
      frameIndex = (frameIndex + 1) % frames.length
      setCurrentFrame(frames[frameIndex])
    }, animationConfig.speed)
    
    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current)
      }
    }
  }, [character, status, animationConfig])
  
  useEffect(() => {
    setCurrentFrame(animationConfig.frames[0])
  }, [status, animationConfig])
  
  const handleMouseEnter = () => {
    setIsHovering(true)
    if (onHover) onHover(true)
  }
  
  const handleMouseLeave = () => {
    setIsHovering(false)
    if (onHover) onHover(false)
  }
  
  const containerStyle = {
    ...styles.container(size, false),
    width: compact ? `${size}px` : `${size}px`,
    height: compact ? `${size}px` : `${size * 2}px`,
    filter: isHovering ? 'brightness(1.25)' : 'none',
  }
  
  const spriteStyle = {
    ...styles.sprite(
      size,
      charInfo.size.width,
      charInfo.size.height,
      currentFrame
    ),
    backgroundImage: `url('${charInfo.sprite[animationStatus]}')`,
    width: compact ? `${size}px` : `${size}px`,
    height: compact ? `${size}px` : `${size * 2}px`,
  }
  
  const statusColor = STATUS_COLORS[animationStatus] || '#666666'
  
  return (
    <motion.div
      style={containerStyle}
      className={`pixel-agent ${className}`}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ scale: 1.05 }}
    >
      {/* Icono de estado */}
      <motion.div
        style={{ ...styles.statusIcon, background: statusColor }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 10, stiffness: 100 }}
      >
        {STATUS_ICONS[animationStatus]}
      </motion.div>
      
      {/* Sprite */}
      <motion.div
        style={spriteStyle}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
      />
      
      {/* Barra de progreso */}
      {showProgress && !compact && (
        <div style={styles.progressBar}>
          <motion.div
            style={styles.progressFill(progress, status)}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      )}
      
      {/* Etiqueta de nombre (compacto) */}
      {name && compact && (
        <motion.div
          style={{ ...styles.nameTag, fontSize: '8px' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {name}
        </motion.div>
      )}
    </motion.div>
  )
}

// Ref para animación (compartido entre componentes)
const animationRef: { current: number | null } = { current: null }

// ============================================
// COMPONENTE DE GRUPO DE AGENTES
// ============================================

interface PixelAgentGroupProps {
  agents: Array<{
    id: string
    character: CharacterType
    status: string
    progress: number
    name: string
    currentTask?: string
  }>
  size?: number
  onAgentClick?: (agentId: string) => void
}

/**
 * Componente para renderizar un grupo de agentes
 */
export const PixelAgentGroup: React.FC<PixelAgentGroupProps> = ({
  agents,
  size = 32,
  onAgentClick,
}) => {
  return (
    <div style={{ 
      display: 'flex', 
      flexWrap: 'wrap', 
      gap: '8px',
      justifyContent: 'center'
    }}>
      {agents.map((agent, index) => (
        <PixelAgentOptimized
          key={agent.id}
          character={agent.character}
          status={agent.status}
          progress={agent.progress}
          name={agent.name}
          currentTask={agent.currentTask}
          size={size}
          index={index}
          compact
          onClick={() => onAgentClick?.(agent.id)}
        />
      ))}
    </div>
  )
}

// ============================================
// EXPORTS
// ============================================

export default PixelAgent
