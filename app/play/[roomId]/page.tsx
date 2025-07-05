"use client"

import type React from "react"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, Users, Heart, Zap, Copy, Share2, Check } from "lucide-react"
import { usePetraWallet } from "@/hooks/use-petra-wallet"

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
          body: JSON.stringify({ difficulty }),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerWallet: playerWallet.address }),
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
  }, [roomId, router, playerWallet.address])

  // Handle keyboard input - SIMPLIFIED VERSION
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle movement keys
      const validKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'A', 'd', 'D', 'w', 'W', 's', 'S']
      if (!validKeys.includes(e.key)) return
      
      e.preventDefault()
      e.stopPropagation()
      
      // Add key to set
      setKeys((prev) => {
        const newKeys = new Set(prev)
        newKeys.add(e.key)
        return newKeys
      })
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      // Only handle movement keys
      const validKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'A', 'd', 'D', 'w', 'W', 's', 'S']
      if (!validKeys.includes(e.key)) return
      
      e.preventDefault()
      e.stopPropagation()
      
      // Remove key from set
      setKeys((prev) => {
        const newKeys = new Set(prev)
        newKeys.delete(e.key)
        return newKeys
      })
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

  // Add mouse/touch controls - SIMPLIFIED VERSION
  const handleCanvasClick = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!gameState || !canvasRef.current) return

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
        // Parse maze for collision detection
        let maze: number[][] = gameState.maze as any
        if (typeof maze === "string") {
          try {
            maze = JSON.parse(maze)
          } catch (e) {
            return
          }
        }

        // Check for wall/obstacle before moving
        let obstacles = gameState.obstacles || [];
        const newX = gameState.player.x + movement.x
        const newY = gameState.player.y + movement.y
        const hitWall =
          newX < 0 ||
          newX >= maze[0].length ||
          newY < 0 ||
          newY >= maze.length ||
          maze[newY][newX] === 1 ||
          obstacles.some((obs) => obs.x === newX && obs.y === newY)

        if (!hitWall) {
          // Check if we can move (prevent rapid movement)
          const now = Date.now()
          if (now - (lastMoveTimeRef.current || 0) < 50) { // 50ms delay between moves for smoother movement
            return
          }
          
          // Update last move time
          lastMoveTimeRef.current = now

          // Send movement to server
          try {
            const response = await fetch(`/api/rooms/${roomId}/move`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(movement),
            })
            
            if (response.ok) {
              const newState = await response.json()
              setGameState(newState)
            } else {
              // If server request failed, still move locally
              setGameState((prev) =>
                prev
                  ? {
                      ...prev,
                      player: { ...prev.player, x: newX, y: newY },
                    }
                  : prev,
              )
            }
          } catch (error) {
            console.log("Click movement sync error:", error)
            // Move locally even if server fails
            setGameState((prev) =>
              prev
                ? {
                    ...prev,
                    player: { ...prev.player, x: newX, y: newY },
                  }
                : prev,
            )
          }
        }
      }
    },
    [gameState, roomId, cellSize],
  )

  // Set client flag after hydration to prevent hydration mismatch
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Game loop function - ULTRA SMOOTH VERSION
  const updateGame = useCallback(async () => {
    if (!gameState || gameState.gameStatus !== "playing") {
      return
    }
    
    // Only process movement if keys are pressed
    if (keys.size === 0) {
      return
    }

    // Parse maze if it's a string
    let maze: number[][] = gameState.maze as any
    if (typeof maze === "string") {
      try {
        maze = JSON.parse(maze)
      } catch (e) {
        return
      }
    }

    // Check if we can move (prevent rapid movement)
    const now = Date.now()
    if (now - (lastMoveTimeRef.current || 0) < 50) { // 50ms delay between moves for smoother movement
      return
    }

    const movement = { x: 0, y: 0 }
    
    // Simple priority system: horizontal first, then vertical
    if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) {
      movement.x = -1
    } else if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) {
      movement.x = 1
    }
    
    if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) {
      movement.y = -1
    } else if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) {
      movement.y = 1
    }

    // Only move if there's actual movement
    if (movement.x !== 0 || movement.y !== 0) {
      // Check for wall/obstacle before moving
      let obstacles = gameState.obstacles || [];
      const newX = gameState.player.x + movement.x
      const newY = gameState.player.y + movement.y
      const hitWall =
        newX < 0 ||
        newX >= maze[0].length ||
        newY < 0 ||
        newY >= maze.length ||
        maze[newY][newX] === 1 ||
        obstacles.some((obs) => obs.x === newX && obs.y === newY)
      
      if (!hitWall) {
        // Update last move time
        lastMoveTimeRef.current = now
        
        // Set moving state for visual feedback
        setIsMoving(true)
        setTimeout(() => setIsMoving(false), 50) // Shorter feedback for smoother feel
        
        // Send movement to server
        try {
          const response = await fetch(`/api/rooms/${roomId}/move`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(movement),
          })
          
          if (response.ok) {
            const newState = await response.json()
            setGameState(newState)
          } else {
            // If server request failed, still move locally
            setGameState((prev) =>
              prev
                ? {
                    ...prev,
                    player: { ...prev.player, x: newX, y: newY },
                  }
                : prev,
            )
          }
        } catch (error) {
          console.log("Movement sync error:", error)
          // Move locally even if server fails
          setGameState((prev) =>
            prev
              ? {
                  ...prev,
                  player: { ...prev.player, x: newX, y: newY },
                }
              : prev,
          )
        }
      }
    }
  }, [gameState, keys, roomId])

  // Game loop - ULTRA SMOOTH VERSION
  useEffect(() => {
    if (gameState?.gameStatus === "playing") {
      gameLoopRef.current = window.setInterval(updateGame, 16) // 60 FPS for ultra-smooth movement
    } else {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
        gameLoopRef.current = null
      }
    }
    
    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
        gameLoopRef.current = null
      }
    }
  }, [gameState?.gameStatus, updateGame])

  // Poll for sabotage/game events at optimized frequency
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    let enemyMoveInterval: NodeJS.Timeout | null = null;
    
    if (gameState?.gameStatus === "playing") {
      const poll = async () => {
        try {
          const response = await fetch(`/api/rooms/${roomId}/state`)
          if (response.ok) {
            const serverState = await response.json()
            // Handle waiting state
            if (serverState.gameStatus === "waiting") {
              console.log("Room is waiting for initialization")
              return
            }
            
            // Check if player got hit (health decreased)
            if (serverState.player.health < gameState.player.health) {
              setPlayerHit(true)
              // Reset hit effect after 1 second
              setTimeout(() => setPlayerHit(false), 1000)
            }
            
            // Only update if something important changed
            if (
              serverState.gameStatus !== gameState.gameStatus ||
              serverState.player.health !== gameState.player.health ||
              serverState.enemies.length !== gameState.enemies.length ||
              serverState.obstacles.length !== gameState.obstacles.length ||
              serverState.timeLeft !== gameState.timeLeft
            ) {
              setGameState(serverState)
            }
          }
        } catch {}
      }
      
      // Poll every 1 second for important updates (health, enemies, obstacles, timer)
      interval = setInterval(poll, 1000)
      
      // Move enemies independently every 2 seconds for smoother gameplay
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
        enemyMoveInterval = setInterval(moveEnemies, 2000)
      }
    }
    
    return () => {
      if (interval) clearInterval(interval);
      if (enemyMoveInterval) clearInterval(enemyMoveInterval);
    };
  }, [gameState, roomId])

  // Ping counter: measure round-trip time for /api/ping request every 2s
  useEffect(() => {
    let cancelled = false;
    const measurePing = async () => {
      const start = Date.now();
      try {
        await fetch(`/api/ping`, { method: "GET" });
        const end = Date.now();
        if (!cancelled) setPing(end - start);
      } catch {
        if (!cancelled) setPing(null);
      }
    };
    const interval = setInterval(measurePing, 2000);
    measurePing();
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
    const cellSize = Math.min(
      maxWidth / maze[0].length,
      maxHeight / maze.length,
      30 // Maximum cell size
    )
    
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
      const radius = cellSize / 2 - 2
      
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
    
    // Add shake effect if player was hit, and movement effect
    const shakeOffset = playerHit ? (Math.random() - 0.5) * 4 : 0
    const moveOffset = isMoving ? (Math.random() - 0.5) * 2 : 0
    const finalPlayerX = playerX + shakeOffset + moveOffset
    const finalPlayerY = playerY + shakeOffset + moveOffset
    
    // Player glow - red if hit, yellow if normal
    ctx.shadowColor = playerHit ? "#EF4444" : "#FBBF24"
    ctx.shadowBlur = playerHit ? 20 : 15
    
    // Player body (Pacman shape with mouth) - red if hit
    ctx.fillStyle = playerHit ? "#EF4444" : "#FBBF24"
    ctx.beginPath()
    ctx.arc(finalPlayerX, finalPlayerY, playerRadius, 0.2 * Math.PI, 1.8 * Math.PI)
    ctx.lineTo(finalPlayerX, finalPlayerY)
    ctx.fill()
    
    // Player eye
    ctx.fillStyle = "#000000"
    ctx.beginPath()
    ctx.arc(finalPlayerX - 2, finalPlayerY - 4, 2, 0, Math.PI * 2)
    ctx.fill()
    
    // Add hit effect overlay if player was hit
    if (playerHit) {
      ctx.fillStyle = "rgba(239, 68, 68, 0.3)"
      ctx.beginPath()
      ctx.arc(finalPlayerX, finalPlayerY, playerRadius + 4, 0, Math.PI * 2)
      ctx.fill()
    }
    
    // Add movement trail effect
    if (isMoving) {
      ctx.fillStyle = "rgba(251, 191, 36, 0.2)"
      ctx.beginPath()
      ctx.arc(finalPlayerX, finalPlayerY, playerRadius + 6, 0, Math.PI * 2)
      ctx.fill()
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
        await fetch(`/api/rooms/${roomId}/presence`, { method: "POST" }) 
      } catch (error) {
        console.log("Presence registration failed:", error)
      }
    }
    
    const unregister = async () => {
      try { 
        await fetch(`/api/rooms/${roomId}/presence`, { method: "DELETE" }) 
      } catch (error) {
        console.log("Presence unregistration failed:", error)
      }
    }
    
    // Only start presence system if game is loaded
    if (gameState && !loading) {
      register()
      heartbeat = setInterval(register, 15000)
    }
    
    window.addEventListener("beforeunload", unregister)
    return () => {
      isActive = false
      if (heartbeat) clearInterval(heartbeat)
      unregister()
      window.removeEventListener("beforeunload", unregister)
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

  // Celebration Component - SIMPLIFIED VERSION
  const CelebrationUI = ({ onClose }: { onClose: () => void }) => {
    const [isClient, setIsClient] = useState(false)
    
    // Set client flag after hydration
    useEffect(() => {
      setIsClient(true)
    }, [])
    
    // Auto-close after 3 seconds
    useEffect(() => {
      const timer = setTimeout(() => {
        onClose()
      }, 3000)
      
      return () => clearTimeout(timer)
    }, [onClose])

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        {/* Simple Celebration Card */}
        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-6 rounded-2xl shadow-xl text-center max-w-sm mx-4 animate-bounce">
          <div className="text-6xl mb-4">
            🏆
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2">
            Victory!
          </h1>
          
          <p className="text-white/90 mb-4">
            Score: {gameState?.player.score || 0}
          </p>
          
          <button
            onClick={onClose}
            className="bg-white/20 hover:bg-white/30 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200"
          >
            Continue
          </button>
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
              <span className="font-semibold">{gameState.viewers} viewers</span>
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
