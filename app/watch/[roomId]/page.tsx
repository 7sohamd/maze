"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, Eye, Coins, Zap, Mic, Users, Gamepad2 } from "lucide-react"
import Head from "next/head"
import { AptosClient } from "aptos"

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

// Helper to wait for Aptos transaction confirmation
async function waitForAptosTx(txHash: string, maxAttempts = 20, interval = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`https://fullnode.testnet.aptoslabs.com/v1/transactions/by_hash/${txHash}`);
    if (res.ok) {
      const data = await res.json();
      if (data.type === 'user_transaction' && data.success) {
        return true;
      }
    }
    await new Promise(r => setTimeout(r, interval));
  }
  return false;
}

// Helper functions to check if sabotage is possible
function canBlockPath(gameState: any) {
  // Only allow if there is a path from player to goal and not too many obstacles
  if (!gameState || !gameState.maze || !gameState.player || !gameState.goal) return false;
  let maze = gameState.maze;
  if (typeof maze === "string") {
    try { maze = JSON.parse(maze); } catch { return false; }
  }
  // Simple check: less than 1/4 of maze cells are obstacles
  const maxObstacles = Math.floor((maze.length * maze[0].length) / 4);
  return (gameState.obstacles?.length || 0) < maxObstacles;
}
function canDamage(gameState: any) {
  return gameState?.player?.health > 0;
}
function canSpawnEnemy(gameState: any) {
  // Only allow if less than N enemies (e.g., 10)
  return (gameState?.enemies?.length || 0) < 10;
}
function canSlow(gameState: any) {
  return gameState?.timeLeft > 0;
}

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params?.roomId as string;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [blockedSabotages, setBlockedSabotages] = useState<Record<string, boolean>>({})
  const [sabotageMessage, setSabotageMessage] = useState<string | null>(null)
  const [geminiInput, setGeminiInput] = useState("")
  const [geminiLoading, setGeminiLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [playerWallet, setPlayerWallet] = useState<string | null>(null)
  const [initLoading, setInitLoading] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<string | null>(null);
  const [viewerWallet, setViewerWallet] = useState<string | null>(null);
  const [petraLoading, setPetraLoading] = useState(false);

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
    
    // Generate a unique session ID for this viewer that persists across re-renders
    let sessionId = sessionStorage.getItem(`viewer_session_id_${roomId}`)
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2, 15)
      sessionStorage.setItem(`viewer_session_id_${roomId}`, sessionId)
      console.log(`[Watch] Created new session ID: ${sessionId} for room: ${roomId}`)
    } else {
      console.log(`[Watch] Using existing session ID: ${sessionId} for room: ${roomId}`)
    }
    const sessionKey = `viewer_session_${roomId}_${sessionId}`
    
    console.log(`[Watch] Initializing viewer session: ${sessionId} for room: ${roomId}`)
    console.log(`[Watch] Session key: ${sessionKey}`)
    console.log(`[Watch] Already registered: ${sessionStorage.getItem(sessionKey) ? 'YES' : 'NO'}`)
    
    const pollGameState = async () => {
      if (!roomId) return; // Guard: don't fetch if roomId is not defined
      try {
        const response = await fetch(`/api/rooms/${roomId}/state`);
        if (response.ok) {
          const state = await response.json();
          console.log(`[Watch] Game state received - viewers: ${state.viewers}, session: ${sessionId}`);
          
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
        const headers: HeadersInit = {};
        
        // Check if this viewer has already registered for this room using session storage
        const hasRegistered = sessionStorage.getItem(sessionKey);
        
        if (!hasRegistered) {
          headers["x-new-viewer"] = "true";
          sessionStorage.setItem(sessionKey, "true");
          console.log(`[Watch] Registering as new viewer for room: ${roomId} (session: ${sessionId})`)
        } else {
          console.log(`[Watch] Sending heartbeat for room: ${roomId} (session: ${sessionId}) - already registered`)
        }
        
        const response = await fetch(`/api/rooms/${roomId}/presence`, { 
          method: "POST",
          headers
        })
        if (response.ok) {
          const responseData = await response.json()
          console.log(`[Watch] Presence ${!hasRegistered ? 'registered' : 'heartbeat sent'} successfully for room: ${roomId} (fallback: ${responseData.fallback || false})`)
        } else {
          console.log(`[Watch] Presence request failed with status: ${response.status}`)
        }
      } catch (error) {
        console.error("Failed to register presence:", error)
      }
    }

    pollGameState()
    registerPresence()
    const interval = setInterval(pollGameState, 100) // Ultra-fast polling for real-time viewing
    const presenceInterval = setInterval(registerPresence, 30000) // Register presence every 30s

    return () => {
      console.log(`[Watch] Cleaning up intervals for session: ${sessionId}`)
      clearInterval(interval)
      clearInterval(presenceInterval)
      // Note: We don't unregister presence here to prevent premature decrements
      // Presence will be unregistered only when the user actually leaves the page
    }
  }, [roomId, router])

  // Separate effect for handling page unload - only unregister when user actually leaves
  useEffect(() => {
    // Get the existing session ID
    const sessionId = sessionStorage.getItem(`viewer_session_id_${roomId}`)
    if (!sessionId) {
      console.log(`[Watch] No session ID found for room: ${roomId}, skipping unload handler`)
      return
    }
    
    const sessionKey = `viewer_session_${roomId}_${sessionId}`
    
    const handleBeforeUnload = () => {
      console.log(`[Watch] User leaving page, unregistering presence for room: ${roomId} (session: ${sessionId})`)
      
      // Only unregister if this session was actually registered
      if (sessionStorage.getItem(sessionKey)) {
        // Use sendBeacon for reliable unregistration on page unload
        if (navigator.sendBeacon) {
          navigator.sendBeacon(`/api/rooms/${roomId}/presence`, JSON.stringify({ method: 'DELETE' }))
        } else {
          // Fallback for browsers that don't support sendBeacon
          fetch(`/api/rooms/${roomId}/presence`, { 
            method: "DELETE",
            keepalive: true 
          }).catch(console.error)
        }
        
        // Clean up session storage
        sessionStorage.removeItem(sessionKey);
        sessionStorage.removeItem(`viewer_session_id_${roomId}`);
      } else {
        console.log(`[Watch] Session ${sessionId} was not registered, skipping unregistration`)
      }
    }

    // Handle page unload
    window.addEventListener("beforeunload", handleBeforeUnload)
    
    // Handle page visibility change (tab switching)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log(`[Watch] Page hidden, but keeping presence registered for room: ${roomId} (session: ${sessionId})`)
      } else {
        console.log(`[Watch] Page visible again for room: ${roomId} (session: ${sessionId})`)
      }
    }
    
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      console.log(`[Watch] Cleaning up unload handlers for session: ${sessionId}`)
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [roomId])

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

  // Function to initialize the watcher's account
  const initializeWatcherAccount = useCallback(async () => {
    setInitLoading(true);
    try {
      const payload = {
        type: "entry_function_payload",
        function: "0x610b5f5dd4e53876a000fc05432f119bd7763abdb62efc034393ee63055de1f9::game_tokens::initialize_account",
        type_arguments: [],
        arguments: [],
      };
      // Removed: await watcherWallet.signAndSubmitTransaction({ payload });
      setSabotageMessage("Account initialized!");
    } catch (err: any) {
      setSabotageMessage("Initialization failed: " + (err.message || err));
    } finally {
      setInitLoading(false);
    }
  }, []);

  // Function to initialize the player's account
  const initializePlayerAccount = async () => {
    setInitLoading(true);
    try {
      // This requires the player to sign, so just show instructions
      setSabotageMessage("Ask the player to visit the game and click 'Initialize Account'.");
    } finally {
      setInitLoading(false);
    }
  };

  const handleSabotage = async (action: SabotageAction) => {
    if (!viewerWallet) {
      setSabotageMessage("Connect your Petra wallet first.");
      return;
    }
    if (!playerWallet) {
      setSabotageMessage("Player wallet not found for this room.");
      return;
    }
    // 1. Check with backend if sabotage is allowed
    const checkRes = await fetch(`/api/rooms/${roomId}/sabotage/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: action.id }),
    });
    const checkData = await checkRes.json();
    if (!checkData.allowed) {
      setSabotageMessage(checkData.reason || "This sabotage is not allowed.");
      setBlockedSabotages(prev => ({ ...prev, [action.id]: true }));
      setTimeout(() => {
        setBlockedSabotages(prev => ({ ...prev, [action.id]: false }));
      }, 5000);
      return;
    }
    setSabotageMessage("Paying and sabotaging...");
    try {
      // 2. Pay the sabotage amount to the player's wallet
      const payload = {
        type: "entry_function_payload",
        function: "0x1::coin::transfer",
        type_arguments: ["0x1::aptos_coin::AptosCoin"],
        arguments: [playerWallet, (action.cost * 1e8).toFixed(0)],
      };
      const txResult = await (window as any).petra.signAndSubmitTransaction(payload);
      const txHash = txResult?.hash || txResult?.transactionHash;
      if (!txHash) {
        setSabotageMessage("Transaction failed to submit.");
        return;
      }
      // Wait for confirmation
      setSabotageMessage("Waiting for transaction confirmation...");
      const confirmed = await waitForAptosTx(txHash);
      if (!confirmed) {
        setSabotageMessage("Transaction not confirmed. Sabotage cancelled.");
        return;
      }
      // 3. Call backend to apply sabotage effect
      const result = await fetch(`/api/rooms/${roomId}/sabotage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action.id }),
      });
      if (!result.ok) {
        const data = await result.json();
        setSabotageMessage("Payment succeeded but sabotage failed: " + (data.error || result.statusText));
        setBlockedSabotages(prev => ({ ...prev, [action.id]: true }));
        setTimeout(() => {
          setBlockedSabotages(prev => ({ ...prev, [action.id]: false }));
        }, 5000);
        return;
      } else {
        setSabotageMessage("Sabotage sent after payment!");
      }
    } catch (err: any) {
      setSabotageMessage("Failed: " + (err.message || err));
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
          await handleSabotage(action)
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

  // Fetch playerWallet from room state
  useEffect(() => {
    const fetchPlayerWallet = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/state`);
        if (res.ok) {
          const data = await res.json();
          if (data.playerWallet) {
            setPlayerWallet(data.playerWallet);
          }
        }
      } catch (err) {
        // handle error if needed
      }
    };
    fetchPlayerWallet();
  }, [roomId]);

  const connectPetra = async () => {
    if (typeof window !== 'undefined' && (window as any).petra) {
      setPetraLoading(true);
      try {
        const response = await (window as any).petra.connect();
        setViewerWallet(response.address);
      } catch (e) {
        alert("Failed to connect Petra");
      } finally {
        setPetraLoading(false);
      }
    } else {
      alert("Petra wallet not found");
    }
  };

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
    <>
      <Head>
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P:wght@400&display=swap" rel="stylesheet" />
        <style>{`
          .press-start-bold {
            font-family: 'Press Start 2P', monospace !important;
            font-weight: 400 !important;
          }
        `}</style>
      </Head>
      <div
        className="min-h-screen p-4 relative overflow-hidden"
        style={{
          backgroundColor: 'black',
          backgroundImage: `url('/sky.gif')`,
          backgroundSize: '100% auto',
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Overlay for readability */}
        <div className="absolute inset-0 bg-black/70 pointer-events-none z-0" />
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4 gap-2">
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm text-base font-medium px-3 py-1"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span>Back to Home</span>
            </Button>
            <div className="text-white text-lg font-semibold flex items-center gap-2">
              <div className="bg-gradient-to-r from-pink-400 to-purple-500 text-white px-2 py-1 rounded-full font-bold text-base">
                👻 VIEWER MODE
              </div>
              <span className="text-white/80 text-base">Room:</span>
              <span className="bg-white/10 px-2 py-1 rounded-lg font-mono text-sm truncate max-w-[100px]">{roomId}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-yellow-400 font-semibold text-base bg-black/30 px-3 py-1 rounded-full">
                ⏰ {minutes}:{seconds.toString().padStart(2, "0")}
              </div>
            </div>
          </div>
          <div className="grid lg:grid-cols-4 gap-4">
            {/* Game View */}
            <div className="lg:col-span-3">
              <Card className="bg-white-400/30 border-white/20 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-white text-lg font-semibold flex items-center gap-2 drop-shadow-lg">
                    <Eye className="h-5 w-5 text-pink-400" />
                    Live Game View
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
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
                <Card className="bg-white-400/30 border-white/20 mt-4 shadow-2xl">
                  <CardContent className="p-6 text-center">
                    <div className="text-2xl mb-2">
                      {gameState.gameStatus === "won" ? "🎉" : "💀"}
                    </div>
                    <div className="text-xl font-semibold text-white mb-2 drop-shadow-lg">
                      {gameState.gameStatus === "won" ? "Player Won!" : "Player Lost!"}
                    </div>
                    <div className="text-base text-gray-200 drop-shadow">Final Score: <span className="text-yellow-400 font-mono">{gameState.player.score}</span></div>
                  </CardContent>
                </Card>
              )}
            </div>
            {/* Sidebar */}
            <div className="space-y-4">
              {/* Player Stats */}
              <Card className="bg-yellow-400/30 backdrop-blur-sm border-yellow-400/50 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2 text-base font-bold drop-shadow-lg">
                    <div className="text-xl">🟡</div>
                    Player Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs text-white mb-1 drop-shadow">
                      <span className="font-semibold">❤️ Health</span>
                      <span className="font-bold">{gameState.player.health}/100</span>
                    </div>
                    <Progress value={gameState.player.health} className="h-2 bg-white/30" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-white mb-1 drop-shadow">
                      <span className="font-semibold">⚡ Speed</span>
                      <span className="font-bold">{Math.round(gameState.player.speed * 100)}%</span>
                    </div>
                    <Progress value={gameState.player.speed * 100} className="h-2 bg-white/30" />
                  </div>
                  <div className="text-center bg-gradient-to-r from-yellow-400 to-orange-500 text-black py-2 rounded-xl font-bold text-lg drop-shadow">
                    🏆 <span className="font-mono">{gameState.player.score}</span>
                  </div>
                </CardContent>
              </Card>
              {/* Wallet Connect and Recipient Address */}
              <div className="mb-2 flex flex-col gap-2">
                {!viewerWallet ? (
                  <Button onClick={connectPetra} disabled={petraLoading} className="text-base py-2">
                    {petraLoading ? "Connecting..." : "Connect Petra Wallet"}
                  </Button>
                ) : (
                  <div className="flex flex-col gap-1">
                    <div className="text-green-500 font-medium text-xs truncate">Wallet Connected: {viewerWallet.slice(0, 8)}...{viewerWallet.slice(-4)}</div>
                  </div>
                )}
              </div>
              {/* Sabotage Actions */}
              <Card className="bg-white-400/30 backdrop-blur-sm border-white/20 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2 text-base font-bold drop-shadow-lg">
                    <Zap className="h-5 w-5 text-yellow-400" />
                    Sabotage Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {/* AI Sabotage Input */}
                  <div className="bg-black/40 p-2 rounded-xl border border-white/20">
                    <div className="flex gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={geminiInput}
                          onChange={e => setGeminiInput(e.target.value)}
                          placeholder="Type your sabotage idea..."
                          className="w-full rounded-lg bg-white/20 text-white px-2 py-1 border border-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-xs"
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
                        className={`flex-shrink-0 w-8 h-8 ${
                          isListening 
                            ? "animate-pulse bg-yellow-400 text-black" 
                            : voiceSupported 
                              ? "bg-white/20 hover:bg-white/30" 
                              : "bg-gray-500/50 cursor-not-allowed"
                        } border-white/30`}
                        title={voiceSupported ? "Voice input (Chrome/Edge only)" : "Voice input not supported in this browser"}
                      >
                        <Mic className={`h-3 w-3 ${!voiceSupported ? "opacity-50" : ""}`} />
                      </Button>
                    </div>
                    <Button
                      onClick={handleGeminiSabotage}
                      disabled={geminiLoading || !geminiInput.trim()}
                      className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-semibold py-1 rounded-lg text-xs"
                    >
                      {geminiLoading ? "🤖 Processing..." : "🎯 Execute AI Sabotage"}
                    </Button>
                  </div>
                  {sabotageActions.map((action) => {
                    const onCooldown = cooldowns[action.id] > 0;
                    let logicPossible = true;
                    if (action.id === "block") logicPossible = canBlockPath(gameState);
                    if (action.id === "damage") logicPossible = canDamage(gameState);
                    if (action.id === "enemy") logicPossible = canSpawnEnemy(gameState);
                    if (action.id === "slow") logicPossible = canSlow(gameState);
                    const disabled = onCooldown || !viewerWallet || gameState.gameStatus !== "playing" || !logicPossible;
                    return (
                      <Button
                        key={action.id}
                        onClick={() => handleSabotage(action)}
                        disabled={disabled || blockedSabotages[action.id]}
                        className={`self-stretch w-full text-left font-semibold text-base mb-1 ${blockedSabotages[action.id] ? 'opacity-50 cursor-not-allowed' : ''} px-3 py-2 flex items-start`}
                        style={{ minHeight: 60 }}
                      >
                        <span className="text-xl mr-3 flex-shrink-0 mt-1">{action.icon}</span>
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex justify-between items-center w-full gap-2">
                            <span className="font-semibold truncate block" style={{maxWidth: '120px'}}>{action.name}</span>
                            <span className="text-xs text-yellow-300 whitespace-nowrap ml-2">{action.cost} APT</span>
                          </div>
                          <span className="text-xs opacity-80 block truncate" style={{maxWidth: '180px'}}>{action.description}</span>
                          {onCooldown && (
                            <span className="text-xs text-red-300 block mt-1">Cooldown: {Math.ceil(cooldowns[action.id] / 1000)}s</span>
                          )}
                        </div>
                      </Button>
                    );
                  })}
                </CardContent>
              </Card>
              {/* Room Info */}
              <Card className="bg-black/60 border-white/20 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-white text-base font-bold drop-shadow-lg">📊 Room Info</CardTitle>
                </CardHeader>
                <CardContent className="text-white text-xs space-y-2">
                  <div className="flex items-center gap-1 bg-white/20 p-2 rounded-lg">
                    <Users className="h-4 w-4" />
                    <span className="font-semibold">{gameState.viewers} viewers watching</span>
                  </div>
                  <div className="flex items-center gap-1 bg-white/20 p-2 rounded-lg">
                    <Gamepad2 className="h-4 w-4" />
                    <span className="font-semibold">Status: {gameState.gameStatus}</span>
                  </div>
                  <div className="bg-purple-400/30 p-2 rounded-lg border border-purple-400/50">
                    <div className="text-xs text-white drop-shadow">
                      💡 Use your APT to sabotage the player and make the game more challenging!
                    </div>
                  </div>
                </CardContent>
              </Card>
              {sabotageMessage && (
                <div className="text-center text-red-400 font-semibold bg-red-400/20 p-2 rounded-xl border border-red-400/50 drop-shadow text-sm">
                  ⚡ {sabotageMessage}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
