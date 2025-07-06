"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Ghost, 
  Gamepad2, 
  Eye, 
  Zap, 
  Users, 
  Trophy, 
  Shield, 
  Sword, 
  Star, 
  X 
} from "lucide-react"

interface DifficultyMode {
  id: string
  name: string
  description: string
  icon: string
  color: string
  features: string[]
}

const difficultyModes: DifficultyMode[] = [
  {
    id: "easy",
    name: "Easy",
    description: "Perfect for beginners",
    icon: "😊",
    color: "from-green-400 to-green-600",
    features: ["Fewer enemies", "Slower ghost speed", "More power pellets"]
  },
  {
    id: "medium",
    name: "Medium",
    description: "Balanced challenge",
    icon: "😐",
    color: "from-yellow-400 to-yellow-600",
    features: ["Standard enemy count", "Normal ghost speed", "Regular power pellets"]
  },
  {
    id: "hard",
    name: "Hard",
    description: "For experienced players",
    icon: "😈",
    color: "from-red-400 to-red-600",
    features: ["More enemies", "Faster ghost speed", "Fewer power pellets"]
  }
]

export default function LandingPage() {
  const router = useRouter()
  const [showOptions, setShowOptions] = useState(false)
  const [showCredits, setShowCredits] = useState(false)
  const [showDifficultyModal, setShowDifficultyModal] = useState(false)
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyMode | null>(null)

  const handleCreateGame = () => {
    setShowDifficultyModal(true)
  }

  const handleDifficultySelect = (mode: DifficultyMode) => {
    setSelectedDifficulty(mode)
  }

  const handleStartGame = () => {
    if (selectedDifficulty) {
      // Generate a random room ID
      const roomId = Math.random().toString(36).substring(2, 8)
      router.push(`/play/${roomId}?difficulty=${selectedDifficulty.id}`)
    }
  }

  return (
    <>
      {/* Black fade-in overlay */}
      {showFade && (
        <div className="fixed inset-0 z-50 bg-black animate-fadeout pointer-events-none" />
      )}
      {/* Full-page background GIF */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: "url('/background.gif')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
        aria-hidden="true"
      />
      {/* Black fade overlay */}
      <div className="fixed inset-0 bg-black/70 -z-5 pointer-events-none" aria-hidden="true" />
      {/* Centered logo, but higher and with a pulsating animation */}
      <img
        src="/logo.png"
        alt="Maze Game Logo"
        className="absolute left-1/2 top-1/4 -translate-x-1/2 -translate-y-1/2 w-128 h-128 object-contain drop-shadow-xl select-none pointer-events-none animate-pulse"
        draggable="false"
      />
      {/* Background music and speaker button only on client */}
      {hasMounted && (
        <>
          <audio ref={audioRef} src="/background.mp3" autoPlay loop hidden />
          <button
            className="fixed bottom-8 right-8 z-20 bg-black/60 rounded-full p-4 shadow-lg hover:bg-black/80 transition-colors"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="w-8 h-8 text-white" /> : <Volume2 className="w-8 h-8 text-white" />}
          </button>
        </>
      )}
      <section
        className="fixed bottom-0 left-0 m-8 z-10 flex flex-col items-start p-10 bg-black/0 rounded-2xl shadow-2xl text-left"
        style={{ minWidth: 340 }}
      >
        <Button
          variant="ghost"
          className="self-stretch text-white font-bold py-8 text-4xl text-left px-0 press-start-bold"
          onClick={() => {
            const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            router.push(`/play/${newRoomId}`);
          }}
        >
          Start Game
        </Button>
        <Button variant="ghost" className="self-stretch text-white font-bold py-8 text-4xl text-left px-0 press-start-bold" onClick={() => router.push("/watch")}>Multiplayer</Button>
        <Button variant="ghost" className="self-stretch text-white font-bold py-8 text-4xl text-left px-0 press-start-bold" onClick={() => setShowOptions(true)}>Options</Button>
        <Button variant="ghost" className="self-stretch text-white font-bold py-8 text-4xl text-left px-0 press-start-bold" onClick={() => setShowCredits(true)}>Credits</Button>
        <Button variant="ghost" className="self-stretch text-white font-bold py-8 text-4xl text-left px-0 text-red-400 press-start-bold">Quit Game</Button>
      </section>

      <div className="relative z-10 container mx-auto px-4 py-16">
        {/* Hero Section with background.gif */}
        <div
          className="relative rounded-3xl overflow-hidden mb-16"
          style={{
            backgroundImage: "url('/background.gif')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            minHeight: '340px',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)'
          }}
        >
          {/* Optional overlay for readability */}
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-10 text-center py-16 px-4">
            <h1 className="text-6xl font-black text-white mb-6 drop-shadow-2xl flex items-center justify-center gap-4 press-start-bold">
              <Ghost className="h-16 w-16 text-yellow-400" />
              PACMAN MAZE
              <Ghost className="h-16 w-16 text-yellow-400" />
            </h1>
            <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto drop-shadow-lg ">
              Navigate the maze, collect dots, avoid ghosts, and reach the goal! 
              Challenge your friends with real-time sabotage actions.
            </p>
          </div>
        </div>

        {/* Main Actions */}
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
          <Button
            onClick={handleCreateGame}
            size="lg"
            className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-black font-bold text-xl px-8 py-6 rounded-2xl shadow-2xl hover:shadow-3xl transform hover:-translate-y-1 transition-all duration-300 press-start-bold"
          >
            <Gamepad2 className="h-6 w-6 mr-3" />
            Create New Game
          </Button>
          
          <Button
            onClick={() => router.push("/watch")}
            variant="outline"
            size="lg"
            className="bg-white/10 border-white/30 text-white hover:bg-white/20 backdrop-blur-sm font-bold text-xl px-8 py-6 rounded-2xl shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 press-start-bold"
          >
            <Eye className="h-6 w-6 mr-3" />
            Watch Game
          </Button>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-white text-xl font-bold flex items-center gap-2 press-start-bold">
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
              <CardTitle className="text-white text-xl font-bold flex items-center gap-2 press-start-bold">
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
              <CardTitle className="text-white text-xl font-bold flex items-center gap-2 press-start-bold">
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
          <h2 className="text-4xl font-black text-white mb-8 drop-shadow-2xl flex items-center justify-center gap-3 press-start-bold">
            <Shield className="h-10 w-10" />
            Difficulty Modes
            <Sword className="h-10 w-10" />
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {difficultyModes.map((mode) => (
              <div key={mode.id} className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 text-center transform hover:scale-105 transition-all duration-300 hover:shadow-xl border-0 press-start-bold">
                <div className="text-4xl mb-3">{mode.icon}</div>
                <div className={`bg-gradient-to-r ${mode.color} text-white font-bold py-2 px-4 rounded-full text-sm mb-3 press-start-bold`}>
                  {mode.name}
                </div>
                <div className="text-gray-800 font-semibold text-lg mb-2 press-start-bold">{mode.description}</div>
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
          <div className="flex items-center justify-center gap-4 text-white/80 text-lg press-start-bold">
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
              <h2 className="text-3xl font-black text-white press-start-bold">Choose Difficulty</h2>
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
                      ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-black shadow-2xl press-start-bold'
                      : 'bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 press-start-bold'
                  }`}
                >
                  <div className="text-6xl mb-4 text-center">{mode.icon}</div>
                  <h3 className={`text-2xl font-bold mb-3 text-center ${
                    selectedDifficulty?.id === mode.id ? 'text-black press-start-bold' : 'text-white press-start-bold'
                  }`}>
                    {mode.name}
                  </h3>
                  <p className={`text-sm mb-4 ${
                    selectedDifficulty?.id === mode.id ? 'text-black/80 press-start-bold' : 'text-white/80 press-start-bold'
                  }`}>
                    {mode.description}
                  </p>
                  <div className="space-y-2">
                    {mode.features.map((feature, i) => (
                      <div key={i} className={`flex items-center gap-2 text-sm ${
                        selectedDifficulty?.id === mode.id ? 'text-black/90 press-start-bold' : 'text-white/90 press-start-bold'
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
                    ? 'bg-gradient-to-r from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white press-start-bold'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed press-start-bold'
                }`}
              >
                {selectedDifficulty ? `Start ${selectedDifficulty.name}` : 'Select Difficulty'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Controls Guide Modal */}
      {showOptions && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="bg-gray-900 rounded-2xl p-8 max-w-sm w-full text-white relative">
            <h2 className="text-2xl font-bold mb-4 text-yellow-300">Controls Guide</h2>
            <ul className="space-y-2 mb-6">
              <li><span className="font-bold text-yellow-200">W</span> - Move Up</li>
              <li><span className="font-bold text-yellow-200">A</span> - Move Left</li>
              <li><span className="font-bold text-yellow-200">S</span> - Move Down</li>
              <li><span className="font-bold text-yellow-200">D</span> - Move Right</li>
              <li><span className="font-bold text-yellow-200">Arrow Keys</span> - Move</li>
              <li><span className="font-bold text-yellow-200">Mouse Click</span> - Move to cell</li>
            </ul>
            <Button className="w-full" onClick={() => setShowOptions(false)}>Close</Button>
          </div>
        </div>
      )}

      {/* Credits Modal */}
      {showCredits && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="bg-gray-900 rounded-2xl p-8 max-w-sm w-full text-white relative">
            <h2 className="text-2xl font-bold mb-4 text-yellow-300">Credits</h2>
            <ul className="space-y-2 mb-6 text-lg">
              <li>Soham Dey</li>
              <li>Dibyendu Mandal</li>
              <li>Rohit Raj</li>
            </ul>
            <Button className="w-full" onClick={() => setShowCredits(false)}>Close</Button>
          </div>
        </div>
      )}
    </>
  )
}
