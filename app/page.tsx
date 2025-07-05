"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Gamepad2, Eye } from "lucide-react"

export default function HomePage() {
  const [roomId, setRoomId] = useState("")
  const router = useRouter()

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-white mb-4 tracking-tight">
            <span className="text-yellow-400">Maze</span>Runner
          </h1>
          <p className="text-xl text-gray-300 mb-2">Navigate the maze, avoid enemies, reach the goal!</p>
          <p className="text-lg text-gray-400">Viewers can watch live and sabotage players with crypto payments</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Gamepad2 className="h-6 w-6 text-green-400" />
                Start Playing
              </CardTitle>
              <CardDescription className="text-gray-300">
                Create a new room and start your maze adventure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={createRoom}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3"
                size="lg"
              >
                Create New Game
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Eye className="h-6 w-6 text-blue-400" />
                Watch & Sabotage
              </CardTitle>
              <CardDescription className="text-gray-300">
                Join a room to watch live gameplay and use sabotage actions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Enter Room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                maxLength={6}
              />
              <Button
                onClick={joinRoom}
                disabled={!roomId.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3"
                size="lg"
              >
                Join as Viewer
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <h2 className="text-2xl font-bold text-white mb-6">Sabotage Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: "🐌", name: "Slow Down", cost: "10 tokens", desc: "Reduce speed by 30%" },
              { icon: "🧱", name: "Block Path", cost: "15 tokens", desc: "Place obstacle" },
              { icon: "💔", name: "Damage", cost: "20 tokens", desc: "Reduce health" },
              { icon: "👹", name: "Spawn Enemy", cost: "25 tokens", desc: "Add enemy nearby" },
            ].map((action, i) => (
              <div key={i} className="bg-gray-800/30 rounded-lg p-4 text-center">
                <div className="text-3xl mb-2">{action.icon}</div>
                <div className="text-white font-semibold">{action.name}</div>
                <div className="text-yellow-400 text-sm">{action.cost}</div>
                <div className="text-gray-400 text-xs mt-1">{action.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
