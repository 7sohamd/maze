import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, getDoc, updateDoc } from "firebase/firestore"

export async function POST(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  try {
    const roomRef = doc(db, "rooms", roomId)
    const roomSnap = await getDoc(roomRef)
    if (!roomSnap.exists()) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 })
    }
    
    const gameState = roomSnap.data()
    
    // Only check collision if game is playing
    if (!gameState || gameState.gameStatus !== "playing" || !gameState.enemies || !gameState.player) {
      return NextResponse.json(gameState || { error: "Invalid game state" })
    }
    
    // Check for enemy collision with player
    const hitEnemy = gameState.enemies.some(
      (enemy: any) => {
        const distance = Math.abs(enemy.x - gameState.player.x) + Math.abs(enemy.y - gameState.player.y);
        return distance === 0; // Direct collision
      }
    );
    
    if (hitEnemy) {
      console.log("Continuous enemy collision detected! Player health before:", gameState.player.health);
      gameState.player.health = Math.max(0, gameState.player.health - 25);
      console.log("Player health after collision:", gameState.player.health);
      
      if (gameState.player.health <= 0) {
        gameState.gameStatus = "lost";
        console.log("Game over - player health depleted");
      }
      
      // Update the game state in Firestore
      await updateDoc(roomRef, {
        player: gameState.player,
        gameStatus: gameState.gameStatus
      })
    }
    
    return NextResponse.json(gameState)
  } catch (error: any) {
    console.error("Collision check error:", error)
    return NextResponse.json({ error: "Failed to check collision" }, { status: 500 })
  }
} 