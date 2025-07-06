import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, getDoc, updateDoc } from "firebase/firestore"

// Enemy movement function that can be called independently
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
    const movement = await request.json()
    const roomRef = doc(db, "rooms", roomId)
    const roomSnap = await getDoc(roomRef)
    if (!roomSnap.exists()) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 })
    }
    const gameState = roomSnap.data()
    
    // Validate game state
    if (!gameState || !gameState.player || !gameState.maze) {
      return NextResponse.json({ error: "Invalid game state" }, { status: 400 })
    }
    
    const player = gameState.player
    // Parse maze if it's a string
    let maze = gameState.maze
    if (typeof maze === "string") {
      try {
      maze = JSON.parse(maze)
      } catch (e) {
        return NextResponse.json({ error: "Invalid maze data" }, { status: 400 })
      }
    }
    const newX = player.x + movement.x
    const newY = player.y + movement.y
    // Check bounds, walls, and obstacles
    if (
      newX < 0 ||
      newX >= maze[0].length ||
      newY < 0 ||
      newY >= maze.length ||
      maze[newY][newX] === 1 ||
      (gameState.obstacles && gameState.obstacles.some((obs: any) => obs.x === newX && obs.y === newY))
    ) {
      // Invalid move: out of bounds, wall, or obstacle
      return NextResponse.json(gameState)
    }
    // Valid move
    player.x = newX
    player.y = newY
    // Track last movement direction
    gameState.lastMove = { x: movement.x, y: movement.y }

    // Decrement timer (pause if won)
    if (typeof gameState.timeLeft === "number" && gameState.gameStatus !== "won") {
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
    }

    // Check for goal
    if (player.x === gameState.goal.x && player.y === gameState.goal.y) {
      gameState.gameStatus = "won";
      player.score += 1000;
    }

    // Check for enemy collision - IMPROVED DETECTION
    const hitEnemy = gameState.enemies.some(
      (enemy: any) => {
        const distance = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y);
        return distance === 0; // Direct collision
      }
    );
    
    if (hitEnemy) {
      console.log("Enemy collision detected in move! Player health before:", player.health);
      player.health = Math.max(0, player.health - 25);
      console.log("Player health after collision:", player.health);
      
      if (player.health <= 0) {
        gameState.gameStatus = "lost";
        console.log("Game over - player health depleted");
      }
    }

    // Move enemies more aggressively with smarter movement and higher speed
    moveEnemies(gameState, maze)
    
    await updateDoc(roomRef, {
      player: gameState.player,
      enemies: gameState.enemies,
      gameStatus: gameState.gameStatus,
      timeLeft: gameState.timeLeft,
      lastUpdate: gameState.lastUpdate,
      lastMove: gameState.lastMove
    })
    return NextResponse.json(gameState)
  } catch (error: any) {
    console.error("Move error:", error)
    
    // Handle Firebase quota exceeded error
    if (error.code === 'resource-exhausted') {
      console.warn('Firebase quota exceeded, returning current state')
      return NextResponse.json({ 
        error: "Service temporarily unavailable",
        gameStatus: "waiting"
      })
    }
    
    return NextResponse.json({ error: "Failed to process move" }, { status: 500 })
  }
}
