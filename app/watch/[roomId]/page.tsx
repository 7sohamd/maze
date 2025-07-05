"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, Eye, Coins, Zap, Mic } from "lucide-react"

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
  gameStatus: "playing" | "won" | "lost" | "waiting"
  viewers: number
  timeLeft: number
}

interface SabotageAction {
  id: string
  name: string
  cost: number
  icon: string
  description: string
  cooldown: number
}

export default function WatchPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.roomId as string
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [balance, setBalance] = useState(1000)
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [blockedSabotages, setBlockedSabotages] = useState<Record<string, boolean>>({})
  const [sabotageMessage, setSabotageMessage] = useState<string | null>(null)
  const [geminiInput, setGeminiInput] = useState("")
  const [geminiLoading, setGeminiLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)

  const sabotageActions: SabotageAction[] = [
    {
      id: "slow",
      name: "Slow Down",
      cost: 0.05,
      icon: "🐌",
      description: "Reduce speed by 30%",
      cooldown: 10000,
    },
    {
      id: "block",
      name: "Block Path",
      cost: 0.08,
      icon: "🧱",
      description: "Place obstacle",
      cooldown: 15000,
    },
    {
      id: "damage",
      name: "Damage",
      cost: 0.1,
      icon: "💔",
      description: "Reduce health",
      cooldown: 12000,
    },
    {
      id: "enemy",
      name: "Spawn Enemy",
      cost: 0.1,
      icon: "👹",
      description: "Spawn enemy",
      cooldown: 20000,
    },
  ]

  // Check voice support and poll for game state
  useEffect(() => {
    // Check if voice input is supported
    setVoiceSupported('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
    
    const pollGameState = async () => {
      try {
        const response = await fetch(`/api/rooms/${roomId}/state`)
        if (response.ok) {
          const state = await response.json()
          console.log("Game state received:", state)
          
          // Handle waiting state - show waiting message but don't set gameState to null
          if (state.gameStatus === "waiting") {
            console.log("Room is waiting for player to start the game")
            setGameState({
              ...state,
              player: { x: 0, y: 0, health: 100, speed: 1, score: 0 },
              enemies: [],
              obstacles: [],
              goal: { x: 0, y: 0 },
              maze: [],
              viewers: state.viewers || 0,
              timeLeft: 0
            })
            setLoading(false)
          } else {
            setGameState(state)
            setLoading(false)
          }
        } else if (response.status === 404) {
          console.log("Room not found")
          setGameState(null)
          setLoading(false)
        }
      } catch (error) {
        console.error("Failed to fetch game state:", error)
        setLoading(false)
      }
    }

    // Register presence for this viewer
    const registerPresence = async () => {
      try {
        const response = await fetch(`/api/rooms/${roomId}/presence`, { method: "POST" })
        if (response.ok) {
          console.log("Presence registered successfully for room:", roomId)
        }
      } catch (error) {
        console.error("Failed to register presence:", error)
      }
    }

    pollGameState()
    registerPresence()
    const interval = setInterval(pollGameState, 100) // Ultra-fast polling for real-time viewing
    const presenceInterval = setInterval(registerPresence, 15000) // Register presence every 15s

    return () => {
      clearInterval(interval)
      clearInterval(presenceInterval)
      // Unregister presence when leaving
      fetch(`/api/rooms/${roomId}/presence`, { method: "DELETE" }).catch(console.error)
    }
  }, [roomId, router])

  // Update cooldowns
  useEffect(() => {
    const interval = setInterval(() => {
      setCooldowns((prev) => {
        const updated = { ...prev }
        Object.keys(updated).forEach((key) => {
          updated[key] = Math.max(0, updated[key] - 1000)
        })
        return updated
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])
  
  // Show celebration when player wins
  useEffect(() => {
    if (gameState?.gameStatus === "won" && !showCelebration) {
      setShowCelebration(true)
      // Auto-hide celebration after 5 seconds
      setTimeout(() => setShowCelebration(false), 5000)
    }
  }, [gameState?.gameStatus, showCelebration])

  // Render game - MODERN VERSION
  useEffect(() => {
    if (!gameState || !canvasRef.current) return

    // Parse maze if it's a string
    let maze: number[][] = gameState.maze as any
    if (typeof maze === "string") {
      try {
        maze = JSON.parse(maze)
      } catch (e) {
        return
      }
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Calculate optimal cell size based on maze dimensions
    const maxWidth = 800 // Maximum canvas width
    const maxHeight = 600 // Maximum canvas height
    const cellSize = Math.min(
      maxWidth / maze[0].length,
      maxHeight / maze.length,
      20 // Maximum cell size
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
      ctx.fillRect(xPos, yPos, cellSize, 2)
      ctx.fillRect(xPos, yPos, 2, cellSize)
    })

    // Draw enemies with ghost design
    gameState.enemies.forEach((enemy) => {
      const xPos = enemy.x * cellSize + cellSize / 2
      const yPos = enemy.y * cellSize + cellSize / 2
      const radius = cellSize / 2 - 2
      
      // Enemy glow
      ctx.shadowColor = "#EF4444"
      ctx.shadowBlur = 8
      
      // Enemy body (ghost shape)
      ctx.fillStyle = "#EF4444"
      ctx.beginPath()
      ctx.arc(xPos, yPos - 2, radius, 0, Math.PI, true)
      ctx.rect(xPos - radius, yPos - 2, radius * 2, radius + 2)
      ctx.fill()
      
      // Enemy eyes
      ctx.fillStyle = "#FFFFFF"
      ctx.beginPath()
      ctx.arc(xPos - 3, yPos - 3, 1.5, 0, Math.PI * 2)
      ctx.arc(xPos + 3, yPos - 3, 1.5, 0, Math.PI * 2)
      ctx.fill()
      
      // Enemy pupils
      ctx.fillStyle = "#000000"
      ctx.beginPath()
      ctx.arc(xPos - 3, yPos - 3, 0.8, 0, Math.PI * 2)
      ctx.arc(xPos + 3, yPos - 3, 0.8, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.shadowBlur = 0
    })

    // Draw player with Pacman design
    const playerX = gameState.player.x * cellSize + cellSize / 2
    const playerY = gameState.player.y * cellSize + cellSize / 2
    const playerRadius = cellSize / 2 - 2
    
    // Player glow
    ctx.shadowColor = "#FBBF24"
    ctx.shadowBlur = 12
    
    // Player body (Pacman shape with mouth)
    ctx.fillStyle = "#FBBF24"
    ctx.beginPath()
    ctx.arc(playerX, playerY, playerRadius, 0.2 * Math.PI, 1.8 * Math.PI)
    ctx.lineTo(playerX, playerY)
    ctx.fill()
    
    // Player eye
    ctx.fillStyle = "#000000"
    ctx.beginPath()
    ctx.arc(playerX - 1.5, playerY - 3, 1.5, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.shadowBlur = 0
  }, [gameState])

  const executeSabotage = async (action: SabotageAction) => {
    if (balance < action.cost || cooldowns[action.id] > 0 || blockedSabotages[action.id]) return
    try {
      const response = await fetch(`/api/rooms/${roomId}/sabotage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action.id }),
      })
      if (response.ok) {
        setBalance((prev) => prev - action.cost)
        setCooldowns((prev) => ({ ...prev, [action.id]: action.cooldown }))
        setSabotageMessage(null)
      } else if (response.status === 400) {
        const data = await response.json()
        setSabotageMessage(data.error || "This sabotage is currently blocked.")
        setBlockedSabotages((prev) => ({ ...prev, [action.id]: true }))
        setTimeout(() => setBlockedSabotages((prev) => ({ ...prev, [action.id]: false })), 4000)
      }
    } catch (error) {
      setSabotageMessage("Failed to execute sabotage.")
    }
  };

  const handleGeminiSabotage = async () => {
    if (!geminiInput.trim()) return
    setGeminiLoading(true)
    setSabotageMessage(null)
    try {
      const res = await fetch(`/api/rooms/${roomId}/sabotage/gemini`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: geminiInput }),
      })
      const data = await res.json()
      if (res.ok && data.sabotage) {
        // Find the action object for cost/cooldown
        const action = sabotageActions.find(a => a.id === data.sabotage.id)
        if (!action) {
          setSabotageMessage("Matched sabotage is not available.")
        } else if (cooldowns[action.id] > 0) {
          setSabotageMessage("This sabotage is on cooldown.")
        } else if (blockedSabotages[action.id]) {
          setSabotageMessage("This sabotage is temporarily blocked.")
        } else {
          // Trigger the sabotage
          await executeSabotageWithWallet(action)
          setGeminiInput("")
        }
      } else {
        setSabotageMessage(data.error || "No sabotage matches your description.")
      }
    } catch (err) {
      setSabotageMessage("Failed to process Gemini sabotage.")
    } finally {
      setGeminiLoading(false)
    }
  }

  const handleVoiceInput = () => {
    console.log('Voice input button clicked')
    
    // Check if speech recognition is available
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      console.log('Speech recognition not available')
      setSabotageMessage("Voice input not supported in this browser. Please use Chrome or Edge.")
      return
    }
    
    // Get the speech recognition constructor
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    console.log('SpeechRecognition constructor:', SpeechRecognition)
    
    if (!SpeechRecognition) {
      console.log('SpeechRecognition constructor not found')
      setSabotageMessage("Speech recognition not available in this browser.")
      return
    }
    
    try {
      const recognition = new SpeechRecognition()
      console.log('Speech recognition instance created:', recognition)
      
      // Configure recognition settings
      recognition.lang = 'en-US'
      recognition.interimResults = false
      recognition.maxAlternatives = 1
      recognition.continuous = false
      
      // Set up event handlers
      recognition.onstart = () => {
        console.log('Speech recognition started')
        setIsListening(true)
        setSabotageMessage("🎤 Listening... Speak your sabotage idea!")
      }
      
      recognition.onresult = (event: any) => {
        console.log('Speech recognition result:', event)
        const transcript = event.results[0][0].transcript
        console.log('Transcript:', transcript)
        setGeminiInput(transcript)
        setIsListening(false)
        setSabotageMessage("✅ Voice input received: " + transcript)
        setTimeout(() => setSabotageMessage(null), 3000)
      }
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
        setSabotageMessage(`❌ Voice input error: ${event.error}`)
        setTimeout(() => setSabotageMessage(null), 3000)
      }
      
      recognition.onend = () => {
        console.log('Speech recognition ended')
        setIsListening(false)
      }
      
      // Start recognition
      console.log('Starting speech recognition...')
      recognition.start()
      
    } catch (error) {
      console.error('Failed to start speech recognition:', error)
      setIsListening(false)
      setSabotageMessage("❌ Failed to start voice input: " + (error as Error).message)
      setTimeout(() => setSabotageMessage(null), 3000)
    }
  }

  // Sabotage handler
  const handleSabotage = async () => {
    setTxStatus(null);
    if (!watcherWallet.isConnected) {
      setTxStatus("Connect your Petra wallet first.");
      return;
    }
    if (!isValidAptosAddress(playerAddress)) {
      setTxStatus("Enter a valid player wallet address (0x...)");
      return;
    }
    if (!sabotageAmount || sabotageAmount <= 0) {
      setTxStatus("Enter a valid sabotage amount.");
      return;
    }
    // Warn if system clock is off
    const now = Date.now();
    const localTime = new Date().getTime();
    if (Math.abs(now - localTime) > 60000) {
      setTxStatus("Warning: Your system clock may be incorrect. Please sync your computer's time.");
      return;
    }
    try {
      setTxStatus("Awaiting wallet approval...");
      const payload = {
        type: "entry_function_payload",
        function: "0x1::coin::transfer",
        type_arguments: ["0x1::aptos_coin::AptosCoin"],
        arguments: [playerAddress, (sabotageAmount * 1e8).toFixed(0)],
      };
      console.log("Sabotage payload:", payload);
      const tx = await watcherWallet.signAndSubmitTransaction(payload);
      setTxStatus("Sabotage successful! Tx Hash: " + tx.hash);
      watcherWallet.fetchBalance(watcherWallet.address!);
    } catch (err: any) {
      if (err && err.message && err.message.includes("TRANSACTION_EXPIRED")) {
        setTxStatus("Simulation error: TRANSACTION_EXPIRED. Please update Petra, check your system clock, and try again. If the problem persists, try a different browser or wallet.");
      } else {
        setTxStatus("Transaction failed: " + (err.message || err));
      }
    }
  };

  useEffect(() => {
    const fetchPlayerWallet = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/state`);
        if (res.ok) {
          const data = await res.json();
          if (data.playerWallet) {
            setManualPlayerAddress(data.playerWallet);
          }
        }
      } catch (err) {
        // handle error if needed
      }
    };
    fetchPlayerWallet();
  }, [roomId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">👻</div>
          <div className="text-white text-2xl font-bold">Loading room...</div>
        </div>
      </div>
    )
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">⏳</div>
          <div className="text-white text-2xl font-bold mb-4">
            {loading ? "Loading room..." : "Room not found"}
          </div>
          <div className="text-white/80 text-lg mb-6">
            {loading 
              ? "Checking if the game has started..." 
              : "The room doesn't exist. Please check the room ID and try again."
            }
          </div>
          <div className="flex gap-4 justify-center">
            <Button 
              onClick={() => router.push("/watch")} 
              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
            >
              🔍 Try Different Room
            </Button>
            <Button 
              onClick={() => router.push("/")} 
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
            >
              🏠 Back to Home
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Timer display
  const minutes = Math.floor(gameState.timeLeft / 60)
  const seconds = gameState.timeLeft % 60

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading game room...</div>
      </div>
    )
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-2xl mb-4">👻 Waiting for Game</div>
          <div className="text-lg">The game hasn't started yet. Ask the player to start the game!</div>
          <Button 
            onClick={() => router.push("/watch")} 
            className="mt-6 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-xl"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Watch
          </Button>
        </div>
      </div>
    )
  }

  // Show waiting state if game hasn't started yet
  if (gameState.gameStatus === "waiting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 p-4 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 bg-pink-400 rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>

        <div className="relative z-10 max-w-4xl mx-auto pt-20">
          <div className="text-center">
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              className="mb-6 bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            
            <div className="bg-black/60 border-white/20 rounded-2xl p-12 shadow-2xl backdrop-blur-sm">
              <div className="text-8xl mb-6 animate-pulse">⏳</div>
              <div className="text-white text-3xl font-bold mb-4 drop-shadow-2xl">
                Waiting for Player to Start
              </div>
              <div className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
                The room <span className="font-mono bg-white/10 px-2 py-1 rounded">{roomId}</span> exists, but the player hasn't started the game yet.
              </div>
              
              <div className="bg-gradient-to-r from-yellow-400/20 to-orange-500/20 border border-yellow-400/30 rounded-xl p-6 mb-8">
                <div className="text-white text-lg font-semibold mb-2">📋 Instructions for the Player:</div>
                <div className="text-white/90 text-sm space-y-2">
                  <div>1. Go to the main page and create a new game</div>
                  <div>2. Use this room ID: <span className="font-mono bg-white/20 px-2 py-1 rounded font-bold">{roomId}</span></div>
                  <div>3. Choose a difficulty and start the game</div>
                  <div>4. Once they start, you'll be able to watch and sabotage!</div>
                </div>
              </div>
              
              <div className="flex gap-4 justify-center">
                <Button 
                  onClick={() => window.location.reload()} 
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
                >
                  🔄 Refresh Page
                </Button>
                <Button 
                  onClick={() => router.push("/watch")} 
                  className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
                >
                  🔍 Try Different Room
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4">
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
            <div className="bg-gradient-to-r from-pink-400 to-purple-500 text-white px-4 py-2 rounded-full font-black">
              👻 VIEWER MODE
            </div>
            <span className="text-white/80">Room:</span>
            <span className="bg-white/10 px-3 py-1 rounded-lg font-mono">{roomId}</span>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-yellow-400 font-bold text-xl bg-black/30 px-4 py-2 rounded-full">
              ⏰ {minutes}:{seconds.toString().padStart(2, "0")}
            </div>
            <div className="flex items-center gap-2 text-yellow-400 font-bold text-lg bg-gradient-to-r from-yellow-400/20 to-orange-500/20 px-4 py-2 rounded-full border border-yellow-400/30">
              <Coins className="h-5 w-5" />
              {balance} tokens
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Game View */}
          <div className="lg:col-span-3">
            <Card className="bg-black/60 border-white/20 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-white text-2xl font-bold flex items-center gap-2 drop-shadow-lg">
                  <Eye className="h-6 w-6 text-pink-400" />
                  Live Game View
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex justify-center overflow-auto">
                  <div className="inline-block">
                    <canvas
                      ref={canvasRef}
                      className="border-4 border-pink-400 rounded-2xl shadow-2xl bg-black max-w-full"
                      style={{ imageRendering: "pixelated" }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {gameState.gameStatus !== "playing" && (
              <Card className="bg-black/60 border-white/20 mt-6 shadow-2xl">
                <CardContent className="p-8 text-center">
                  <div className="text-4xl mb-4">
                    {gameState.gameStatus === "won" ? "🎉" : "💀"}
                  </div>
                  <div className="text-3xl font-bold text-white mb-4 drop-shadow-lg">
                    {gameState.gameStatus === "won" ? "Player Won!" : "Player Lost!"}
                  </div>
                  <div className="text-xl text-gray-200 drop-shadow">Final Score: <span className="font-bold text-yellow-400">{gameState.player.score}</span></div>
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
                    <span className="font-semibold">❤️ Health</span>
                    <span className="font-bold">{gameState.player.health}/100</span>
                  </div>
                  <Progress value={gameState.player.health} className="h-3 bg-white/30" />
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

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Player Wallet Address</CardTitle>
              </CardHeader>
              <CardContent>
                <input
                  type="text"
                  className="w-full mb-2 p-2 rounded bg-gray-900 border border-gray-700 text-white"
                  placeholder="Enter player wallet address (0x...)"
                  value={manualPlayerAddress}
                  onChange={e => setManualPlayerAddress(e.target.value)}
                />
              </CardContent>
            </Card>

            {/* Sabotage Actions */}
            <Card className="bg-red-400/30 backdrop-blur-sm border-red-400/50 shadow-xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2 text-xl font-bold drop-shadow-lg">
                  <Zap className="h-6 w-6 text-yellow-400" />
                  Sabotage Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* AI Sabotage Input */}
                <div className="bg-black/40 p-4 rounded-xl border border-white/20">
                  <div className="flex gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={geminiInput}
                        onChange={e => setGeminiInput(e.target.value)}
                        placeholder="Type your sabotage idea..."
                        className="w-full rounded-lg bg-white/20 text-white px-3 py-2 border border-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-sm"
                        disabled={geminiLoading}
                        onKeyDown={e => { if (e.key === "Enter") handleGeminiSabotage() }}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleVoiceInput}
                      disabled={geminiLoading || isListening || !voiceSupported}
                      variant="secondary"
                      size="icon"
                      className={`flex-shrink-0 w-10 h-10 ${
                        isListening 
                          ? "animate-pulse bg-yellow-400 text-black" 
                          : voiceSupported 
                            ? "bg-white/20 hover:bg-white/30" 
                            : "bg-gray-500/50 cursor-not-allowed"
                      } border-white/30`}
                      title={voiceSupported ? "Voice input (Chrome/Edge only)" : "Voice input not supported in this browser"}
                    >
                      <Mic className={`h-4 w-4 ${!voiceSupported ? "opacity-50" : ""}`} />
                    </Button>
                  </div>
                  <Button
                    onClick={handleGeminiSabotage}
                    disabled={geminiLoading || !geminiInput.trim()}
                    className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold py-2 rounded-lg text-sm"
                  >
                    {geminiLoading ? "🤖 Processing..." : "🎯 Execute AI Sabotage"}
                  </Button>
                </div>
                {sabotageActions.map((action) => {
                  const onCooldown = cooldowns[action.id] > 0
                  const canAfford = balance >= action.cost
                  const disabled = onCooldown || !canAfford || gameState.gameStatus !== "playing"

                  return (
                    <Button
                      key={action.id}
                      onClick={() => executeSabotage(action)}
                      disabled={disabled || blockedSabotages[action.id]}
                      className={`w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:text-gray-400 text-left justify-start p-3 h-auto ${blockedSabotages[action.id] ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <span className="text-2xl">{action.icon}</span>
                        <div className="flex-1">
                          <div className="font-semibold">{action.name}</div>
                          <div className="text-xs opacity-80">{action.description}</div>
                          <div className="text-xs text-yellow-300">{action.cost} tokens</div>
                          {onCooldown && (
                            <div className="text-xs text-red-300">
                              Cooldown: {Math.ceil(cooldowns[action.id] / 1000)}s
                            </div>
                          )}
                        </div>
                      </div>
                    </Button>
                  )
                })}
              </CardContent>
            </Card>

            {/* Room Info */}
            <Card className="bg-black/60 border-white/20 shadow-xl">
              <CardHeader>
                <CardTitle className="text-white text-xl font-bold drop-shadow-lg">📊 Room Info</CardTitle>
              </CardHeader>
              <CardContent className="text-white text-sm space-y-3">
                <div className="flex items-center gap-2 bg-white/20 p-3 rounded-lg">
                  <Users className="h-4 w-4" />
                  <span className="font-semibold">{gameState.viewers} viewers watching</span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 p-3 rounded-lg">
                  <Gamepad2 className="h-4 w-4" />
                  <span className="font-semibold">Status: {gameState.gameStatus}</span>
                </div>
                <div className="bg-purple-400/30 p-3 rounded-lg border border-purple-400/50">
                  <div className="text-xs text-white drop-shadow">
                    💡 Use your tokens to sabotage the player and make the game more challenging!
                  </div>
                </div>
              </CardContent>
            </Card>

            {sabotageMessage && (
              <div className="text-center text-red-400 font-bold bg-red-400/20 p-4 rounded-xl border border-red-400/50 drop-shadow">
                ⚡ {sabotageMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
