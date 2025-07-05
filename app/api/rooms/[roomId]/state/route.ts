import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { getFallbackViewerCount, isFirebaseQuotaExceeded } from "../presence/route"

export async function GET(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  try {
    // Check if Firebase quota is exceeded
    if (isFirebaseQuotaExceeded()) {
      console.log(`[State GET] Firebase quota exceeded, using fallback mode for room: ${roomId}`)
      const fallbackViewers = getFallbackViewerCount(roomId)
      
      // Return a basic game state with fallback viewer count
      return NextResponse.json({ 
        gameStatus: "playing",
        viewers: fallbackViewers,
        timeLeft: 120,
        player: { x: 1, y: 1, health: 100, speed: 1, score: 0 },
        enemies: [],
        obstacles: [],
        goal: { x: 15, y: 15 },
        maze: [],
        fallback: true
      })
    }
    
    const roomRef = doc(db, "rooms", roomId)
    const roomSnap = await getDoc(roomRef)
    if (!roomSnap.exists()) {
      // Return a waiting state instead of 404
      console.log(`[State GET] Room ${roomId} not found, returning waiting state with 0 viewers`)
      return NextResponse.json({ 
        gameStatus: "waiting",
        message: "Room not initialized yet",
        viewers: 0,
        timeLeft: 0
      })
    }
    const gameState = roomSnap.data()
    
    console.log(`[State GET] Room ${roomId} - viewers: ${gameState.viewers}, status: ${gameState.gameStatus}`)

    // Decrement timer
    if (typeof gameState.timeLeft === "number") {
      const now = Date.now();
      const lastUpdate = gameState.lastUpdate || now;
      const elapsed = Math.floor((now - lastUpdate) / 1000);
      if (elapsed > 0) {
        gameState.timeLeft = Math.max(0, gameState.timeLeft - elapsed);
        if (gameState.timeLeft === 0) {
          gameState.gameStatus = "lost";
        }
      }
      gameState.lastUpdate = now;
      
      // Only update Firestore if significant time has passed (reduce Firebase writes)
      if (elapsed >= 5) { // Only update every 5 seconds to reduce quota usage
        try {
          await updateDoc(roomRef, {
            timeLeft: gameState.timeLeft,
            lastUpdate: gameState.lastUpdate,
            gameStatus: gameState.gameStatus
          })
        } catch (error: any) {
          // Handle Firebase quota exceeded error
          if (error.code === 'resource-exhausted') {
            console.warn('Firebase quota exceeded, continuing without update')
            // Continue without updating Firestore
          } else {
            throw error // Re-throw other errors
          }
        }
      }
    }

    return NextResponse.json({
      ...gameState,
      playerWallet: gameState.playerWallet || null // Ensure playerWallet is always present
    })
  } catch (error: any) {
    console.error("State fetch error:", error)
    
    // Handle Firebase quota exceeded error
    if (error.code === 'resource-exhausted') {
      console.warn('Firebase quota exceeded, returning fallback state')
      const fallbackViewers = getFallbackViewerCount(roomId)
      
      return NextResponse.json({ 
        gameStatus: "playing",
        message: "Using fallback mode due to service limits",
        viewers: fallbackViewers,
        timeLeft: 120,
        player: { x: 1, y: 1, health: 100, speed: 1, score: 0 },
        enemies: [],
        obstacles: [],
        goal: { x: 15, y: 15 },
        maze: [],
        fallback: true
      })
    }
    
    return NextResponse.json({ error: "Failed to fetch state" }, { status: 500 })
  }
}
