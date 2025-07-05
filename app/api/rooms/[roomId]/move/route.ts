import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, getDoc, updateDoc } from "firebase/firestore"

export async function POST(request: NextRequest, { params }: { params: { roomId: string } }) {
  const roomId = params.roomId;
  try {
    const movement = await request.json()
    const roomRef = doc(db, "rooms", roomId)
    const roomSnap = await getDoc(roomRef)
    if (!roomSnap.exists()) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 })
    }
    const gameState = roomSnap.data()
    const player = gameState.player
    // Parse maze if it's a string
    let maze = gameState.maze
    if (typeof maze === "string") {
      maze = JSON.parse(maze)
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
      (gameState.obstacles && gameState.obstacles.some((obs) => obs.x === newX && obs.y === newY))
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

    // Check for enemy collision
    const hitEnemy = gameState.enemies.some(
      (enemy) => enemy.x === player.x && enemy.y === player.y
    );
    if (hitEnemy) {
      player.health = Math.max(0, player.health - 25);
      if (player.health <= 0) {
        gameState.gameStatus = "lost";
      }
    }

    // Move enemies randomly
    gameState.enemies.forEach((enemy) => {
      const directions = [
        { x: 0, y: -1 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: -1, y: 0 },
      ]
      const direction = directions[Math.floor(Math.random() * directions.length)]
      const newEnemyX = enemy.x + direction.x
      const newEnemyY = enemy.y + direction.y
      if (
        newEnemyX >= 0 &&
        newEnemyX < maze[0].length &&
        newEnemyY >= 0 &&
        newEnemyY < maze.length &&
        maze[newEnemyY][newEnemyX] === 0
      ) {
        enemy.x = newEnemyX
        enemy.y = newEnemyY
      }
    })
    await updateDoc(roomRef, {
      player: gameState.player,
      enemies: gameState.enemies,
      gameStatus: gameState.gameStatus,
      timeLeft: gameState.timeLeft,
      lastUpdate: gameState.lastUpdate,
      lastMove: gameState.lastMove
    })
    return NextResponse.json(gameState)
  } catch (error) {
    console.error("Move error:", error)
    return NextResponse.json({ error: "Failed to process move" }, { status: 500 })
  }
}
