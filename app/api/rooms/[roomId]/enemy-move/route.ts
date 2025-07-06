import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { isFirebaseQuotaExceeded } from "../presence/route"

// Enemy movement function
function moveEnemies(gameState: any, maze: number[][]) {
  const player = gameState.player
  const difficultySettings = gameState.difficultySettings || { enemyChaseRate: 0.75, enemySpeed: 2 }
  
  gameState.enemies.forEach((enemy: any) => {
    // Calculate distance to player
    const distanceToPlayer = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y);
    
    // If enemy is very close to player (distance 1 or 0), increase random movement chance
    const isCloseToPlayer = distanceToPlayer <= 1;
    const randomChance = isCloseToPlayer ? 0.8 : 0.3; // 80% random movement when close, 30% normally
    const shouldChase = Math.random() > randomChance;
    
    let direction
    if (shouldChase && !isCloseToPlayer) {
      // Calculate direction towards player
      const dx = player.x - enemy.x
      const dy = player.y - enemy.y
      
      // Prioritize the direction with larger difference
      if (Math.abs(dx) > Math.abs(dy)) {
        direction = { x: dx > 0 ? 1 : -1, y: 0 }
      } else {
        direction = { x: 0, y: dy > 0 ? 1 : -1 }
      }
    } else {
      // Random movement - ONLY cardinal directions (no diagonal)
      const directions = [
        { x: 0, y: -1 },   // Up
        { x: 1, y: 0 },    // Right
        { x: 0, y: 1 },    // Down
        { x: -1, y: 0 },   // Left
      ]
      direction = directions[Math.floor(Math.random() * directions.length)]
    }
    
    // Move only ONE step at a time to prevent wall glitching
    const newEnemyX = enemy.x + direction.x
    const newEnemyY = enemy.y + direction.y
    
    // Check if the move is valid (within bounds, not a wall, not an obstacle)
    if (
      newEnemyX >= 0 &&
      newEnemyX < maze[0].length &&
      newEnemyY >= 0 &&
      newEnemyY < maze.length &&
      maze[newEnemyY][newEnemyX] === 0 &&
      !gameState.obstacles.some((obs: any) => obs.x === newEnemyX && obs.y === newEnemyY) &&
      !gameState.enemies.some((otherEnemy: any) => otherEnemy.id !== enemy.id && otherEnemy.x === newEnemyX && otherEnemy.y === newEnemyY)
    ) {
      enemy.x = newEnemyX
      enemy.y = newEnemyY
    }
    
    // If no movement was possible and we were chasing, try random movement as fallback
    if (shouldChase && enemy.x === player.x - direction.x && enemy.y === player.y - direction.y) {
      const fallbackDirections = [
        { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }
      ]
      const fallbackDir = fallbackDirections[Math.floor(Math.random() * fallbackDirections.length)]
      const fallbackX = enemy.x + fallbackDir.x
      const fallbackY = enemy.y + fallbackDir.y
      
      if (
        fallbackX >= 0 &&
        fallbackX < maze[0].length &&
        fallbackY >= 0 &&
        fallbackY < maze.length &&
        maze[fallbackY][fallbackX] === 0 &&
        !gameState.obstacles.some((obs: any) => obs.x === fallbackX && obs.y === fallbackY) &&
        !gameState.enemies.some((otherEnemy: any) => otherEnemy.id !== enemy.id && otherEnemy.x === fallbackX && otherEnemy.y === fallbackY)
      ) {
        enemy.x = fallbackX
        enemy.y = fallbackY
      }
    }
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  try {
    // If Firebase quota is exceeded, return a simple response to reduce load
    if (isFirebaseQuotaExceeded()) {
      console.log("Firebase quota exceeded, skipping enemy movement")
      return NextResponse.json({ 
        status: "fallback",
        message: "Using fallback mode due to service limits"
      })
    }
    
    const roomRef = doc(db, "rooms", roomId)
    const roomSnap = await getDoc(roomRef)
    if (!roomSnap.exists()) {
      // Return success but with no action if room doesn't exist yet
      return NextResponse.json({ status: "waiting" })
    }
    
    const gameState = roomSnap.data()
    
    // Only move enemies if game is still playing and has required data
    if (!gameState || gameState.gameStatus !== "playing" || !gameState.enemies || !gameState.player) {
      return NextResponse.json(gameState || { error: "Invalid game state" })
    }
    
    // Parse maze if it's a string
    let maze = gameState.maze
    if (typeof maze === "string") {
      maze = JSON.parse(maze)
    }
    
    // Move enemies aggressively
    moveEnemies(gameState, maze)
    
    // Check for enemy collision with player - IMPROVED DETECTION
    const hitEnemy = gameState.enemies.some(
      (enemy: any) => {
        const distance = Math.abs(enemy.x - gameState.player.x) + Math.abs(enemy.y - gameState.player.y);
        return distance === 0; // Direct collision
      }
    );
    
    if (hitEnemy) {
      console.log("Enemy collision detected! Player health before:", gameState.player.health);
      gameState.player.health = Math.max(0, gameState.player.health - 25);
      console.log("Player health after collision:", gameState.player.health);
      
      if (gameState.player.health <= 0) {
        gameState.gameStatus = "lost";
        console.log("Game over - player health depleted");
      }
    }
    
    try {
      await updateDoc(roomRef, {
        enemies: gameState.enemies,
        player: gameState.player,
        gameStatus: gameState.gameStatus
      })
    } catch (error: any) {
      // Handle Firebase quota exceeded error
      if (error.code === 'resource-exhausted') {
        console.warn('Firebase quota exceeded during enemy movement, continuing without update')
        // Continue without updating Firestore
      } else {
        throw error // Re-throw other errors
      }
    }
    
    return NextResponse.json(gameState)
  } catch (error: any) {
    console.error("Enemy move error:", error)
    
    // Handle Firebase quota exceeded error
    if (error.code === 'resource-exhausted') {
      console.warn('Firebase quota exceeded, returning current state')
      return NextResponse.json({ 
        error: "Service temporarily unavailable",
        gameStatus: "waiting"
      })
    }
    
    return NextResponse.json({ error: "Failed to move enemies" }, { status: 500 })
  }
} 