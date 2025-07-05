import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    // Create a simple test game state without Firebase
    const testGameState = {
      player: {
        x: 1,
        y: 1,
        health: 100,
        speed: 1.0,
        score: 0,
      },
      enemies: [
        { id: "enemy1", x: 5, y: 5 },
        { id: "enemy2", x: 8, y: 8 }
      ],
      obstacles: [],
      goal: {
        x: 15,
        y: 15
      },
      maze: [
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1],
        [1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1],
        [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,0,1],
        [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,0,1],
        [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0,1],
        [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
        [1,0,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
        [1,0,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1],
        [1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
        [1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1],
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
      ],
      gameStatus: "playing" as const,
      viewers: 1,
      timeLeft: 120,
      difficulty: "medium",
      difficultySettings: {
        enemyCount: 2,
        enemySpeed: 2,
        enemyChaseRate: 0.75,
        playerHealth: 100,
        timeLimit: 120,
      }
    }
    
    return NextResponse.json(testGameState)
  } catch (error) {
    console.error("Test room error:", error)
    return NextResponse.json({ error: "Failed to create test room" }, { status: 500 })
  }
} 