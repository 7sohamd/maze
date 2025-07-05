"use client"

import type React from "react"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, Users, Heart, Zap, Copy, Share2, Check } from "lucide-react"

interface GameState {
  player: {
    x: number
    y: number
    health: number
    speed: number
    score: number
  }
  enemies: Array<{ x: number; y: number; id: string }>
  obstacles: Array<{ x: number; y: number; id: string }>
  goal: { x: number; y: number }
  maze: number[][]
  gameStatus: "playing" | "won" | "lost"
  viewers: number
  timeLeft: number
  lastUpdate?: number
}

export default function GamePage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.roomId as string
  const searchParams = useSearchParams()
  const difficulty = searchParams.get('difficulty') || 'medium'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<number | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [keys, setKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [ping, setPing] = useState<number | null>(null)
  const [displayTimeLeft, setDisplayTimeLeft] = useState<number | null>(null)
  const lastUpdateRef = useRef<number | null>(null)
  const baseTimeLeftRef = useRef<number | null>(null)
  const lastMoveTimeRef = useRef<number | null>(null)
  const [cellSize, setCellSize] = useState(20)
  const [copied, setCopied] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [playerHit, setPlayerHit] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const playerWallet = usePetraWallet()
  const [lastMovement, setLastMovement] = useState<{x: number, y: number} | null>(null)
  const movementQueueRef = useRef<Array<{x: number, y: number}>>([])
  const isProcessingMovementRef = useRef(false)

  // Initialize game
  useEffect(() => {
    const initGame = async () => {
      try {
        console.log("Initializing game for room:", roomId)
        
        // Try to start the game directly - the start API will create the room if needed
        console.log("Starting game for room:", roomId)
        
        const response = await fetch(`/api/rooms/${roomId}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            difficulty,
            playerWallet: playerWallet.address 
          }),
        })
        console.log("Start response status:", response.status)
        console.log("Start response headers:", Object.fromEntries(response.headers.entries()))
        
        if (response.ok) {
          const initialState = await response.json()
          console.log("Game state received:", initialState)
          setGameState(initialState)
        } else {
          let errorData
          try {
            errorData = await response.json()
          } catch (e) {
            errorData = { error: "Failed to parse error response" }
          }
          console.error("Failed to start game:", errorData)
          alert(`Failed to start game: ${errorData.error || errorData.details || 'Unknown error'}`)
          router.push("/")
        }
      } catch (error) {
        console.error("Failed to initialize game:", error)
        alert(`Failed to initialize game: ${error instanceof Error ? error.message : 'Unknown error'}`)
        router.push("/")
      } finally {
        setLoading(false)
      }
    }

    initGame()
  }, [roomId, router])

  // Handle keyboard input - ROBUST VERSION
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle movement keys
      const validKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'A', 'd', 'D', 'w', 'W', 's', 'S']
      if (!validKeys.includes(e.key)) return
      
      e.preventDefault()
      e.stopPropagation()
      
      // Convert key to movement direction
      let movement = { x: 0, y: 0 }
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        movement.x = -1
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        movement.x = 1
      } else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        movement.y = -1
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        movement.y = 1
      }
      
      // Add to movement queue if it's a valid movement
      if (movement.x !== 0 || movement.y !== 0) {
        movementQueueRef.current.push(movement)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      // Only handle movement keys
      const validKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'A', 'd', 'D', 'w', 'W', 's', 'S']
      if (!validKeys.includes(e.key)) return
      
      e.preventDefault()
      e.stopPropagation()
      
      // Clear movement queue when any key is released
      movementQueueRef.current = []
    }

    // Focus the window to ensure key events are captured
    window.focus()

    window.addEventListener("keydown", handleKeyDown, { passive: false })
    window.addEventListener("keyup", handleKeyUp, { passive: false })

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  // Add mouse/touch controls - ROBUST VERSION
  const handleCanvasClick = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!gameState || !canvasRef.current || isMoving) return

      // Clear movement queue to prevent conflicts
      movementQueueRef.current = []

      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      
      // Use actual cell size from state
      const actualCellSize = cellSize || 20
      const clickX = Math.floor((e.clientX - rect.left) / actualCellSize)
      const clickY = Math.floor((e.clientY - rect.top) / actualCellSize)

      const playerX = Math.round(gameState.player.x)
      const playerY = Math.round(gameState.player.y)

      // Calculate direction to move
      const dx = clickX - playerX
      const dy = clickY - playerY

      // Move one step in the direction of the click
      const movement = {
        x: dx > 0 ? 1 : dx < 0 ? -1 : 0,
        y: dy > 0 ? 1 : dy < 0 ? -1 : 0,
      }

      if (movement.x !== 0 || movement.y !== 0) {
        // Add to movement queue
        movementQueueRef.current.push(movement)
      }
    },
    [gameState, roomId, cellSize, isMoving],
  )

  // Set client flag after hydration to prevent hydration mismatch
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Game loop function - ROBUST VERSION
  const updateGame = useCallback(async () => {
    if (!gameState || gameState.gameStatus !== "playing" || isProcessingMovementRef.current) {
      return
    }

    // Check if we have any movement in the queue
    if (movementQueueRef.current.length === 0) return

    const now = Date.now()
    const timeSinceLastMove = now - (lastMoveTimeRef.current || 0)
    
    // Movement delay for controlled movement
    if (timeSinceLastMove < 200) return

    // Get the next movement from queue
    const movement = movementQueueRef.current.shift()!
    
    // Check if this movement would be opposite to the last movement (prevent backward movement)
    if (lastMovement) {
      const isOpposite = (movement.x !== 0 && movement.x === -lastMovement.x) || 
                        (movement.y !== 0 && movement.y === -lastMovement.y)
      if (isOpposite) {
        // Skip this movement to prevent backward movement
        return
      }
    }

    // Set processing flag to prevent overlapping movements
    isProcessingMovementRef.current = true
    setIsMoving(true)
    lastMoveTimeRef.current = now

    // Parse maze for collision detection
    let maze: number[][] = gameState.maze as any
    if (typeof maze === "string") {
      try {
        maze = JSON.parse(maze)
      } catch (e) {
        isProcessingMovementRef.current = false
        setIsMoving(false)
        return
      }
    }

    // Check for wall/obstacle before moving
    const newX = gameState.player.x + movement.x
    const newY = gameState.player.y + movement.y
    const hitWall =
      newX < 0 ||
      newX >= maze[0].length ||
      newY < 0 ||
      newY >= maze.length ||
      maze[newY][newX] === 1 ||
      gameState.obstacles.some((obs) => obs.x === newX && obs.y === newY)

    if (!hitWall) {
      // Update last movement
      setLastMovement(movement)

      // Optimistic update for immediate visual feedback
      setGameState((prev) =>
        prev
          ? {
              ...prev,
              player: { ...prev.player, x: newX, y: newY },
            }
          : prev,
      )

      // Send movement to server (non-blocking)
      fetch(`/api/rooms/${roomId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(movement),
      })
        .then((response) => {
          if (response.ok) {
            return response.json()
          }
          throw new Error("Move failed")
        })
        .then((newState) => {
          // Update with server state (includes health, score, etc.)
          setGameState(newState)
        })
        .catch((error) => {
          console.log("Move sync error:", error)
          // Keep optimistic update if server fails
        })
        .finally(() => {
          // Reset processing flags after movement completes
          setTimeout(() => {
            isProcessingMovementRef.current = false
            setIsMoving(false)
          }, 100)
        })
    } else {
      // Reset processing flags if we hit a wall
      isProcessingMovementRef.current = false
      setIsMoving(false)
    }
  }, [gameState, roomId, lastMovement])

  // Game loop - ULTRA SMOOTH VERSION
  useEffect(() => {
    if (!gameState) return

    let interval: NodeJS.Timeout | null = null
    let enemyMoveInterval: NodeJS.Timeout | null = null

    // Ultra-smooth game loop at 60 FPS
    interval = setInterval(updateGame, 16) // ~60 FPS (1000ms / 60 = 16.67ms)

    // State polling for real-time updates
    const poll = async () => {
      try {
        const response = await fetch(`/api/rooms/${roomId}/state`)
        if (response.ok) {
          const newState = await response.json()
          if (newState && !newState.error) {
            // Check if player got hit (health decreased)
            if (gameState && newState.player && newState.player.health < gameState.player.health) {
              setPlayerHit(true)
              // Reset hit effect after 1 second
              setTimeout(() => setPlayerHit(false), 1000)
            }
            
            // Update game state, preserving viewer count if it exists
            setGameState(prevState => ({
              ...newState,
              viewers: newState.viewers !== undefined ? newState.viewers : (prevState?.viewers || 0)
            }))
            
            console.log(`[Game] State updated - viewers: ${newState.viewers}, health: ${newState.player?.health}`)
          }
        } else {
          console.log(`[Game] State poll failed with status: ${response.status}`)
        }
      } catch (error) {
        console.log("State poll error:", error)
      }
    }

    // Poll state every 500ms for smoother updates
    const stateInterval = setInterval(poll, 500)

    // Enemy movement
    const moveEnemies = async () => {
      try {
        // Only call enemy movement if game is properly initialized
        if (gameState.gameStatus === "playing" && gameState.player && gameState.enemies) {
          const response = await fetch(`/api/rooms/${roomId}/enemy-move`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
          })
          if (response.ok) {
            const newState = await response.json()
            if (newState && !newState.error) {
              setGameState(newState)
            }
          }
        }
      } catch (error) {
        console.log("Enemy movement failed:", error)
      }
    }
    
    // Only start enemy movement if game is actually playing and room exists
    if (gameState.gameStatus === "playing" && gameState.player && gameState.enemies) {
      enemyMoveInterval = setInterval(moveEnemies, 5000) // Reduced from 5000ms to 5000ms (keeping same for now)
    }
    
    return () => {
      if (interval) clearInterval(interval);
      if (enemyMoveInterval) clearInterval(enemyMoveInterval);
      if (stateInterval) clearInterval(stateInterval);
    };
  }, [gameState, roomId, updateGame])

  // Ping counter: measure round-trip time for /api/ping request every 2s
  useEffect(() => {
    let cancelled = false;
    let consecutiveFailures = 0;
    const maxFailures = 3;
    
    const measurePing = async () => {
      const start = Date.now();
      try {
        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch(`/api/ping`, { 
          method: "GET",
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        // Validate response
        const data = await response.json();
        if (!data.ok || !data.timestamp) {
          throw new Error("Invalid ping response");
        }
        
        const end = Date.now();
        const pingTime = end - start;
        
        // Reset failure counter on success
        consecutiveFailures = 0;
        
        // Only update ping if it's reasonable (between 1ms and 5 seconds)
        if (!cancelled && pingTime >= 1 && pingTime < 5000) {
          setPing(pingTime);
        } else if (!cancelled) {
          console.warn(`Ping measurement out of range: ${pingTime}ms, ignoring`);
          setPing(null);
        }
      } catch (error) {
        consecutiveFailures++;
        if (!cancelled) {
          console.warn("Ping measurement failed:", error);
          
          // If we have too many consecutive failures, stop showing ping
          if (consecutiveFailures >= maxFailures) {
            setPing(null);
            console.warn("Too many ping failures, hiding ping display");
          }
        }
      }
    };
    
    const interval = setInterval(measurePing, 2000);
    measurePing(); // Initial measurement
    
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Render game - MODERN VERSION
  useEffect(() => {
    if (!gameState || !canvasRef.current) return

    // Parse maze if it's a string
    let maze: number[][] = gameState.maze;
    if (typeof maze === "string") {
      try {
        maze = JSON.parse(maze);
      } catch (e) {
        console.error("Failed to parse maze string:", e);
        return;
      }
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Calculate optimal cell size based on maze dimensions and screen size
    const maxWidth = Math.min(window.innerWidth - 100, 1000) // Leave space for UI
    const maxHeight = Math.min(window.innerHeight - 200, 800) // Leave space for UI
    const cellSize = Math.max(8, Math.min(
      maxWidth / maze[0].length,
      maxHeight / maze.length,
      30 // Maximum cell size
    ))
    
    canvas.width = maze[0].length * cellSize
    canvas.height = maze.length * cellSize

    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, "#0F172A")
    gradient.addColorStop(1, "#1E293B")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw maze with modern styling
    maze.forEach((row, y) => {
      row.forEach((cell, x) => {
        const xPos = x * cellSize
        const yPos = y * cellSize
        
        if (cell === 1) {
          // Modern wall design with gradient and shadow
          const wallGradient = ctx.createLinearGradient(xPos, yPos, xPos + cellSize, yPos + cellSize)
          wallGradient.addColorStop(0, "#6366F1")
          wallGradient.addColorStop(1, "#4F46E5")
          
          // Shadow
          ctx.fillStyle = "rgba(0, 0, 0, 0.3)"
          ctx.fillRect(xPos + 2, yPos + 2, cellSize, cellSize)
          
          // Wall
          ctx.fillStyle = wallGradient
          ctx.fillRect(xPos, yPos, cellSize, cellSize)
          
          // Highlight
          ctx.fillStyle = "rgba(255, 255, 255, 0.1)"
          ctx.fillRect(xPos, yPos, cellSize, 2)
          ctx.fillRect(xPos, yPos, 2, cellSize)
        } else {
          // Path with subtle pattern
          ctx.fillStyle = "#334155"
          ctx.fillRect(xPos, yPos, cellSize, cellSize)
          
          // Add subtle dots for path texture
          if ((x + y) % 3 === 0) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.05)"
            ctx.beginPath()
            ctx.arc(xPos + cellSize / 2, yPos + cellSize / 2, 1, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      })
    })

    // Draw goal as a beautiful flag with enhanced visibility
    const goalX = gameState.goal.x * cellSize
    const goalY = gameState.goal.y * cellSize
    const pulseSize = Math.sin(Date.now() * 0.008) * 3 + 5
    
    // Enhanced flag glow
    ctx.shadowColor = "#10B981"
    ctx.shadowBlur = 20
    
    // Flag pole shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)"
    ctx.fillRect(goalX + cellSize / 2 - 1, goalY + 3, 2, cellSize - 3)
    
    // Flag pole (thicker and more visible)
    ctx.fillStyle = "#654321"
    ctx.fillRect(goalX + cellSize / 2 - 1.5, goalY, 3, cellSize)
    
    // Flag base with gradient
    const flagGradient = ctx.createLinearGradient(goalX + cellSize / 2, goalY, goalX + cellSize, goalY)
    flagGradient.addColorStop(0, "#10B981")
    flagGradient.addColorStop(1, "#059669")
    ctx.fillStyle = flagGradient
    ctx.fillRect(goalX + cellSize / 2 + 1, goalY + 2, cellSize / 2 - 1, cellSize / 2 - 2)
    
    // Flag stripes (more visible)
    ctx.fillStyle = "#34D399"
    ctx.fillRect(goalX + cellSize / 2 + 1, goalY + 3, cellSize / 2 - 1, 3)
    ctx.fillRect(goalX + cellSize / 2 + 1, goalY + 8, cellSize / 2 - 1, 3)
    ctx.fillRect(goalX + cellSize / 2 + 1, goalY + 13, cellSize / 2 - 1, 3)
    
    // Flag pole top (larger and more visible)
    ctx.fillStyle = "#FFD700"
    ctx.beginPath()
    ctx.arc(goalX + cellSize / 2, goalY, 4, 0, Math.PI * 2)
    ctx.fill()
    
    // Add a small star on the flag
    ctx.fillStyle = "#FFFFFF"
    ctx.beginPath()
    ctx.arc(goalX + cellSize / 2 + 4, goalY + 6, 1.5, 0, Math.PI * 2)
    ctx.fill()
    
    // Flag pole highlight
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)"
    ctx.fillRect(goalX + cellSize / 2 - 1, goalY, 1, cellSize)
    
    ctx.shadowBlur = 0

    // Draw obstacles with modern design
    gameState.obstacles.forEach((obstacle) => {
      const xPos = obstacle.x * cellSize
      const yPos = obstacle.y * cellSize
      
      // Obstacle shadow
      ctx.fillStyle = "rgba(220, 38, 38, 0.3)"
      ctx.fillRect(xPos + 2, yPos + 2, cellSize, cellSize)
      
      // Obstacle gradient
      const obstacleGradient = ctx.createLinearGradient(xPos, yPos, xPos + cellSize, yPos + cellSize)
      obstacleGradient.addColorStop(0, "#EF4444")
      obstacleGradient.addColorStop(1, "#DC2626")
      
      ctx.fillStyle = obstacleGradient
      ctx.fillRect(xPos, yPos, cellSize, cellSize)
      
      // Obstacle highlight
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)"
      ctx.fillRect(xPos, yPos, cellSize, 3)
      ctx.fillRect(xPos, yPos, 3, cellSize)
    })

    // Draw enemies with ghost design
    gameState.enemies.forEach((enemy) => {
      const xPos = enemy.x * cellSize + cellSize / 2
      const yPos = enemy.y * cellSize + cellSize / 2
      const radius = Math.max(2, cellSize / 2 - 2)
      
      // Enemy glow
      ctx.shadowColor = "#EF4444"
      ctx.shadowBlur = 10
      
      // Enemy body (ghost shape)
      ctx.fillStyle = "#EF4444"
      ctx.beginPath()
      ctx.arc(xPos, yPos - 2, radius, 0, Math.PI, true)
      ctx.rect(xPos - radius, yPos - 2, radius * 2, radius + 2)
      ctx.fill()
      
      // Enemy eyes
      ctx.fillStyle = "#FFFFFF"
      ctx.beginPath()
      ctx.arc(xPos - 4, yPos - 4, 2, 0, Math.PI * 2)
      ctx.arc(xPos + 4, yPos - 4, 2, 0, Math.PI * 2)
      ctx.fill()
      
      // Enemy pupils
      ctx.fillStyle = "#000000"
      ctx.beginPath()
      ctx.arc(xPos - 4, yPos - 4, 1, 0, Math.PI * 2)
      ctx.arc(xPos + 4, yPos - 4, 1, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.shadowBlur = 0
    })

    // Draw player with Pacman design
    const playerX = gameState.player.x * cellSize + cellSize / 2
    const playerY = gameState.player.y * cellSize + cellSize / 2
    const playerRadius = cellSize / 2 - 2
    
    // Enhanced smooth movement effects
    const time = Date.now() * 0.01 // Smooth time-based animation
    const shakeOffset = playerHit ? Math.sin(time * 20) * 3 : 0
    const moveOffset = isMoving ? Math.sin(time * 30) * 1.5 : 0
    const pulseScale = isMoving ? 1 + Math.sin(time * 25) * 0.1 : 1
    const finalPlayerX = playerX + shakeOffset + moveOffset
    const finalPlayerY = playerY + shakeOffset + moveOffset
    
    // Enhanced player glow - red if hit, yellow if normal, with pulsing effect
    const glowIntensity = isMoving ? 25 : (playerHit ? 20 : 15)
    ctx.shadowColor = playerHit ? "#EF4444" : "#FBBF24"
    ctx.shadowBlur = glowIntensity + Math.sin(time * 15) * 5
    
    // Player body (Pacman shape with mouth) - red if hit, with smooth scaling
    ctx.fillStyle = playerHit ? "#EF4444" : "#FBBF24"
    ctx.save() // Save current transform
    ctx.translate(finalPlayerX, finalPlayerY)
    ctx.scale(pulseScale, pulseScale)
    ctx.beginPath()
    ctx.arc(0, 0, playerRadius, 0.2 * Math.PI, 1.8 * Math.PI)
    ctx.lineTo(0, 0)
    ctx.fill()
    ctx.restore() // Restore transform
    
    // Player eye with smooth movement
    ctx.fillStyle = "#000000"
    ctx.beginPath()
    ctx.arc(finalPlayerX - 2, finalPlayerY - 4, 2, 0, Math.PI * 2)
    ctx.fill()
    
    // Enhanced hit effect overlay if player was hit
    if (playerHit) {
      const hitPulse = Math.sin(time * 30) * 0.3 + 0.7
      ctx.fillStyle = `rgba(239, 68, 68, ${0.3 * hitPulse})`
      ctx.beginPath()
      ctx.arc(finalPlayerX, finalPlayerY, playerRadius + 4, 0, Math.PI * 2)
      ctx.fill()
    }
    
    // Enhanced movement trail effect with smooth fade
    if (isMoving) {
      const trailPulse = Math.sin(time * 25) * 0.2 + 0.3
      ctx.fillStyle = `rgba(251, 191, 36, ${0.2 * trailPulse})`
      ctx.beginPath()
      ctx.arc(finalPlayerX, finalPlayerY, playerRadius + 6, 0, Math.PI * 2)
      ctx.fill()
      
      // Additional movement particles
      for (let i = 0; i < 3; i++) {
        const particleOffset = Math.sin(time * 20 + i) * 8
        const particleAlpha = Math.sin(time * 15 + i) * 0.3 + 0.1
        ctx.fillStyle = `rgba(251, 191, 36, ${particleAlpha})`
        ctx.beginPath()
        ctx.arc(finalPlayerX + particleOffset, finalPlayerY + particleOffset, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    
    ctx.shadowBlur = 0
  }, [gameState])

  // Copy room code to clipboard
  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(roomId)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  // Share invite link
  const handleShareInvite = () => {
    const url = `${window.location.origin}/watch/${roomId}`
    if (navigator.share) {
      navigator.share({ title: "Join my MazeRunner room!", url })
    } else {
      navigator.clipboard.writeText(url)
      alert("Invite link copied!")
    }
  }

  // When gameState changes, update baseTimeLeftRef and lastUpdateRef
  useEffect(() => {
    if (gameState && typeof gameState.timeLeft === "number") {
      setDisplayTimeLeft(gameState.timeLeft)
      baseTimeLeftRef.current = gameState.timeLeft
      // Use gameState.lastUpdate if present, else now
      lastUpdateRef.current = gameState.lastUpdate || Date.now()
    }
  }, [gameState])

  // Smooth timer update every 50ms for more responsive display
  useEffect(() => {
    if (gameState?.gameStatus !== "playing") return
    const interval = setInterval(() => {
      if (baseTimeLeftRef.current != null && lastUpdateRef.current != null) {
        const elapsed = Math.floor((Date.now() - lastUpdateRef.current) / 1000)
        setDisplayTimeLeft(Math.max(0, baseTimeLeftRef.current - elapsed))
      }
    }, 50)
    return () => clearInterval(interval)
  }, [gameState?.gameStatus])

  // Presence system
  useEffect(() => {
    let heartbeat: NodeJS.Timeout | null = null
    let isActive = true
    
    const register = async () => {
      try { 
        const response = await fetch(`/api/rooms/${roomId}/presence`, { method: "POST" })
        if (response.ok) {
          console.log(`[Game] Presence registered for room: ${roomId}`)
        } else {
          console.log(`[Game] Presence registration failed with status: ${response.status}`)
        }
      } catch (error) {
        console.log("Presence registration failed:", error)
      }
    }
    
    // Only start presence system if game is loaded
    if (gameState && !loading) {
      register()
      heartbeat = setInterval(register, 15000)
    }
    
    return () => {
      isActive = false
      if (heartbeat) clearInterval(heartbeat)
      // Note: We don't unregister presence for the game player
      // The game player should not affect viewer count
    }
  }, [roomId, gameState, loading])

  // Responsive cell size calculation
  useEffect(() => {
    function updateCellSize() {
      if (!gameState || !gameState.maze) return
      let maze = gameState.maze
      if (typeof maze === "string") {
        try { maze = JSON.parse(maze) } catch { return }
      }
      const rows = maze.length
      const cols = maze[0]?.length || 1
      const padding = 32 // px
      const maxWidth = window.innerWidth - padding
      const maxHeight = window.innerHeight - 180 // leave space for UI
      const size = Math.floor(Math.min(maxWidth / cols, maxHeight / rows))
      setCellSize(size)
    }
    updateCellSize()
    window.addEventListener("resize", updateCellSize)
    return () => window.removeEventListener("resize", updateCellSize)
  }, [gameState])

  // Show celebration when game is won
  useEffect(() => {
    if (gameState?.gameStatus === "won" && !showCelebration) {
      setShowCelebration(true)
    }
  }, [gameState?.gameStatus, showCelebration])

  // Celebration Component - SPECTACULAR VERSION
  const CelebrationUI = ({ onClose }: { onClose: () => void }) => {
    const [isClient, setIsClient] = useState(false)
    const [confetti, setConfetti] = useState<Array<{x: number, y: number, vx: number, vy: number, color: string, size: number}>>([])
    const [stopBounce, setStopBounce] = useState(false)
    
    // Set client flag after hydration
    useEffect(() => {
      setIsClient(true)
    }, [])
    
    // Generate confetti particles only on client
    useEffect(() => {
      if (!isClient) return
      
      const particles = []
      const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8']
      
      for (let i = 0; i < 100; i++) {
        particles.push({
          x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 800),
          y: -20,
          vx: (Math.random() - 0.5) * 8,
          vy: Math.random() * 3 + 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 8 + 4
        })
      }
      setConfetti(particles)
    }, [isClient])
    
    // Animate confetti only on client
    useEffect(() => {
      if (!isClient) return
      
      const interval = setInterval(() => {
        setConfetti(prev => prev.map(particle => ({
          ...particle,
          x: particle.x + particle.vx,
          y: particle.y + particle.vy,
          vy: particle.vy + 0.1 // gravity
        })).filter(particle => particle.y < (typeof window !== 'undefined' ? window.innerHeight : 600) + 50))
      }, 16)
      
      return () => clearInterval(interval)
    }, [isClient])
    
    // Stop card bounce after 3 seconds
    useEffect(() => {
      const bounceTimer = setTimeout(() => {
        setStopBounce(true)
      }, 3000)
      
      return () => clearTimeout(bounceTimer)
    }, [])
    
    // Auto-close after 5 seconds
    useEffect(() => {
      const timer = setTimeout(() => {
        onClose()
      }, 5000)
      
      return () => clearTimeout(timer)
    }, [onClose])

    // Don't render until client-side
    if (!isClient) {
      return null
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-hidden">
        {/* Confetti Background */}
        <div className="absolute inset-0 pointer-events-none">
          {confetti.map((particle, i) => (
            <div
              key={i}
              className="absolute rounded-full animate-bounce"
              style={{
                left: particle.x,
                top: particle.y,
                width: particle.size,
                height: particle.size,
                backgroundColor: particle.color,
                boxShadow: `0 0 ${particle.size}px ${particle.color}`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random()}s`
              }}
            />
          ))}
        </div>

        {/* Main Celebration Card */}
        <div className={`relative bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 p-8 rounded-3xl shadow-2xl text-center max-w-md mx-4 border-4 border-white/30 backdrop-blur-sm transition-all duration-1000 ${stopBounce ? '' : 'animate-bounce'}`}>
          {/* Glowing border effect */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 blur-xl opacity-50 animate-pulse"></div>
          
          {/* Content */}
          <div className="relative z-10">
            {/* Trophy Icon with Animation */}
            <div className={`text-8xl mb-6 ${stopBounce ? '' : 'animate-bounce'}`} style={{ animationDuration: '2s' }}>
              🏆
            </div>
            
            {/* Victory Text */}
            <h1 className="text-4xl font-black text-white mb-4 drop-shadow-2xl animate-pulse">
              VICTORY!
            </h1>
            
            {/* Score Display */}
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-white/30">
              <div className="text-white/90 text-lg mb-2">Final Score</div>
              <div className="text-5xl font-black text-white drop-shadow-lg">
                {gameState?.player.score || 0}
              </div>
            </div>
            
            {/* Health Remaining */}
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-white/30">
              <div className="text-white/90 text-lg mb-2">Health Remaining</div>
              <div className="text-3xl font-bold text-green-400 drop-shadow-lg">
                ❤️ {gameState?.player.health || 0}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={onClose}
                className="bg-white/20 hover:bg-white/30 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 border border-white/30 backdrop-blur-sm"
              >
                🎮 Play Again
              </button>
              <button
                onClick={() => router.push("/")}
                className="bg-white/20 hover:bg-white/30 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 border border-white/30 backdrop-blur-sm"
              >
                🏠 Home
              </button>
            </div>
            
            {/* Celebration Message */}
            <div className="mt-6 text-white/90 text-sm animate-pulse">
              🎉 Amazing job! You conquered the maze! 🎉
            </div>
          </div>
        </div>

        {/* Floating Celebration Elements */}
        <div className="absolute top-10 left-10 text-4xl animate-bounce" style={{ animationDelay: '0.5s' }}>
          🎊
        </div>
        <div className="absolute top-20 right-20 text-3xl animate-bounce" style={{ animationDelay: '1s' }}>
          ⭐
        </div>
        <div className="absolute bottom-20 left-20 text-3xl animate-bounce" style={{ animationDelay: '1.5s' }}>
          🎈
        </div>
        <div className="absolute bottom-10 right-10 text-4xl animate-bounce" style={{ animationDelay: '2s' }}>
          🎊
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    )
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Room not found</div>
      </div>
    )
  }

  // Timer display
  const minutes = Math.floor(displayTimeLeft !== null ? displayTimeLeft / 60 : 0)
  const seconds = Math.floor(displayTimeLeft !== null ? displayTimeLeft % 60 : 0)

  // Show win popup with time left
  const showWin = gameState.gameStatus === "won"
  const showLose = gameState.gameStatus === "lost"
  


  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-4 relative overflow-hidden"
      tabIndex={0}
      onFocus={() => console.log("Game focused - ready for input!")}
      style={{ outline: "none" }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          
          <div className="text-white text-2xl font-bold flex items-center gap-3">
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-4 py-2 rounded-full font-black">
              🟡 PACMAN
            </div>
            <div className={`px-3 py-1 rounded-full font-bold text-sm ${
              difficulty === 'easy' ? 'bg-green-500 text-white' :
              difficulty === 'medium' ? 'bg-yellow-500 text-black' :
              'bg-red-500 text-white'
            }`}>
              {difficulty.toUpperCase()}
            </div>
            <span className="text-white/80">Room:</span>
            <span className="bg-white/10 px-3 py-1 rounded-lg font-mono">{roomId}</span>
            <button
              onClick={handleCopyRoomCode}
              title="Copy Room Code"
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              {copied ? (
                <Check className="h-5 w-5 text-green-400" />
              ) : (
                <Copy className="h-5 w-5 text-white/70" />
              )}
            </button>
            <button
              onClick={handleShareInvite}
              title="Share Invite Link"
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <Share2 className="h-5 w-5 text-white/70" />
            </button>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-white/90 bg-white/10 px-4 py-2 rounded-full">
              <Users className="h-4 w-4" />
              <span className="font-semibold">
                {gameState.viewers !== undefined ? gameState.viewers : 0} viewers
              </span>
            </div>
            <div className="flex items-center gap-2 text-yellow-400 font-bold text-xl bg-black/30 px-4 py-2 rounded-full">
              ⏰ {minutes}:{seconds.toString().padStart(2, "0")}
            </div>
            <div className="flex items-center gap-2 text-green-400 font-bold text-lg bg-black/30 px-4 py-2 rounded-full">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              {ping !== null ? `${ping} ms` : "-"}
            </div>
          </div>
        </div>

        {/* Win/Lose Popup */}
        {showCelebration && (
          <CelebrationUI onClose={() => {
            setShowCelebration(false)
            router.push("/")
          }} />
        )}
        
        {showLose && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/80 backdrop-blur-sm">
            <div className="bg-gradient-to-br from-red-500 to-red-700 text-white p-12 rounded-3xl shadow-2xl text-center border-4 border-red-300 animate-pulse">
              <div className="text-6xl mb-4">💀</div>
              <div className="text-4xl font-black mb-4">GAME OVER</div>
              <div className="text-xl mb-2">Final Score: <span className="font-bold text-yellow-300">{gameState.player.score}</span></div>
              <div className="text-lg mb-6">Better luck next time!</div>
              <Button 
                onClick={() => router.push("/")} 
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 px-8 text-xl rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
              >
                🎮 Try Again
              </Button>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Game Canvas */}
          <div className="lg:col-span-3">
            <Card className="bg-black/60 border-white/20 shadow-2xl">
              <CardContent className="p-6">
                <div className="text-center mb-4">
                  <h2 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">🎮 Game Arena</h2>
                  <p className="text-white/90 text-sm drop-shadow">Click on the maze or use arrow keys/WASD to move</p>
                </div>
                <div className="flex justify-center overflow-auto">
                  <div className="inline-block">
                    <canvas
                      ref={canvasRef}
                      onClick={handleCanvasClick}
                      className="border-4 border-yellow-400 rounded-2xl shadow-2xl cursor-pointer bg-black max-w-full"
                      style={{ imageRendering: "pixelated" }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {gameState.gameStatus !== "playing" && (
              <Card className="bg-black/60 border-white/20 mt-6 shadow-2xl">
                <CardContent className="p-8 text-center">
                  <div className="text-3xl font-bold text-white mb-4 drop-shadow-lg">
                    {gameState.gameStatus === "won" ? "🎉 You Won!" : "💀 Game Over"}
                  </div>
                  <div className="text-gray-200 mb-6 text-lg drop-shadow">Final Score: <span className="font-bold text-yellow-400">{gameState.player.score}</span></div>
                  <Button 
                    onClick={() => router.push("/")} 
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
                  >
                    🎮 Play Again
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Player Stats */}
            <Card className="bg-yellow-400/30 backdrop-blur-sm border-yellow-400/50 shadow-xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2 text-xl font-black drop-shadow-lg">
                  <div className="text-3xl">🟡</div>
                  Player Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm text-white mb-2 drop-shadow">
                    <span className={`font-semibold ${playerHit ? 'text-red-400 animate-pulse' : ''}`}>❤️ Health</span>
                    <span className={`font-bold ${playerHit ? 'text-red-400' : ''}`}>{gameState.player.health}/100</span>
                  </div>
                  <Progress 
                    value={gameState.player.health} 
                    className={`h-3 ${playerHit ? 'bg-red-500/50' : 'bg-white/30'}`} 
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm text-white mb-2 drop-shadow">
                    <span className="font-semibold">⚡ Speed</span>
                    <span className="font-bold">{Math.round(gameState.player.speed * 100)}%</span>
                  </div>
                  <Progress value={gameState.player.speed * 100} className="h-3 bg-white/30" />
                </div>
                <div className="text-center bg-gradient-to-r from-yellow-400 to-orange-500 text-black py-4 rounded-xl font-black text-2xl drop-shadow">
                  🏆 {gameState.player.score}
                </div>
              </CardContent>
            </Card>

            {/* Controls */}
            <Card className="bg-black/60 border-white/20 shadow-xl">
              <CardHeader>
                <CardTitle className="text-white text-xl font-bold drop-shadow-lg">🎮 Controls</CardTitle>
              </CardHeader>
              <CardContent className="text-white text-sm space-y-3">
                <div className="flex items-center gap-2">
                  <div className="bg-white/20 px-2 py-1 rounded font-mono">↑↓←→</div>
                  <span>Arrow keys to move</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-white/20 px-2 py-1 rounded font-mono">WASD</div>
                  <span>Alternative movement</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-white/20 px-2 py-1 rounded">🖱️</div>
                  <span>Click maze to move</span>
                </div>
                <div className="border-t border-white/30 pt-3 mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span>Goal (reach this)</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                    <span>Avoid ghosts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-600 rounded"></div>
                    <span>Navigate obstacles</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Viewer Actions */}
            <Card className="bg-purple-400/30 backdrop-blur-sm border-purple-400/50 shadow-xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2 text-xl font-bold drop-shadow-lg">
                  <Zap className="h-5 w-5 text-yellow-400" />
                  Viewer Sabotage
                </CardTitle>
              </CardHeader>
              <CardContent className="text-white text-sm">
                <div className="mb-3 drop-shadow">👻 Viewers can sabotage you!</div>
                <div className="bg-black/40 p-3 rounded-lg border border-white/20">
                  <div className="text-xs text-white/80 mb-1">Share room ID:</div>
                  <div className="font-mono bg-white/20 px-2 py-1 rounded text-center text-yellow-400 font-bold drop-shadow">
                    {roomId}
                  </div>
                </div>
                <div className="mt-3 text-xs text-white/80 drop-shadow">
                  Viewers can slow you down, spawn ghosts, or block your path!
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
