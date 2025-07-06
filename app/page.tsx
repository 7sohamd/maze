"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Volume2, VolumeX } from "lucide-react"

export default function LandingPage() {
  const router = useRouter()
  const [showOptions, setShowOptions] = useState(false)
  const [showCredits, setShowCredits] = useState(false)
  const [muted, setMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [hasMounted, setHasMounted] = useState(false)
  const [showFade, setShowFade] = useState(true)

  useEffect(() => {
    setHasMounted(true)
    // Fade out the overlay after a short delay
    const timeout = setTimeout(() => setShowFade(false), 800)
    return () => clearTimeout(timeout)
  }, [])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = muted
    }
  }, [muted])

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
        <Button variant="ghost" className="self-stretch text-white font-bold py-8 text-4xl text-left px-0 press-start-bold" onClick={() => router.push("/leaderboard")}>Leaderboard</Button>
        <Button variant="ghost" className="self-stretch text-white font-bold py-8 text-4xl text-left px-0 press-start-bold" onClick={() => setShowOptions(true)}>Options</Button>
        <Button variant="ghost" className="self-stretch text-white font-bold py-8 text-4xl text-left px-0 press-start-bold" onClick={() => setShowCredits(true)}>Credits</Button>
        <Button 
          variant="ghost" 
          className="self-stretch text-white font-bold py-8 text-4xl text-left px-0 text-red-400 press-start-bold"
          onClick={() => window.open('https://youtu.be/xvFZjo5PgG0?si=QAgFvB7AR-w2l-zo', '_blank')}
        >
          Quit Game
        </Button>
      </section>

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

      {/* Face GIF at top right with blend mode */}
      <div style={{ position: 'fixed', top: 0, right: 0, zIndex: 30, pointerEvents: 'none' }}>
        <img
          src="/face.gif"
          alt="Face"
          style={{
            width: '260px',
            height: 'auto',
            mixBlendMode: 'screen',
            opacity: 0.95,
            display: 'block',
            maxWidth: '45vw',
            minWidth: '160px',
          }}
        />
      </div>
    </>
  )
}
