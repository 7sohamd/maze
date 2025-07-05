import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, getDoc, updateDoc } from "firebase/firestore"

export async function GET(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  try {
    const roomRef = doc(db, "rooms", roomId)
    const roomSnap = await getDoc(roomRef)
    if (!roomSnap.exists()) {
      // Return a waiting state instead of 404
      return NextResponse.json({ 
        gameStatus: "waiting",
        message: "Room not initialized yet",
        viewers: 0,
        timeLeft: 0
      })
    }
    const gameState = roomSnap.data()

    // Increment viewer count only if x-new-viewer header is present
    const isNewViewer = request.headers.get("x-new-viewer") === "true";
    if (isNewViewer) {
      const newViewerCount = (gameState.viewers || 0) + 1;
      await updateDoc(roomRef, { viewers: newViewerCount })
      gameState.viewers = newViewerCount
    }

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
      
      // Update the timer in Firestore
      await updateDoc(roomRef, {
        timeLeft: gameState.timeLeft,
        lastUpdate: gameState.lastUpdate,
        gameStatus: gameState.gameStatus
      })
    }

    return NextResponse.json(gameState)
  } catch (error: any) {
    console.error("State fetch error:", error)
    
    // Handle Firebase quota exceeded error
    if (error.code === 'resource-exhausted') {
      console.warn('Firebase quota exceeded, returning waiting state')
      return NextResponse.json({ 
        gameStatus: "waiting",
        message: "Service temporarily unavailable",
        viewers: 0,
        timeLeft: 0
      })
    }
    
    return NextResponse.json({ error: "Failed to fetch state" }, { status: 500 })
  }
}
