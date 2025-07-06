"use client"

import type React from "react"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, Users, Heart, Zap, Copy, Share2, Check } from "lucide-react"
import { db } from "@/lib/firebase"
import { doc, setDoc, collection, query, orderBy, limit, getDocs, increment } from "firebase/firestore"
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth'

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
  const roomId = params?.roomId ? String(params.roomId) : null
  const searchParams = useSearchParams()
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
  const hitTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isMoving, setIsMoving] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [petraLoading, setPetraLoading] = useState(false)
  const [lastMovement, setLastMovement] = useState<{x: number, y: number} | null>(null)
  const movementQueueRef = useRef<Array<{x: number, y: number}>>([])
  const isProcessingMovementRef = useRef(false)
  const [selectedMode, setSelectedMode] = useState<string>("")
  const difficulty = selectedMode || searchParams?.get('difficulty') || 'medium'
  
  // Leaderboard state (must be declared before any useEffect that uses it)
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  // User state (must be declared before any useEffect that uses it)
  const [user, setUser] = useState<any>(null);
  
  // Proper hit effect management
  const triggerHitEffect = useCallback(() => {
    // Clear any existing timeout
    if (hitTimeoutRef.current) {
      clearTimeout(hitTimeoutRef.current);
    }
    
    // Set hit effect
    setPlayerHit(true);
    
    // Clear hit effect after 800ms (shorter for better responsiveness)
    hitTimeoutRef.current = setTimeout(() => {
      setPlayerHit(false);
      hitTimeoutRef.current = null;
    }, 800);
  }, []);
  
  // Client-side prediction for smoother movement
  const [predictedPosition, setPredictedPosition] = useState<{x: number, y: number} | null>(null)
  const pendingMovesRef = useRef<Array<{id: number, movement: {x: number, y: number}, timestamp: number}>>([])
  const moveIdRef = useRef(0)
  const lastConfirmedPositionRef = useRef<{x: number, y: number} | null>(null)
  const lastCollisionCheckRef = useRef(0)

  if (!roomId) {
    return <div>Invalid room</div>;
  }

  // Initialize game
  useEffect(() => {
    const initGame = async () => {
      if (!walletAddress) return; // Block until wallet is connected
      try {
        console.log("Initializing game for room:", roomId)
        
        // Try to start the game directly - the start API will create the room if needed
        console.log("Starting game for room:", roomId)
        
        const response = await fetch(`/api/rooms/${roomId}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            difficulty,
            playerWallet: walletAddress 
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
  }, [roomId, router, walletAddress])

  // Handle keyboard input - ROBUST VERSION
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Stop input if game is won or lost
      if (gameState?.gameStatus === "won" || gameState?.gameStatus === "lost") {
        return
      }
      
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
        // Limit queue length to prevent getting stuck
        if (movementQueueRef.current.length < 5) {
          movementQueueRef.current.push(movement)
        } else {
          console.log("[Game] Movement queue full, dropping movement to prevent getting stuck");
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      // Stop input if game is won or lost
      if (gameState?.gameStatus === "won" || gameState?.gameStatus === "lost") {
        return
      }
      
      // Only handle movement keys
      const validKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'A', 'd', 'D', 'w', 'W', 's', 'S']
      if (!validKeys.includes(e.key)) return
      
      e.preventDefault()
      e.stopPropagation()
      
      // Don't clear the entire queue on key up - let the game loop process it naturally
      // This prevents issues with key release order and allows smoother movement
      // movementQueueRef.current = []
    }

    // Focus the window to ensure key events are captured
    window.focus()

    window.addEventListener("keydown", handleKeyDown, { passive: false })
    window.addEventListener("keyup", handleKeyUp, { passive: false })

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [gameState?.gameStatus])

  // Add mouse/touch controls - ROBUST VERSION
  const handleCanvasClick = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Stop input if game is won or lost
      if (!gameState || gameState.gameStatus === "won" || gameState.gameStatus === "lost" || !canvasRef.current || isMoving) return

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
        // Add to movement queue with limit
        if (movementQueueRef.current.length < 5) {
          movementQueueRef.current.push(movement)
        } else {
          console.log("[Game] Movement queue full, dropping click movement");
        }
      }
    },
    [gameState, roomId, cellSize, isMoving],
  )

  // Set client flag after hydration to prevent hydration mismatch
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  // Cleanup hit effect timeout on unmount
  useEffect(() => {
    return () => {
      if (hitTimeoutRef.current) {
        clearTimeout(hitTimeoutRef.current);
        hitTimeoutRef.current = null;
      }
    };
  }, []);

  // Game loop function - ULTRA SMOOTH VERSION with client-side prediction
  const updateGame = useCallback(async () => {
    // Early return if game is not in playing state or if already processing
    if (!gameState || gameState.gameStatus !== "playing" || isProcessingMovementRef.current) {
      return;
    }
    if (movementQueueRef.current.length === 0) return;
    
    const now = Date.now();
    const timeSinceLastMove = now - (lastMoveTimeRef.current || 0);
    // Adaptive movement timing based on ping - faster response when ping is high
    // Also reduce delay when there are multiple moves queued for smoother chaining
    const queueLength = movementQueueRef.current.length;
    const minMoveInterval = ping && ping > 200 ? 20 : 40; // Even faster response
    const adjustedInterval = queueLength > 1 ? Math.max(5, minMoveInterval * 0.5) : minMoveInterval;
    if (timeSinceLastMove < adjustedInterval) return;
    
    const movement = movementQueueRef.current.shift()!;
    // Remove opposite movement restriction to allow all 4 directions
    // This prevents the character from getting stuck
    // if (lastMovement) {
    //   const isOpposite = (movement.x !== 0 && movement.x === -lastMovement.x) ||
    //                     (movement.y !== 0 && movement.y === -lastMovement.y);
    //   if (isOpposite) {
    //     return;
    //   }
    // }
    
    isProcessingMovementRef.current = true;
    setIsMoving(true);
    lastMoveTimeRef.current = now;
    
        // Parse maze for collision detection
    let maze: number[][] = gameState.maze as any;
        if (typeof maze === "string") {
          try {
        maze = JSON.parse(maze);
          } catch (e) {
        isProcessingMovementRef.current = false;
        setIsMoving(false);
        return;
          }
        }

        // Check for wall/obstacle before moving
    const currentPos = predictedPosition || { x: gameState.player.x, y: gameState.player.y };
    const newX = currentPos.x + movement.x;
    const newY = currentPos.y + movement.y;
    
        const hitWall =
          newX < 0 ||
          newX >= maze[0].length ||
          newY < 0 ||
          newY >= maze.length ||
          maze[newY][newX] === 1 ||
      gameState.obstacles.some((obs) => obs.x === newX && obs.y === newY);

        if (!hitWall) {
      // Client-side prediction: immediately update visual position
      const predictedPos = { x: newX, y: newY };
      setPredictedPosition(predictedPos);
      
      // Add to pending moves for server reconciliation
      const moveId = ++moveIdRef.current;
      pendingMovesRef.current.push({
        id: moveId,
        movement,
        timestamp: now
      });
      
      // Don't send to server if game is not playing
      if (gameState.gameStatus !== "playing") {
        console.log(`[Game] Game status: ${gameState.gameStatus}, skipping move API call`);
        isProcessingMovementRef.current = false;
        setIsMoving(false);
        return;
      }
      
      // Send to server
      fetch(`/api/rooms/${roomId}/move`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(movement),
            })
        .then((response) => {
            if (response.ok) {
            return response.json();
          }
          throw new Error("Move failed");
        })
        .then((newState) => {
          // Server confirmed the move
          setGameState(newState);
          setLastMovement(movement);
          
          // Remove confirmed move from pending
          pendingMovesRef.current = pendingMovesRef.current.filter(move => move.id !== moveId);
          
          // Update last confirmed position
          lastConfirmedPositionRef.current = { x: newState.player.x, y: newState.player.y };
          
          // If predicted position matches server position, clear prediction
          if (Math.abs(newState.player.x - predictedPos.x) < 0.1 && 
              Math.abs(newState.player.y - predictedPos.y) < 0.1) {
            setPredictedPosition(null);
          }
        })
        .catch((error) => {
          console.log("Move sync error:", error);
          // On error, revert prediction and remove from pending
          setPredictedPosition(lastConfirmedPositionRef.current || { x: gameState.player.x, y: gameState.player.y });
          pendingMovesRef.current = pendingMovesRef.current.filter(move => move.id !== moveId);
        })
        .finally(() => {
          setTimeout(() => {
            isProcessingMovementRef.current = false;
            setIsMoving(false);
          }, 10);
        });
    } else {
      // If movement was blocked, clear the movement queue to prevent getting stuck
      console.log("[Game] Movement blocked, clearing queue to prevent getting stuck");
      movementQueueRef.current = [];
      isProcessingMovementRef.current = false;
      setIsMoving(false);
    }
  }, [gameState, roomId, lastMovement, predictedPosition]);

  // Server reconciliation - clean up old pending moves
  useEffect(() => {
    if (!gameState) return;
    
    // Clear all pending moves and prediction if game is won or lost
    if (gameState.gameStatus === "won" || gameState.gameStatus === "lost") {
      console.log(`[Game] Game ${gameState.gameStatus}, clearing all pending moves and prediction`);
      setPredictedPosition(null);
      pendingMovesRef.current = [];
      movementQueueRef.current = [];
      return;
    }
    
    const now = Date.now();
    const maxPendingTime = 5000; // 5 seconds max pending time
    
    // Remove old pending moves
    pendingMovesRef.current = pendingMovesRef.current.filter(move => 
      now - move.timestamp < maxPendingTime
    );
    
    // If we have too many pending moves, clear prediction to prevent desync
    if (pendingMovesRef.current.length > 10) {
      console.log("[Game] Too many pending moves, clearing prediction");
      setPredictedPosition(null);
      pendingMovesRef.current = [];
    }
  }, [gameState]);

  // Continuous collision check for "glued" enemies
  useEffect(() => {
    if (!gameState || gameState.gameStatus !== "playing") return;
    
    const checkCollision = async () => {
      const now = Date.now();
      // Debounce collision checks - minimum 1 second between checks
      if (now - lastCollisionCheckRef.current < 1000) {
        return;
      }
      
      // Check if any enemy is on the same position as player
      const hitEnemy = gameState.enemies.some((enemy: any) => {
        const distance = Math.abs(enemy.x - gameState.player.x) + Math.abs(enemy.y - gameState.player.y);
        return distance === 0; // Direct collision
      });
      
      if (hitEnemy) {
        lastCollisionCheckRef.current = now;
        console.log("[Game] Periodic collision check: Enemy detected on player position");
        // Call the collision check API to apply damage
        try {
          const response = await fetch(`/api/rooms/${roomId}/check-collision`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
          });
          if (response.ok) {
            const newState = await response.json();
            if (newState && newState.player.health < gameState.player.health) {
              console.log("[Game] Collision damage applied via periodic check");
              triggerHitEffect();
            }
          }
        } catch (error) {
          console.log("Periodic collision check failed:", error);
        }
      }
    };
    
    // Check for collisions every 3 seconds (reduced frequency to prevent spam)
    const interval = setInterval(checkCollision, 3000);
    
    return () => clearInterval(interval);
  }, [gameState, roomId]);

  // Movement queue health check - prevent getting stuck
  useEffect(() => {
    if (!gameState || gameState.gameStatus !== "playing") return;
    
    const checkQueueHealth = () => {
      // If queue has been stuck for too long, clear it
      if (movementQueueRef.current.length > 0 && isProcessingMovementRef.current) {
        const timeSinceLastMove = Date.now() - (lastMoveTimeRef.current || 0);
        if (timeSinceLastMove > 2000) { // 2 seconds
          console.log("[Game] Movement queue stuck for too long, clearing to prevent getting stuck");
          movementQueueRef.current = [];
          isProcessingMovementRef.current = false;
          setIsMoving(false);
        }
      }
    };
    
    const interval = setInterval(checkQueueHealth, 1000);
    
    return () => clearInterval(interval);
  }, [gameState]);

  // Game loop - ULTRA SMOOTH VERSION
  useEffect(() => {
    if (!gameState) return

    let interval: NodeJS.Timeout | null = null
    let enemyMoveInterval: NodeJS.Timeout | null = null

    // Stop all game processes if game is won or lost
    if (gameState.gameStatus === "won" || gameState.gameStatus === "lost") {
      console.log(`[Game] Game ${gameState.gameStatus}, stopping all game processes`)
    return () => {
        if (interval) clearInterval(interval);
        if (enemyMoveInterval) clearInterval(enemyMoveInterval);
      };
    }

    // Ultra-smooth game loop at 60 FPS
    interval = setInterval(updateGame, 16) // ~60 FPS (1000ms / 60 = 16.67ms)

    // State polling for real-time updates
      const poll = async () => {
      // Don't poll if game is not playing
      if (gameState.gameStatus !== "playing") {
        console.log(`[Game] Game status: ${gameState.gameStatus}, skipping state poll`);
        return;
      }
      
        try {
          const response = await fetch(`/api/rooms/${roomId}/state`)
          if (response.ok) {
          const newState = await response.json()
          if (newState && !newState.error) {
            // Check if player got hit (health decreased)
            if (gameState && newState.player && newState.player.health < gameState.player.health) {
              triggerHitEffect()
            }
            
            // Check for continuous enemy collision (for "glued" enemies)
            if (gameState && newState.player && newState.enemies) {
              const hitEnemy = newState.enemies.some((enemy: any) => {
                const distance = Math.abs(enemy.x - newState.player.x) + Math.abs(enemy.y - newState.player.y);
                return distance === 0; // Direct collision
              });
              
              if (hitEnemy && newState.player.health === gameState.player.health) {
                console.log("[Game] Continuous enemy collision detected! Calling collision check API");
                // Call the collision check API to apply damage
                fetch(`/api/rooms/${roomId}/check-collision`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" }
                }).catch(error => {
                  console.log("Collision check API call failed:", error);
                });
              }
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

    // Adaptive state polling - more frequent when ping is high, less frequent when smooth
    const pollInterval = ping && ping > 200 ? 300 : 500; // 300ms for high ping, 500ms for low ping
    const stateInterval = setInterval(poll, pollInterval)

    // Enemy movement
      const moveEnemies = async () => {
      // Don't move enemies if game is not playing
      if (gameState.gameStatus !== "playing") {
        console.log(`[Game] Game status: ${gameState.gameStatus}, skipping enemy movement`);
        return;
      }
      
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
  }, [gameState?.gameStatus, roomId, updateGame])

  // Ping counter: measure round-trip time for /api/ping request every 2s
  useEffect(() => {
    let cancelled = false;
    let consecutiveFailures = 0;
    const maxFailures = 3;
    
    // Stop ping measurement if game is won or lost
    if (gameState?.gameStatus === "won" || gameState?.gameStatus === "lost") {
      console.log(`[Game] Game ${gameState.gameStatus}, stopping ping measurement`)
      return () => {};
    }
    
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
  }, [gameState?.gameStatus]);

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

    // Draw player with Pacman design - use predicted position for smoother movement
    const playerPos = predictedPosition || { x: gameState.player.x, y: gameState.player.y };
    const playerX = playerPos.x * cellSize + cellSize / 2
    const playerY = playerPos.y * cellSize + cellSize / 2
    const playerRadius = cellSize / 2 - 2
    
    // Enhanced smooth movement effects
    const time = Date.now() * 0.01 // Smooth time-based animation
    const shakeOffset = playerHit ? Math.sin(time * 20) * 3 : 0
    const moveOffset = isMoving ? Math.sin(time * 30) * 1.5 : 0
    const pulseScale = isMoving ? 1 + Math.sin(time * 25) * 0.1 : 1
    const finalPlayerX = playerX + shakeOffset + moveOffset
    const finalPlayerY = playerY + shakeOffset + moveOffset
    
    // Enhanced player glow - red if hit, yellow if normal, with pulsing effect
    // Add blue glow when using predicted movement
    const isPredicted = predictedPosition && (
      Math.abs(predictedPosition.x - gameState.player.x) > 0.1 || 
      Math.abs(predictedPosition.y - gameState.player.y) > 0.1
    );
    const glowIntensity = isMoving ? 25 : (playerHit ? 20 : 15)
    ctx.shadowColor = isPredicted ? "#3B82F6" : (playerHit ? "#EF4444" : "#FBBF24")
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
    if (gameState?.gameStatus !== "playing") return;
    const interval = setInterval(() => {
      if (baseTimeLeftRef.current != null && lastUpdateRef.current != null) {
        const elapsed = Math.floor((Date.now() - lastUpdateRef.current) / 1000);
        setDisplayTimeLeft(Math.max(0, baseTimeLeftRef.current - elapsed));
      }
    }, 50);
    return () => clearInterval(interval);
  }, [gameState?.gameStatus]);

  // Presence system
  useEffect(() => {
    let heartbeat: NodeJS.Timeout | null = null
    let isActive = true
    
    // Stop presence system if game is won or lost
    if (gameState?.gameStatus === "won" || gameState?.gameStatus === "lost") {
      console.log(`[Game] Game ${gameState.gameStatus}, stopping presence system`)
      return () => {
        if (heartbeat) clearInterval(heartbeat)
      };
    }
    
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

  // Show celebration when game is won and clear all game processes
  useEffect(() => {
    if (gameState?.gameStatus === "won" && !showCelebration) {
      setShowCelebration(true)
      console.log("[Game] Game won! Clearing all game processes and stopping all API calls")
      
      // Clear all pending moves and movement queue
      setPredictedPosition(null)
      pendingMovesRef.current = []
      movementQueueRef.current = []
      isProcessingMovementRef.current = false
      setIsMoving(false)
      
      // Clear hit effect
      if (hitTimeoutRef.current) {
        clearTimeout(hitTimeoutRef.current);
        hitTimeoutRef.current = null;
      }
      setPlayerHit(false);
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
        <div className={`relative bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 p-8 rounded-3xl shadow-2xl text-center max-w-md mx-4 border-4 border-white/30 backdrop-blur-sm`}>
          {/* Glowing border effect */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 blur-xl opacity-50"></div>
          
          {/* Content */}
          <div className="relative z-10">
            {/* Trophy Icon */}
            <div className={`text-8xl mb-6`} style={{ animationDuration: '2s' }}>
            🏆
          </div>
          
            {/* Victory Text */}
            <h1 className="text-4xl font-black text-white mb-4">
              VICTORY!
          </h1>
          
            {/* Score Display */}
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-white/30">
              <div className="text-white/90 text-lg mb-2">Final Score</div>
              <div className="text-5xl font-black text-white">
                {gameState?.player.score || 0}
              </div>
            </div>
            
            {/* Health Remaining */}
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-white/30">
              <div className="text-white/90 text-lg mb-2">Health Remaining</div>
              <div className="text-3xl font-bold text-green-400">
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
            <div className="mt-6 text-white">
              🎉 Amazing job! You conquered the maze! 🎉
            </div>
          </div>
        </div>

        {/* Floating Celebration Elements */}
        <div className="absolute top-10 left-10 text-4xl">🎊</div>
        <div className="absolute top-20 right-20 text-3xl">⭐</div>
        <div className="absolute bottom-20 left-20 text-3xl">🎈</div>
        <div className="absolute bottom-10 right-10 text-4xl">🎊</div>
      </div>
    )
  }

  const connectPetra = async () => {
    if (typeof window !== 'undefined' && (window as any).petra) {
      setPetraLoading(true)
      try {
        const response = await (window as any).petra.connect()
        setWalletAddress(response.address)
        // Save to Firestore
        await setDoc(doc(db, "rooms", roomId), { walletAddress: response.address }, { merge: true })
      } catch (e) {
        alert("Failed to connect Petra")
      } finally {
        setPetraLoading(false)
      }
    } else {
      alert("Petra wallet not found")
    }
  }

  // Force disconnect Petra wallet on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).petra && (window as any).petra.disconnect) {
      (window as any).petra.disconnect();
      setWalletAddress(null);
    }
  }, []);

  // Leaderboard state
  useEffect(() => {
    const fetchLeaderboard = async () => {
      const q = query(collection(db, 'leaderboard'), orderBy('points', 'desc'), limit(10));
      const snapshot = await getDocs(q);
      setLeaderboard(snapshot.docs.map(doc => doc.data()));
    };
    fetchLeaderboard();
  }, []);

  // Auth state
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const handleSignOut = async () => {
    const auth = getAuth();
    await signOut(auth);
  };

  // Award points to user on win
  const awardPoints = async (difficulty: string, user: any) => {
    if (!user) return;
    let points = 0;
    if (difficulty === "easy") points = 25;
    else if (difficulty === "medium") points = 50;
    else if (difficulty === "hard") points = 100;

    await setDoc(
      doc(db, "leaderboard", user.uid),
      {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        points: increment(points),
      },
      { merge: true }
    );
  };

  // Award points and refresh leaderboard on win
  useEffect(() => {
    if (gameState?.gameStatus === "won" && user) {
      awardPoints(difficulty, user).then(() => {
        // Refresh leaderboard after awarding points
        const fetchLeaderboard = async () => {
          const q = query(collection(db, 'leaderboard'), orderBy('points', 'desc'), limit(10));
          const snapshot = await getDocs(q);
          setLeaderboard(snapshot.docs.map(doc => doc.data()));
        };
        fetchLeaderboard();
      });
    }
  }, [gameState?.gameStatus, user]);

  if (!user) {
    return (
      <div className="min-h-screen p-4 flex flex-col items-center justify-center" style={{ backgroundImage: `url('/arcade.gif')`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
        <div className="absolute inset-0 bg-black/70 z-0" />
        <div className="relative z-10 flex flex-col items-center gap-8">
          <div className="text-white text-4xl font-bold mb-4">Sign in to Play</div>
          <Button onClick={signInWithGoogle} className="text-lg px-8 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-xl shadow-lg">
            Sign in with Google
          </Button>
        </div>
      </div>
    );
  }
  if (!walletAddress) {
    return (
      <div className="min-h-screen p-4 flex flex-col items-center justify-center" style={{ backgroundImage: `url('/arcade.gif')`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
        <div className="absolute inset-0 bg-black/70 z-0" />
        <div className="relative z-10 flex flex-col items-center gap-8">
          <div className="text-white text-4xl font-bold mb-4">Choose Game Mode</div>
          <div className="flex gap-4 mb-6">
            {['easy', 'medium', 'hard'].map(mode => (
              <button
                key={mode}
                onClick={() => setSelectedMode(mode)}
                className={`px-6 py-3 rounded-xl text-lg font-semibold border-2 transition-all duration-150 ${selectedMode === mode ? 'bg-yellow-400 text-black border-yellow-500 scale-105' : 'bg-black/40 text-white border-white/30 hover:bg-yellow-400 hover:text-black hover:border-yellow-500'}`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          {selectedMode && (
            <Button onClick={connectPetra} disabled={petraLoading} className="text-lg px-8 py-3">
              {petraLoading ? "Connecting..." : "Connect Petra Wallet"}
            </Button>
          )}
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
      className="min-h-screen p-4 relative overflow-hidden"
      tabIndex={0}
      onFocus={() => console.log("Game focused - ready for input!")}
      style={{
        outline: "none",
        backgroundImage: `url('/arcade.gif')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-black/70 pointer-events-none z-0" />
      <div className="relative z-10 max-w-5xl mx-auto flex flex-col gap-8">
        {/* Main Game Area and Sidebar */}
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 min-w-0">
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
                       {gameState.player.score}
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
        {/* Leaderboard Section - aligned with game area and sidebar */}
        <div className="w-full mt-12 flex justify-center">
          <div className="w-full max-w-5xl">
            <div className="bg-black/80 rounded-2xl shadow-2xl p-8 border border-yellow-400/40">
              <div className="text-yellow-400 text-2xl font-bold mb-6 flex items-center gap-2">
                🏆 Leaderboard
              </div>
              <ol className="space-y-3">
                {leaderboard.length === 0 && (
                  <li className="text-white/70 text-center">No scores yet.</li>
                )}
                {leaderboard.map((user: any, i: number) => (
                  <li key={user.email || i} className="flex items-center gap-3 bg-white/10 rounded-lg px-4 py-3">
                    <span className="text-lg font-bold text-yellow-300 w-6 text-center">{i + 1}</span>
                    {user.photoURL && typeof user.photoURL === 'string' && user.photoURL.startsWith('http') ? (
                      <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full border-2 border-yellow-400 object-cover" />
                    ) : (
                      <span className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center text-black font-bold">{user.displayName?.[0] || '?'}</span>
                    )}
                    <span className="flex-1 truncate text-white font-semibold">{user.displayName || user.email}</span>
                    <span className="text-yellow-200 font-mono text-lg">{user.points}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
        {/* User Info Bar - fixed top right */}
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-black/80 px-4 py-2 rounded-xl shadow-lg border border-yellow-400/30 backdrop-blur-md">
          {user.photoURL && typeof user.photoURL === 'string' && user.photoURL.startsWith('http') ? (
            <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full border-2 border-yellow-400 object-cover" />
          ) : (
            <span className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center text-black font-bold">{user.displayName?.[0] || '?'}</span>
          )}
          <span className="text-white font-semibold max-w-[120px] truncate">{user.displayName || user.email}</span>
          <Button onClick={handleSignOut} size="sm" className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-3 py-1 rounded-lg ml-2">Sign Out</Button>
        </div>
      </div>
    </div>
  )
}
