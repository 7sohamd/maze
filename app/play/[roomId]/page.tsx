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

// Move CelebrationUI to top-level (outside GamePage)
const CelebrationUI = ({ onClose, gameState, router }: { onClose: () => void, gameState: any, router: any }) => {
  const [isClient, setIsClient] = useState(false)
  useEffect(() => { setIsClient(true) }, [])
  useEffect(() => {
    const timer = setTimeout(() => { onClose() }, 5000)
    return () => clearTimeout(timer)
  }, [onClose])
  if (!isClient) return null
  const confetti = Array.from({ length: 30 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2.5 + Math.random() * 1.5,
    color: [
      '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1',
      '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8',
    ][Math.floor(Math.random() * 8)],
    size: 8 + Math.random() * 8,
    rotate: Math.random() * 360,
    id: i
  }))
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        {confetti.map(p => (
          <div
            key={p.id}
            style={{
              left: `${p.left}%`,
              top: 0,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              borderRadius: '50%',
              position: 'absolute',
              opacity: 0.85,
              transform: `rotate(${p.rotate}deg)`,
              animation: `fall ${p.duration}s linear ${p.delay}s 1 both`
            }}
          />
        ))}
        <style>{`
          @keyframes fall {
            to {
              top: 100vh;
              opacity: 0.2;
              transform: translateY(20px) scale(0.8);
            }
          }
        `}</style>
      </div>
      <div className="relative bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 p-8 rounded-3xl shadow-2xl text-center max-w-md mx-4 border-4 border-white/30 backdrop-blur-sm transition-all duration-700 animate-fade-in scale-95 animate-scale-in">
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 blur-xl opacity-40"></div>
        <div className="relative z-10">
          <div className="text-8xl mb-6 transition-transform duration-700 animate-fade-in animate-scale-in">🏆</div>
          <h1 className="text-4xl font-black text-white mb-4 drop-shadow-2xl animate-fade-in">VICTORY!</h1>
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-white/30">
            <div className="text-white/90 text-lg mb-2">Final Score</div>
            <div className="text-5xl font-black text-white drop-shadow-lg">{gameState?.player.score || 0}</div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-white/30">
            <div className="text-white/90 text-lg mb-2">Health Remaining</div>
            <div className="text-3xl font-bold text-green-400 drop-shadow-lg">❤️ {gameState?.player.health || 0}</div>
          </div>
          <div className="flex gap-4 justify-center">
            <button
              onClick={onClose}
              className="bg-white/20 hover:bg-white/30 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 border border-white/30 backdrop-blur-sm"
            >
              🎮 Play Again
            </button>
            <button
              onClick={() => router.push("/")}
              className="bg-white/20 hover:bg-white/30 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 border border-white/30 backdrop-blur-sm"
            >
              🏠 Home
            </button>
          </div>
          <div className="mt-6 text-white/90 text-sm animate-fade-in">🎉 Amazing job! You conquered the maze! 🎉</div>
        </div>
      </div>
      <div className="absolute top-10 left-10 text-4xl opacity-80 animate-fade-in" style={{ animationDelay: '0.5s' }}>🎊</div>
      <div className="absolute top-20 right-20 text-3xl opacity-80 animate-fade-in" style={{ animationDelay: '1s' }}>⭐</div>
      <div className="absolute bottom-20 left-20 text-3xl opacity-80 animate-fade-in" style={{ animationDelay: '1.5s' }}>🎈</div>
      <div className="absolute bottom-10 right-10 text-4xl opacity-80 animate-fade-in" style={{ animationDelay: '2s' }}>🎊</div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scale-in { from { transform: scale(0.8); } to { transform: scale(1); } }
        .animate-fade-in { animation: fade-in 0.7s ease both; }
        .animate-scale-in { animation: scale-in 0.7s cubic-bezier(.4,2,.6,1) both; }
      `}</style>
    </div>
  )
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

  // Track all intervals/timeouts in refs
  const gameLoopIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const stateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const enemyMoveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const keydownListenerRef = useRef<any>(null)
  const keyupListenerRef = useRef<any>(null)

  // Wallet connect UI as a variable, not an early return
  const walletConnectUI = (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-pink-900 to-red-900">
      <Card className="w-full max-w-md bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white press-start-bold text-2xl mb-2">Connect Your Petra Wallet</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={playerWallet.connect}
            disabled={playerWallet.loading}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-2 rounded-lg text-lg press-start-bold mb-2"
          >
            {playerWallet.loading ? "Connecting..." : "🔗 Connect Petra Wallet"}
          </Button>
          {playerWallet.error && (
            <div className="text-red-400 text-sm mt-2">{playerWallet.error}</div>
          )}
          <div className="text-gray-400 text-xs mt-4">You must connect your Petra wallet to play the game.</div>
        </CardContent>
      </Card>
    </div>
  )

  // Conditional rendering after all hooks
  let content;
  if (showCelebration) {
    content = (
      <CelebrationUI onClose={() => {
        setShowCelebration(false);
        router.push("/");
      }} gameState={gameState} router={router} />
    );
  } else if (!playerWallet.isConnected) {
    content = walletConnectUI;
  } else if (loading) {
    content = (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    );
  } else {
    content = (
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
                onClick={() => {
                  navigator.clipboard.writeText(roomId)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
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
                onClick={() => {
                  const url = `${window.location.origin}/watch/${roomId}`
                  if (navigator.share) {
                    navigator.share({ title: "Join my MazeRunner room!", url })
                  } else {
                    navigator.clipboard.writeText(url)
                    alert("Invite link copied!")
                  }
                }}
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
                ⏰ {displayTimeLeft !== null ? Math.floor(displayTimeLeft / 60) : 0}:{displayTimeLeft !== null ? Math.floor(displayTimeLeft % 60).toString().padStart(2, "0") : "00"}
          </div>
              <div className="flex items-center gap-2 text-green-400 font-bold text-lg bg-black/30 px-4 py-2 rounded-full">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                {ping !== null ? `${ping} ms` : "-"}
        </div>
            </div>
          </div>

          {/* Win/Lose Popup */}
          {gameState?.gameStatus === "lost" && (
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
    );
  }

  return content;
}
