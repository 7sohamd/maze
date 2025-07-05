"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, Eye, Coins, Zap, Mic } from "lucide-react"
import { useAptosWallet } from "@/hooks/use-aptos-wallet"
import { usePetraWallet, isValidAptosAddress } from "@/hooks/use-petra-wallet"

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
  const [playerAddress, setPlayerAddress] = useState("")
  const [sabotageAmount, setSabotageAmount] = useState(0.1)
  const [txStatus, setTxStatus] = useState<string | null>(null)
  const [manualPlayerAddress, setManualPlayerAddress] = useState("")

  // Add wallet hooks for player and watcher
  const playerWallet = useAptosWallet();
  const watcherWallet = usePetraWallet();

  const sabotageActions: SabotageAction[] = [
    {
      id: "slow",
      name: "Slow Down",
      cost: 0.05,
      icon: "🐌",
      description: "Reduce player speed by 30%",
      cooldown: 10000,
    },
    {
      id: "block",
      name: "Block Path",
      cost: 0.08,
      icon: "🧱",
      description: "Place obstacle near player",
      cooldown: 15000,
    },
    {
      id: "damage",
      name: "Damage",
      cost: 0.1,
      icon: "💔",
      description: "Reduce player health",
      cooldown: 12000,
    },
    {
      id: "enemy",
      name: "Spawn Enemy",
      cost: 0.1,
      icon: "👹",
      description: "Spawn enemy near player",
      cooldown: 20000,
    },
  ]

  // Poll for game state
  useEffect(() => {
    const pollGameState = async () => {
      try {
        const response = await fetch(`/api/rooms/${roomId}/state`)
        if (response.ok) {
          const state = await response.json()
          setGameState(state)
        } else if (response.status === 404) {
          router.push("/")
        }
      } catch (error) {
        console.error("Failed to fetch game state:", error)
      } finally {
        setLoading(false)
      }
    }

    pollGameState()
    const interval = setInterval(pollGameState, 500)

    return () => clearInterval(interval)
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

  // Render game
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

    const cellSize = 15
    canvas.width = maze[0].length * cellSize
    canvas.height = maze.length * cellSize

    // Clear canvas
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw maze
    maze.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell === 1) {
          ctx.fillStyle = "#4F46E5"
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
        }
      })
    })

    // Draw goal
    ctx.fillStyle = "#10B981"
    ctx.fillRect(gameState.goal.x * cellSize + 1, gameState.goal.y * cellSize + 1, cellSize - 2, cellSize - 2)

    // Draw obstacles
    gameState.obstacles.forEach((obstacle) => {
      ctx.fillStyle = "#DC2626"
      ctx.fillRect(obstacle.x * cellSize, obstacle.y * cellSize, cellSize, cellSize)
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
      cellSize / 2 - 1,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }, [gameState])

  // New sabotage logic using watcher wallet
  const executeSabotageWithWallet = async (action: SabotageAction) => {
    if (!watcherWallet.isConnected || watcherWallet.loading) {
      setSabotageMessage("Connect watcher wallet first.");
      return;
    }
    if (!manualPlayerAddress || !isValidAptosAddress(manualPlayerAddress)) {
      setSabotageMessage("Enter a valid player wallet address (0x...)");
      return;
    }
    try {
      setSabotageMessage(null);
      // Send the specified APT amount from watcher to player
      const payload = {
        type: "entry_function_payload",
        function: "0x1::coin::transfer",
        type_arguments: ["0x1::aptos_coin::AptosCoin"],
        arguments: [manualPlayerAddress, (action.cost * 1e8).toFixed(0)],
      };
      const tx = await watcherWallet.signAndSubmitTransaction(payload);
      // After payment, trigger sabotage effect in backend (Firestore)
      try {
        const sabotageRes = await fetch(`/api/rooms/${roomId}/sabotage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: action.id }),
        });
        if (sabotageRes.ok) {
          setSabotageMessage(`Sabotage executed! ${action.cost} APT sent to player. Tx Hash: ${tx.hash}`);
        } else {
          const data = await sabotageRes.json();
          setSabotageMessage(`Payment sent, but sabotage failed: ${data.error || "Unknown error"}`);
        }
      } catch (apiErr) {
        setSabotageMessage(`Payment sent, but sabotage API call failed.`);
      }
      watcherWallet.fetchBalance(watcherWallet.address!);
    } catch (err: any) {
      setSabotageMessage(err.message || "Failed to execute sabotage.");
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
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setSabotageMessage("Voice input not supported in this browser.")
      return
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    setIsListening(true)
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setGeminiInput(transcript)
      setIsListening(false)
    }
    recognition.onerror = () => {
      setIsListening(false)
      setSabotageMessage("Voice input error.")
    }
    recognition.onend = () => setIsListening(false)
    recognition.start()
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading room...</div>
      </div>
    )
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-xl mb-4">Room not found or no active game</div>
          <Button onClick={() => router.push("/")} className="bg-blue-600 hover:bg-blue-700">
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  // Timer display
  const minutes = Math.floor(gameState.timeLeft / 60)
  const seconds = gameState.timeLeft % 60

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Watcher Petra Wallet Connect Section */}
        <div className="mb-6">
          <div className="bg-gray-800 border border-gray-700 rounded p-4 max-w-md">
            <div className="font-bold text-white mb-2">Watcher Petra Wallet</div>
            {watcherWallet.isConnected ? (
              <>
                <div className="text-xs text-gray-400 break-all">{watcherWallet.address}</div>
                <div className="text-yellow-400 font-bold">{watcherWallet.balance ?? 0} APT</div>
                <button onClick={watcherWallet.disconnect} className="mt-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded">Disconnect</button>
              </>
            ) : (
              <button
                onClick={watcherWallet.connect}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                disabled={watcherWallet.loading}
              >
                {watcherWallet.loading ? "Connecting..." : "Connect Petra Wallet"}
              </button>
            )}
            {watcherWallet.error && (
              <div className="text-red-400 text-xs mt-2">{watcherWallet.error}</div>
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
            <Eye className="h-5 w-5" />
            Watching Room: {roomId}
          </div>
          <div className="flex items-center gap-2 text-yellow-400 font-bold text-lg">
            ⏰ {minutes}:{seconds.toString().padStart(2, "0")} left
          </div>
          <div className="flex items-center gap-2 text-yellow-400 font-bold">
            <Coins className="h-5 w-5" />
            {balance} tokens
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Live Game View</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <canvas
                  ref={canvasRef}
                  className="border border-gray-600 mx-auto block"
                  style={{ imageRendering: "pixelated" }}
                />
              </CardContent>
            </Card>

            {gameState.gameStatus !== "playing" && (
              <Card className="bg-gray-800 border-gray-700 mt-4">
                <CardContent className="p-6 text-center">
                  <div className="text-2xl font-bold text-white mb-2">
                    {gameState.gameStatus === "won" ? "🎉 Player Won!" : "💀 Player Lost!"}
                  </div>
                  <div className="text-gray-300">Final Score: {gameState.player.score}</div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Player Stats</CardTitle>
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

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-400" />
                  Sabotage Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2 mb-2 items-center">
                  <input
                    type="text"
                    value={geminiInput}
                    onChange={e => setGeminiInput(e.target.value)}
                    placeholder="Type your sabotage idea..."
                    className="flex-1 rounded bg-gray-900 text-white px-3 py-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    disabled={geminiLoading}
                    onKeyDown={e => { if (e.key === "Enter") handleGeminiSabotage() }}
                    style={{ minWidth: 0 }}
                  />
                  <Button
                    type="button"
                    onClick={handleVoiceInput}
                    disabled={geminiLoading || isListening}
                    variant="secondary"
                    size="icon"
                    aria-label="Voice input"
                    className={isListening ? "animate-pulse bg-yellow-400 text-black" : ""}
                    style={{ minWidth: 40 }}
                  >
                    <Mic className="h-5 w-5" />
                  </Button>
                  <Button
                    onClick={handleGeminiSabotage}
                    disabled={geminiLoading || !geminiInput.trim()}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4"
                    style={{ minWidth: 60 }}
                  >
                    {geminiLoading ? "..." : "Go"}
                  </Button>
                </div>
                {sabotageActions.map((action) => {
                  const disabled = gameState?.gameStatus !== "playing";
                  return (
                    <Button
                      key={action.id}
                      onClick={() => executeSabotageWithWallet(action)}
                      disabled={disabled || watcherWallet.loading}
                      className={`w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:text-gray-400 text-left justify-start p-3 h-auto ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <span className="text-2xl">{action.icon}</span>
                        <div className="flex-1">
                          <div className="font-semibold">{action.name}</div>
                          <div className="text-xs opacity-80">{action.description}</div>
                          <div className="text-xs text-yellow-300">{action.cost} APT</div>
                        </div>
                      </div>
                    </Button>
                  )
                })}
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Room Info</CardTitle>
              </CardHeader>
              <CardContent className="text-gray-300 text-sm space-y-2">
                <div>👥 {gameState.viewers} viewers watching</div>
                <div>🎮 Game status: {gameState.gameStatus}</div>
                <div className="text-xs text-gray-400 mt-3">
                  Use your tokens to sabotage the player and make the game more challenging!
                </div>
              </CardContent>
            </Card>

            {sabotageMessage && (
              <div className="text-center text-red-400 font-semibold my-2">{sabotageMessage}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
