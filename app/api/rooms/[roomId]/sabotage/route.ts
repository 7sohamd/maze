import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, getDoc, updateDoc } from "firebase/firestore"

// Helper: BFS to find shortest path from (sx, sy) to (gx, gy)
function findShortestPath(maze, obstacles, sx, sy, gx, gy) {
  const queue = [[sx, sy, []]];
  const visited = Array.from({ length: maze.length }, () => Array(maze[0].length).fill(false));
  obstacles = obstacles.map(o => `${o.x},${o.y}`);
  visited[sy][sx] = true;
  while (queue.length) {
    const [x, y, path] = queue.shift();
    if (x === gx && y === gy) return path;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (
        nx >= 0 && nx < maze[0].length &&
        ny >= 0 && ny < maze.length &&
        maze[ny][nx] === 0 &&
        !visited[ny][nx] &&
        !obstacles.includes(`${nx},${ny}`)
      ) {
        visited[ny][nx] = true;
        queue.push([nx, ny, [...path, { x: nx, y: ny }]]);
      }
    }
  }
  return null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const { action } = await request.json()
    const roomRef = doc(db, "rooms", roomId)
    const roomSnap = await getDoc(roomRef)
    if (!roomSnap.exists()) {
      return NextResponse.json({ error: "Game not found or not active" }, { status: 404 })
    }
    const gameState = roomSnap.data()
    const player = gameState.player
    switch (action) {
      case "slow":
        if (typeof gameState.timeLeft === "number") {
          gameState.timeLeft = Math.max(0, gameState.timeLeft - 10)
        }
        break
      case "block": {
        let maze = gameState.maze
        if (typeof maze === "string") maze = JSON.parse(maze)
        const { x: px, y: py } = player
        const { x: gx, y: gy } = gameState.goal
        const path = findShortestPath(maze, gameState.obstacles, px, py, gx, gy)
        let blockCell = null
        if (path && path.length >= 2) {
          blockCell = path[Math.min(2, path.length - 1)]
        } else if (path && path.length > 0) {
          blockCell = path[path.length - 1]
        }
        if (blockCell) {
          // Simulate adding the obstacle and check if a path still exists
          const newObstacles = [...gameState.obstacles, { x: blockCell.x, y: blockCell.y }]
          const newPath = findShortestPath(maze, newObstacles, px, py, gx, gy)
          if (newPath && newPath.length > 0) {
            gameState.obstacles.push({
              id: `obstacle_${Date.now()}`,
              x: blockCell.x,
              y: blockCell.y,
            })
          } else {
            // No path would remain, do not allow sabotage
            return NextResponse.json({ error: "Cannot block all paths to goal" }, { status: 400 })
          }
        }
        break
      }
      case "damage":
        player.health = Math.max(0, player.health - 25)
        if (player.health <= 0) {
          gameState.gameStatus = "lost"
        }
        break
      case "enemy": {
        let maze = gameState.maze
        if (typeof maze === "string") maze = JSON.parse(maze)
        const { x: px, y: py } = player
        const { x: gx, y: gy } = gameState.goal
        const path = findShortestPath(maze, gameState.obstacles.concat(gameState.enemies), px, py, gx, gy)
        let enemyCell = null
        if (path && path.length >= 2) {
          // Try to find a cell that is not the player or goal
          for (let i = 1; i < Math.min(3, path.length); i++) {
            const cell = path[i]
            if ((cell.x !== px || cell.y !== py) && (cell.x !== gx || cell.y !== gy)) {
              enemyCell = cell
              break
            }
          }
          if (!enemyCell) enemyCell = path[Math.min(2, path.length - 1)]
        } else if (path && path.length > 0) {
          enemyCell = path[path.length - 1]
        }
        if (enemyCell && (enemyCell.x !== px || enemyCell.y !== py) && (enemyCell.x !== gx || enemyCell.y !== gy)) {
          gameState.enemies.push({
            id: `enemy_${Date.now()}`,
            x: enemyCell.x,
            y: enemyCell.y,
          })
        } else {
          return NextResponse.json({ error: "No valid cell to spawn enemy" }, { status: 400 })
        }
        break;
      }
    }
    await updateDoc(roomRef, {
      player: gameState.player,
      enemies: gameState.enemies,
      obstacles: gameState.obstacles,
      gameStatus: gameState.gameStatus,
      timeLeft: gameState.timeLeft
    })
    return NextResponse.json(gameState)
  } catch (error) {
    console.error("Sabotage error:", error)
    return NextResponse.json({ error: "Failed to process sabotage" }, { status: 500 })
  }
}

// Add a check endpoint to validate sabotage before transaction
export async function check(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const { action } = await request.json();
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) {
      return NextResponse.json({ allowed: false, reason: "Game not found or not active" }, { status: 404 });
    }
    const gameState = roomSnap.data();
    switch (action) {
      case "slow":
        if (gameState.timeLeft <= 0) {
          return NextResponse.json({ allowed: false, reason: "Cannot slow, time is already zero." });
        }
        if (gameState.timeLeft <= 15) {
          return NextResponse.json({ allowed: false, reason: "Cannot slow, less than 15 seconds left." });
        }
        break;
      case "block": {
        let maze = gameState.maze;
        if (typeof maze === "string") maze = JSON.parse(maze);
        const { x: px, y: py } = gameState.player;
        const { x: gx, y: gy } = gameState.goal;
        // Use the same path logic as in POST
        const path = findShortestPath(maze, gameState.obstacles, px, py, gx, gy);
        let blockCell = null;
        if (path && path.length >= 2) {
          blockCell = path[Math.min(2, path.length - 1)];
        } else if (path && path.length > 0) {
          blockCell = path[path.length - 1];
        }
        if (blockCell) {
          // Simulate adding the obstacle and check if a path still exists
          const newObstacles = [...gameState.obstacles, { x: blockCell.x, y: blockCell.y }];
          const newPath = findShortestPath(maze, newObstacles, px, py, gx, gy);
          if (!newPath || newPath.length === 0) {
            return NextResponse.json({ allowed: false, reason: "Blocking this path would leave no way to the goal." });
          }
        } else {
          return NextResponse.json({ allowed: false, reason: "No valid cell to block." });
        }
        break;
      }
      case "damage":
        if (gameState.player.health <= 30) {
          return NextResponse.json({ allowed: false, reason: "Player health is too low to damage further." });
        }
        break;
      case "enemy": {
        let maze = gameState.maze;
        if (typeof maze === "string") maze = JSON.parse(maze);
        const { x: px, y: py } = gameState.player;
        const { x: gx, y: gy } = gameState.goal;
        const path = findShortestPath(maze, gameState.obstacles.concat(gameState.enemies), px, py, gx, gy);
        let enemyCell = null;
        if (path && path.length >= 2) {
          for (let i = 1; i < Math.min(3, path.length); i++) {
            const cell = path[i];
            if ((cell.x !== px || cell.y !== py) && (cell.x !== gx || cell.y !== gy)) {
              enemyCell = cell;
              break;
            }
          }
          if (!enemyCell) enemyCell = path[Math.min(2, path.length - 1)];
        } else if (path && path.length > 0) {
          enemyCell = path[path.length - 1];
        }
        if (!enemyCell || (enemyCell.x === px && enemyCell.y === py) || (enemyCell.x === gx && enemyCell.y === gy)) {
          return NextResponse.json({ allowed: false, reason: "No valid cell to spawn enemy." });
        }
        break;
      }
    }
    return NextResponse.json({ allowed: true });
  } catch (error) {
    return NextResponse.json({ allowed: false, reason: "Failed to check sabotage." }, { status: 500 });
  }
}
