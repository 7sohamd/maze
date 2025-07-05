"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Gamepad2, Eye, Ghost, Dot, Star, Zap, Users, Trophy, X, Shield, Sword } from "lucide-react"

interface DifficultyMode {
  id: string
  name: string
  description: string
  icon: string
  color: string
  enemyCount: number
  enemySpeed: number
  enemyChaseRate: number
  playerHealth: number
  timeLimit: number
  features: string[]
}

const difficultyModes: DifficultyMode[] = [
  {
    id: "easy",
    name: "Easy Mode",
    description: "Perfect for beginners - relaxed gameplay with fewer enemies",
    icon: "🛡️",
    color: "from-green-400 to-green-600",
    enemyCount: 2,
    enemySpeed: 1,
    enemyChaseRate: 0.6,
    playerHealth: 150,
    timeLimit: 180,
    features: ["2 Slow Ghosts", "150 Health", "3 Minutes", "Relaxed Pacing"]
  },
  {
    id: "medium",
    name: "Medium Mode",
    description: "Balanced challenge - classic Pacman experience",
    icon: "⚔️",
    color: "from-yellow-400 to-orange-500",
    enemyCount: 3,
    enemySpeed: 2,
    enemyChaseRate: 0.75,
    playerHealth: 100,
    timeLimit: 120,
    features: ["3 Medium Ghosts", "100 Health", "2 Minutes", "Classic Challenge"]
  },
  {
    id: "hard",
    name: "Hard Mode",
    description: "Ultimate challenge - fast and aggressive enemies",
    icon: "💀",
    color: "from-red-500 to-red-700",
    enemyCount: 4,
    enemySpeed: 3,
    enemyChaseRate: 0.9,
    playerHealth: 75,
    timeLimit: 90,
    features: ["4 Fast Ghosts", "75 Health", "90 Seconds", "Extreme Challenge"]
  }
]

export default function HomePage() {
  const [roomId, setRoomId] = useState("")
  const router = useRouter()
  const [showDifficultyModal, setShowDifficultyModal] = useState(false)
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyMode | null>(null)
  const [isClient, setIsClient] = useState(false)

  const createRoom = async () => {
    try {
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase()
      console.log("Creating room:", newRoomId)

      // Create room on server
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: newRoomId }),
      })

      if (!response.ok) {
        let error
        try {
          error = await response.json()
        } catch (e) {
          error = { error: "Failed to parse error response" }
        }
        console.error("Failed to create room:", error)
        alert(`Failed to create room: ${error.error || error.details || 'Unknown error'}`)
        return
      }

      console.log("Room created successfully, navigating to:", `/play/${newRoomId}`)
      router.push(`/play/${newRoomId}`)
    } catch (error) {
      console.error("Error creating room:", error)
      alert("Error creating room. Please check your connection and try again.")
    }
  }

  const joinRoom = () => {
    if (roomId.trim()) {
      router.push(`/watch/${roomId.toUpperCase()}`)
    }
  }

  const handleCreateGame = () => {
    setShowDifficultyModal(true)
  }

  const handleDifficultySelect = (difficulty: DifficultyMode) => {
    setSelectedDifficulty(difficulty)
  }

  const handleStartGame = async () => {
    if (selectedDifficulty) {
      try {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase()
        console.log("Creating room for game:", roomId)

        // Create room on server
        const response = await fetch("/api/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: roomId }),
        })

        if (!response.ok) {
          let error
          try {
            error = await response.json()
          } catch (e) {
            error = { error: "Failed to parse error response" }
          }
          console.error("Failed to create room:", error)
          alert(`Failed to create room: ${error.error || error.details || 'Unknown error'}`)
          return
        }

        console.log("Room created successfully, navigating to:", `/play/${roomId}?difficulty=${selectedDifficulty.id}`)
        router.push(`/play/${roomId}?difficulty=${selectedDifficulty.id}`)
      } catch (error) {
        console.error("Error creating room:", error)
        alert("Error creating room. Please check your connection and try again.")
      }
    }
  }

  // Set client flag after hydration to prevent hydration mismatch
  useEffect(() => {
    setIsClient(true)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 relative overflow-hidden">
      {/* Animated background - only render on client to prevent hydration mismatch */}
      {isClient && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-yellow-400 rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-6xl font-black text-white mb-6 drop-shadow-2xl flex items-center justify-center gap-4">
            <Ghost className="h-16 w-16 text-yellow-400" />
            PACMAN MAZE
            <Ghost className="h-16 w-16 text-yellow-400" />
          </h1>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto drop-shadow-lg">
            Navigate the maze, collect dots, avoid ghosts, and reach the goal! 
            Challenge your friends with real-time sabotage actions.
          </p>
        </div>

        {/* Main Actions */}
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
          <Button
            onClick={handleCreateGame}
            size="lg"
            className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-black font-bold text-xl px-8 py-6 rounded-2xl shadow-2xl hover:shadow-3xl transform hover:-translate-y-1 transition-all duration-300"
          >
            <Gamepad2 className="h-6 w-6 mr-3" />
            Create New Game
          </Button>
          
          <Button
            onClick={() => router.push("/watch")}
            variant="outline"
            size="lg"
            className="bg-white/10 border-white/30 text-white hover:bg-white/20 backdrop-blur-sm font-bold text-xl px-8 py-6 rounded-2xl shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300"
          >
            <Eye className="h-6 w-6 mr-3" />
            Watch Game
          </Button>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-white text-xl font-bold flex items-center gap-2">
                <Zap className="h-6 w-6 text-yellow-400" />
                Real-time Multiplayer
              </CardTitle>
            </CardHeader>
            <CardContent className="text-white/90">
              <p>Play with friends in real-time. Share your room code and let others join as viewers with sabotage powers!</p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-white text-xl font-bold flex items-center gap-2">
                <Users className="h-6 w-6 text-blue-400" />
                Viewer Sabotage
              </CardTitle>
            </CardHeader>
            <CardContent className="text-white/90">
              <p>Spectators can use tokens to sabotage the player with obstacles, enemies, and other challenges!</p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-white text-xl font-bold flex items-center gap-2">
                <Trophy className="h-6 w-6 text-yellow-400" />
                Multiple Difficulties
              </CardTitle>
            </CardHeader>
            <CardContent className="text-white/90">
              <p>Choose from Easy, Medium, and Hard modes. Each offers a unique challenge with different enemy counts and speeds!</p>
            </CardContent>
          </Card>
        </div>

        {/* Difficulty Modes Preview */}
        <div className="text-center">
          <h2 className="text-4xl font-black text-white mb-8 drop-shadow-2xl flex items-center justify-center gap-3">
            <Shield className="h-10 w-10" />
            Difficulty Modes
            <Sword className="h-10 w-10" />
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {difficultyModes.map((mode) => (
              <div key={mode.id} className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 text-center transform hover:scale-105 transition-all duration-300 hover:shadow-xl border-0">
                <div className="text-4xl mb-3">{mode.icon}</div>
                <div className={`bg-gradient-to-r ${mode.color} text-white font-bold py-2 px-4 rounded-full text-sm mb-3`}>
                  {mode.name}
                </div>
                <div className="text-gray-800 font-semibold text-lg mb-2">{mode.description}</div>
                <div className="text-gray-600 text-sm space-y-1">
                  {mode.features.map((feature, i) => (
                    <div key={i} className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-16">
          <div className="flex items-center justify-center gap-4 text-white/80 text-lg">
            <Star className="h-6 w-6" />
            <span>Collect dots, avoid ghosts, reach the goal!</span>
            <Star className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Difficulty Selection Modal */}
      {showDifficultyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-black text-white">Choose Difficulty</h2>
              <Button
                onClick={() => setShowDifficultyModal(false)}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {difficultyModes.map((mode) => (
                <div
                  key={mode.id}
                  onClick={() => handleDifficultySelect(mode)}
                  className={`cursor-pointer rounded-2xl p-6 transition-all duration-300 transform hover:scale-105 ${
                    selectedDifficulty?.id === mode.id
                      ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-black shadow-2xl'
                      : 'bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20'
                  }`}
                >
                  <div className="text-6xl mb-4 text-center">{mode.icon}</div>
                  <h3 className={`text-2xl font-bold mb-3 text-center ${
                    selectedDifficulty?.id === mode.id ? 'text-black' : 'text-white'
                  }`}>
                    {mode.name}
                  </h3>
                  <p className={`text-sm mb-4 ${
                    selectedDifficulty?.id === mode.id ? 'text-black/80' : 'text-white/80'
                  }`}>
                    {mode.description}
                  </p>
                  <div className="space-y-2">
                    {mode.features.map((feature, i) => (
                      <div key={i} className={`flex items-center gap-2 text-sm ${
                        selectedDifficulty?.id === mode.id ? 'text-black/90' : 'text-white/90'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          selectedDifficulty?.id === mode.id ? 'bg-black' : 'bg-green-400'
                        }`}></div>
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-center">
              <Button
                onClick={handleStartGame}
                disabled={!selectedDifficulty}
                size="lg"
                className={`font-bold text-xl px-8 py-4 rounded-xl shadow-xl transform hover:-translate-y-1 transition-all duration-300 ${
                  selectedDifficulty
                    ? 'bg-gradient-to-r from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                {selectedDifficulty ? `Start ${selectedDifficulty.name}` : 'Select Difficulty'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
