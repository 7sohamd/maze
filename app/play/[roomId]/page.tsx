"use client"

import type React from "react"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<number | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [keys, setKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [ping, setPing] = useState<number | null>(null)
  const isMovingRef = useRef(false)
  const [displayTimeLeft, setDisplayTimeLeft] = useState<number | null>(null)
  const lastUpdateRef = useRef<number | null>(null)
  const baseTimeLeftRef = useRef<number | null>(null)
  const isKeyDownRef = useRef(false)
  const [cellSize, setCellSize] = useState(20)
  const [copied, setCopied] = useState(false)
  const playerWallet = usePetraWallet()

  // Initialize game
  useEffect(() => {
    const initGame = async () => {
      try {
        console.log("Initializing game for room:", roomId)
        
        // First, check if the room exists
        const roomCheckResponse = await fetch(`/api/rooms/${roomId}`)
        console.log("Room check status:", roomCheckResponse.status)
        
        if (!roomCheckResponse.ok) {
          console.error("Room does not exist")
          alert("Room not found. Please create a new room.")
          router.push("/")
          return
        }
        
        const response = await fetch(`/api/rooms/${roomId}/start`, {
          method: "POST",
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

  // Handle keyboard input - IMPROVED VERSION
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      setKeys((prev) => new Set(prev).add(e.key))
      isKeyDownRef.current = true
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault()
      setKeys((prev) => {
        const newKeys = new Set(prev)
        newKeys.delete(e.key)
        return newKeys
      })
      isKeyDownRef.current = false
    }

    // Focus the window to ensure key events are captured
    window.focus()

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  // Add mouse/touch controls for v0 preview
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!gameState || !canvasRef.current) return

      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      const cellSize = 20

      const clickX = Math.floor((e.clientX - rect.left) / cellSize)
      const clickY = Math.floor((e.clientY - rect.top) / cellSize)

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
        fetch(`/api/rooms/${roomId}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(movement),
        })
          .then((response) => {
            if (response.ok) {
              return response.json()
            }
          })
          .then((newState) => {
            if (newState) setGameState(newState)
          })
          .catch(console.error)
      }
    },
    [gameState, roomId],
  )

  // Game loop - IMPROVED VERSION
  const updateGame = useCallback(async () => {
    if (!gameState || gameState.gameStatus !== "playing") {
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

    const movement = { x: 0, y: 0 }
    if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) movement.x = -1
    if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) movement.x = 1
    if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) movement.y = -1
    if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) movement.y = 1

    if ((movement.x !== 0 || movement.y !== 0) && !isMovingRef.current) {
      // Optimistic movement: check for wall/obstacle and update local state immediately
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
        setGameState((prev) =>
          prev
            ? {
                ...prev,
                player: { ...prev.player, x: newX, y: newY },
              }
            : prev,
        )
      }
      // Throttle: mark as moving
      isMovingRef.current = true
      try {
        const response = await fetch(`/api/rooms/${roomId}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(movement),
        })
        if (response.ok) {
          const newState = await response.json()
          // Only correct if server disagrees (e.g., move rejected, enemy, sabotage, etc.)
          if (
            newState.player.x !== newX ||
            newState.player.y !== newY ||
            newState.gameStatus !== gameState.gameStatus ||
            newState.player.health !== gameState.player.health
          ) {
            setGameState(newState)
          }
        }
      } catch (error) {
        // Optionally: revert optimistic update if server fails
      } finally {
        // Allow next movement
        isMovingRef.current = false
      }
    }
  }, [gameState, keys, roomId])

  // Poll for sabotage/game events at a lower frequency (every 1s)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (gameState?.gameStatus === "playing") {
      const poll = async () => {
        try {
          const response = await fetch(`/api/rooms/${roomId}/state`)
          if (response.ok) {
            const serverState = await response.json()
            // Only update if something important changed
            if (
              serverState.gameStatus !== gameState.gameStatus ||
              serverState.player.health !== gameState.player.health ||
              serverState.enemies.length !== gameState.enemies.length ||
              serverState.obstacles.length !== gameState.obstacles.length
            ) {
              setGameState(serverState)
            }
          }
        } catch {}
      }
      // Poll every 1s if idle, every 3s if moving
      interval = setInterval(() => {
        if (isKeyDownRef.current || isMovingRef.current) {
          // Slow polling when moving
          if (interval) clearInterval(interval)
          interval = setInterval(poll, 3000)
        } else {
          // Fast polling when idle
          if (interval) clearInterval(interval)
          interval = setInterval(poll, 1000)
        }
        poll()
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval);
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

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (gameState?.gameStatus === "playing") {
      gameLoopRef.current = window.setInterval(updateGame, 100)
    } else {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    }
  }, [updateGame, gameState?.gameStatus])

  // Render game - IMPROVED VERSION
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

    const cellSize = 20
    canvas.width = maze[0].length * cellSize
    canvas.height = maze.length * cellSize

    // Clear canvas with dark gray background
    ctx.fillStyle = "#1F2937"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw maze
    maze.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell === 1) {
          // Walls are blue
          ctx.fillStyle = "#4F46E5"
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
        } else {
          // Paths are light gray
          ctx.fillStyle = "#374151"
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
        }
      })
    })

    // Draw goal
    ctx.fillStyle = "#10B981"
    ctx.fillRect(gameState.goal.x * cellSize + 2, gameState.goal.y * cellSize + 2, cellSize - 4, cellSize - 4)

    // Draw obstacles
    gameState.obstacles.forEach((obstacle) => {
      ctx.fillStyle = "#DC2626"
      ctx.fillRect(obstacle.x * cellSize + 1, obstacle.y * cellSize + 1, cellSize - 2, cellSize - 2)
    })

    // Draw enemies
    gameState.enemies.forEach((enemy) => {
      ctx.fillStyle = "#EF4444"
      ctx.beginPath()
      ctx.arc(enemy.x * cellSize + cellSize / 2, enemy.y * cellSize + cellSize / 2, cellSize / 3, 0, Math.PI * 2)
      ctx.fill()
    })

    // Draw player
    ctx.fillStyle = "#FBBF24"
    ctx.beginPath()
    ctx.arc(
      gameState.player.x * cellSize + cellSize / 2,
      gameState.player.y * cellSize + cellSize / 2,
      cellSize / 2 - 2,
      0,
      Math.PI * 2,
    )
    ctx.fill()
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

  // Smooth timer update every 100ms
  useEffect(() => {
    if (gameState?.gameStatus !== "playing") return
    const interval = setInterval(() => {
      if (baseTimeLeftRef.current != null && lastUpdateRef.current != null) {
        const elapsed = Math.floor((Date.now() - lastUpdateRef.current) / 1000)
        setDisplayTimeLeft(Math.max(0, baseTimeLeftRef.current - elapsed))
      }
    }, 100)
    return () => clearInterval(interval)
  }, [gameState?.gameStatus])

  // Presence system
  useEffect(() => {
    let heartbeat: NodeJS.Timeout | null = null
    let isActive = true
    const register = async () => {
      try { await fetch(`/api/rooms/${roomId}/presence`, { method: "POST" }) } catch {}
    }
    const unregister = async () => {
      try { await fetch(`/api/rooms/${roomId}/presence`, { method: "DELETE" }) } catch {}
    }
    register()
    heartbeat = setInterval(register, 15000)
    window.addEventListener("beforeunload", unregister)
    return () => {
      isActive = false
      if (heartbeat) clearInterval(heartbeat)
      unregister()
      window.removeEventListener("beforeunload", unregister)
    }
  }, [roomId])

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
      className="min-h-screen bg-gray-900 p-4"
      tabIndex={0}
      onFocus={() => console.log("Game focused - ready for input!")}
      style={{ outline: "none" }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Player Petra Wallet Connect Section */}
        <div className="mb-6">
          <div className="bg-gray-800 border border-gray-700 rounded p-4 max-w-md">
            <div className="font-bold text-white mb-2">Player Petra Wallet</div>
            {playerWallet.isConnected ? (
              <>
                <div className="text-xs text-gray-400 break-all">{playerWallet.address}</div>
                <div className="text-yellow-400 font-bold">{playerWallet.balance ?? '...'} APT</div>
                <button onClick={playerWallet.disconnect} className="mt-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded">Disconnect</button>
              </>
            ) : (
              <button
                onClick={playerWallet.connect}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                disabled={playerWallet.loading}
              >
                {playerWallet.loading ? "Connecting..." : "Connect Petra Wallet"}
              </button>
            )}
            {playerWallet.error && (
              <div className="text-red-400 text-xs mt-2">{playerWallet.error}</div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mb-6">
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          <div className="text-white text-xl font-bold flex items-center gap-2">
            Room: {roomId}
            <button
              onClick={handleCopyRoomCode}
              title="Copy Room Code"
              className="p-1 rounded hover:bg-gray-700"
              style={{ lineHeight: 0 }}
            >
              {copied ? (
                <Check className="h-5 w-5 text-green-400" />
              ) : (
                <Copy className="h-5 w-5 text-gray-300" />
              )}
            </button>
            <button
              onClick={handleShareInvite}
              title="Share Invite Link"
              className="p-1 rounded hover:bg-gray-700"
              style={{ lineHeight: 0 }}
            >
              <Share2 className="h-5 w-5 text-gray-300" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-white">
            <Users className="h-4 w-4" />
            {gameState.viewers} viewers
          </div>
          <div className="flex items-center gap-2 text-yellow-400 font-bold text-lg">
            ⏰ {minutes}:{seconds.toString().padStart(2, "0")} left
          </div>
          <div className="flex items-center gap-2 text-green-400 font-bold text-lg">
            Ping: {ping !== null ? `${ping} ms` : "-"}
          </div>
        </div>
        {/* Win/Lose Popup */}
        {showWin && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-green-900 text-white p-8 rounded-lg shadow-lg text-center">
              <div className="text-3xl font-bold mb-2">🎉 You Won!</div>
              <div className="text-lg mb-2">Final Score: {gameState.player.score}</div>
              <div className="text-lg mb-2">Time Left: {minutes}:{seconds.toString().padStart(2, "0")} seconds</div>
              <Button onClick={() => router.push("/")} className="bg-blue-600 hover:bg-blue-700 mt-4">
                Play Again
              </Button>
            </div>
          </div>
        )}
        {showLose && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-red-900 text-white p-8 rounded-lg shadow-lg text-center">
              <div className="text-3xl font-bold mb-2">💀 Game Over</div>
              <div className="text-lg mb-2">Final Score: {gameState.player.score}</div>
              <Button onClick={() => router.push("/")} className="bg-blue-600 hover:bg-blue-700 mt-4">
                Play Again
              </Button>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  className="border border-gray-600 mx-auto block cursor-pointer"
                  style={{ imageRendering: "pixelated" }}
                />
              </CardContent>
            </Card>

            {gameState.gameStatus !== "playing" && (
              <Card className="bg-gray-800 border-gray-700 mt-4">
                <CardContent className="p-6 text-center">
                  <div className="text-2xl font-bold text-white mb-2">
                    {gameState.gameStatus === "won" ? "🎉 You Won!" : "💀 Game Over"}
                  </div>
                  <div className="text-gray-300 mb-4">Final Score: {gameState.player.score}</div>
                  <Button onClick={() => router.push("/")} className="bg-blue-600 hover:bg-blue-700">
                    Play Again
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-400" />
                  Player Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm text-gray-300 mb-1">
                    <span>Health</span>
                    <span>{gameState.player.health}/100</span>
                  </div>
                  <Progress value={gameState.player.health} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm text-gray-300 mb-1">
                    <span>Speed</span>
                    <span>{Math.round(gameState.player.speed * 100)}%</span>
                  </div>
                  <Progress value={gameState.player.speed * 100} className="h-2" />
                </div>
                <div className="text-white">
                  <div className="text-sm text-gray-300">Score</div>
                  <div className="text-2xl font-bold">{gameState.player.score}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Controls</CardTitle>
              </CardHeader>
              <CardContent className="text-gray-300 text-sm space-y-2">
                <div>↑↓←→ Arrow keys OR WASD to move</div>
                <div>🖱️ Click on the maze to move toward that direction</div>
                <div>🎯 Reach the green goal</div>
                <div>❤️ Avoid red enemies</div>
                <div>🧱 Navigate around obstacles</div>
                <div className="text-xs text-yellow-400 mt-2">Click anywhere on the game area if keys don't work!</div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-400" />
                  Viewer Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="text-gray-300 text-sm">
                <div>Viewers can sabotage you!</div>
                <div className="mt-2 text-xs text-gray-400">
                  Share room ID: <span className="font-mono bg-gray-700 px-1 rounded">{roomId}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
