import { NextResponse } from "next/server"

function generateMaze(width: number, height: number, extraConnections = 10): number[][] {
  // Initialize maze with walls
  const maze: number[][] = Array(height)
    .fill(null)
    .map(() => Array(width).fill(1))

  // Recursive backtracking maze generation
  const stack: Array<[number, number]> = []
  const visited: boolean[][] = Array(height)
    .fill(null)
    .map(() => Array(width).fill(false))

  // Start from an odd position to ensure proper maze structure
  let currentX = 1
  let currentY = 1
  maze[currentY][currentX] = 0
  visited[currentY][currentX] = true

  const directions = [
    [0, -2], // Up
    [2, 0], // Right
    [0, 2], // Down
    [-2, 0], // Left
  ]

  while (true) {
    const neighbors: Array<[number, number]> = []

    // Find unvisited neighbors (2 cells away)
    for (const [dx, dy] of directions) {
      const newX = currentX + dx
      const newY = currentY + dy

      if (newX > 0 && newX < width - 1 && newY > 0 && newY < height - 1 && !visited[newY][newX]) {
        neighbors.push([newX, newY])
      }
    }

    if (neighbors.length > 0) {
      // Choose random neighbor
      const [nextX, nextY] = neighbors[Math.floor(Math.random() * neighbors.length)]

      // Remove wall between current and next cell
      const wallX = currentX + (nextX - currentX) / 2
      const wallY = currentY + (nextY - currentY) / 2
      maze[wallY][wallX] = 0
      maze[nextY][nextX] = 0

      visited[nextY][nextX] = true
      stack.push([currentX, currentY])
      currentX = nextX
      currentY = nextY
    } else if (stack.length > 0) {
      // Backtrack
      ;[currentX, currentY] = stack.pop()!
    } else {
      break
    }
  }

  // Ensure start and end positions are clear
  maze[1][1] = 0 // Start position
  maze[height - 2][width - 2] = 0 // End position

  // Create a path from start to end if they're not connected
  for (let x = 1; x < width - 2; x += 2) {
    maze[1][x] = 0
  }
  for (let y = 1; y < height - 2; y += 2) {
    maze[y][width - 2] = 0
  }

  // Add extra connections to make multiple paths (easy mode)
  let added = 0
  const tryLimit = extraConnections * 10
  let tries = 0
  while (added < extraConnections && tries < tryLimit) {
    const x = Math.floor(Math.random() * (width - 2)) + 1
    const y = Math.floor(Math.random() * (height - 2)) + 1
    // Only remove a wall if it's not on the border and is a wall
    if (
      maze[y][x] === 1 &&
      x > 0 && x < width - 1 &&
      y > 0 && y < height - 1 &&
      // Only remove vertical or horizontal walls between two open cells
      ((maze[y][x - 1] === 0 && maze[y][x + 1] === 0) || (maze[y - 1][x] === 0 && maze[y + 1][x] === 0))
    ) {
      maze[y][x] = 0
      added++
    }
    tries++
  }

  return maze
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const difficulty = searchParams.get('difficulty') || 'medium'
    
    // Difficulty-based maze settings
    const mazeSettings = {
      easy: { width: 25, height: 20, extraConnections: 25 }, // Smaller, more open maze
      medium: { width: 35, height: 25, extraConnections: 18 }, // Standard maze
      hard: { width: 40, height: 28, extraConnections: 12 } // Large but manageable maze
    }
    
    const settings = mazeSettings[difficulty as keyof typeof mazeSettings] || mazeSettings.medium
    
    // Use odd dimensions for proper maze generation
    const width = settings.width
    const height = settings.height

    // Generate maze based on difficulty
    const maze = generateMaze(width, height, settings.extraConnections)

    // Fixed positions
    const playerStart = { x: 1, y: 1 }
    const goal = { x: width - 2, y: height - 2 }

    // Generate enemies based on difficulty
    const enemyCounts = { easy: 2, medium: 3, hard: 4 }
    const enemyCount = enemyCounts[difficulty as keyof typeof enemyCounts] || 3
    
    const enemies = []
    for (let i = 0; i < enemyCount; i++) {
      let x, y
      let attempts = 0
      do {
        x = Math.floor(Math.random() * (width - 4)) + 2
        y = Math.floor(Math.random() * (height - 4)) + 2
        attempts++
      } while (
        (maze[y][x] === 1 || 
         (x === playerStart.x && y === playerStart.y) || 
         (x === goal.x && y === goal.y) ||
         enemies.some(enemy => Math.abs(enemy.x - x) < 3 && Math.abs(enemy.y - y) < 3)) && // Keep enemies spread out
        attempts < 50
      )

      if (attempts < 50 && maze[y][x] === 0) {
        enemies.push({
          id: `enemy_${i}`,
          x,
          y,
        })
      }
    }

    return NextResponse.json({
      maze,
      playerStart,
      goal,
      enemies,
      metadata: {
        width,
        height,
        difficulty: 1,
        theme: "dungeon",
      },
    })
  } catch (error) {
    console.error("Map generation error:", error)
    return NextResponse.json({ error: "Failed to generate map" }, { status: 500 })
  }
}
