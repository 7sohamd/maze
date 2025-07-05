"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Eye, Users, Gamepad2 } from "lucide-react"

export default function WatchPage() {
  const router = useRouter()
  const [roomId, setRoomId] = useState("")
  const [error, setError] = useState("")
  const [isClient, setIsClient] = useState(false)

  const handleJoinRoom = () => {
    if (!roomId.trim()) {
      setError("Please enter a room ID")
      return
    }
    
    // Validate room ID format (alphanumeric, 6 characters)
    if (!/^[A-Z0-9]{6}$/.test(roomId.trim().toUpperCase())) {
      setError("Room ID must be 6 characters (letters and numbers)")
      return
    }
    
    setError("")
    router.push(`/watch/${roomId.trim().toUpperCase()}`)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleJoinRoom()
    }
  }

  // Set client flag after hydration to prevent hydration mismatch
  useEffect(() => {
    setIsClient(true)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 p-4 relative overflow-hidden">
      {/* Animated background elements - only render on client to prevent hydration mismatch */}
      {isClient && (
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
      )}

      <div className="relative z-10 max-w-2xl mx-auto pt-20">
        {/* Header */}
        <div className="text-center mb-8">
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="mb-6 bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          
          <div className="text-white text-4xl font-bold mb-4 drop-shadow-2xl press-start-bold">
            👻 Viewer Mode
          </div>
          <div className="text-white/80 text-lg drop-shadow press-start-bold">
            Join a game room to watch and sabotage players!
          </div>
        </div>

        {/* Room Join Card */}
        <Card className="bg-black/60 border-white/20 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white text-2xl font-bold flex items-center gap-2 drop-shadow-lg press-start-bold">
              <Eye className="h-6 w-6 text-pink-400" />
              Join Game Room
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-white text-sm font-semibold mb-2 drop-shadow press-start-bold">
                Room ID (6 characters)
              </label>
              <Input
                type="text"
                value={roomId}
                onChange={(e) => {
                  setRoomId(e.target.value.toUpperCase())
                  setError("")
                }}
                onKeyPress={handleKeyPress}
                placeholder="Enter room ID (e.g., ABC123)"
                className="bg-white/20 border-white/30 text-white placeholder-white/50 focus:border-pink-400 focus:ring-pink-400"
                maxLength={6}
              />
              {error && (
                <div className="text-red-400 text-sm mt-2 font-semibold">
                  ⚠️ {error}
                </div>
              )}
            </div>

            <Button
              onClick={handleJoinRoom}
              disabled={!roomId.trim()}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none press-start-bold"
            >
              <Eye className="h-5 w-5 mr-2" />
              Join Room
            </Button>
          </CardContent>
        </Card>

        {/* Features Card */}
        <Card className="bg-black/60 border-white/20 mt-6 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white text-xl font-bold drop-shadow-lg press-start-bold">
              🎮 Viewer Features
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 text-white">
              <div className="w-8 h-8 bg-pink-400/20 rounded-lg flex items-center justify-center">
                <Users className="h-4 w-4 text-pink-400" />
              </div>
              <div>
                <div className="font-semibold press-start-bold">Watch Live Games</div>
                <div className="text-sm text-white/70">See players navigate through mazes in real-time</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 text-white">
              <div className="w-8 h-8 bg-red-400/20 rounded-lg flex items-center justify-center">
                <Gamepad2 className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <div className="font-semibold press-start-bold">Sabotage Players</div>
                <div className="text-sm text-white/70">Use tokens to make the game more challenging</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 text-white">
              <div className="w-8 h-8 bg-yellow-400/20 rounded-lg flex items-center justify-center">
                <Eye className="h-4 w-4 text-yellow-400" />
              </div>
              <div>
                <div className="font-semibold press-start-bold">Voice Commands</div>
                <div className="text-sm text-white/70">Use AI-powered voice sabotage (Chrome/Edge)</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <div className="text-center mt-8 text-white/60 text-sm">
          <p>💡 Ask a friend for their room ID to join their game!</p>
          <p className="mt-2">Room IDs are 6-character codes like "ABC123" or "XYZ789"</p>
        </div>
      </div>
    </div>
  )
} 