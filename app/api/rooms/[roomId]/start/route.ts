import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, setDoc } from "firebase/firestore"

// In-memory storage
// const rooms = new Map<string, any>()

export async function POST(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  try {
    console.log("Game start request for room:", roomId)
    
    const body = await request.json()
    const difficulty = body.difficulty || 'medium'
    
    // Difficulty settings
    const difficultySettings = {
      easy: {
        enemyCount: 2,
        enemySpeed: 1,
        enemyChaseRate: 0.6,
        playerHealth: 150,
        timeLimit: 180,
      },
      medium: {
        enemyCount: 3,
        enemySpeed: 2,
        enemyChaseRate: 0.75,
        playerHealth: 100,
        timeLimit: 120,
      },
      hard: {
        enemyCount: 4,
        enemySpeed: 3,
        enemyChaseRate: 0.9,
        playerHealth: 75,
        timeLimit: 90,
      }
    }
    
    const settings = difficultySettings[difficulty as keyof typeof difficultySettings] || difficultySettings.medium
    
    const mapResponse = await fetch(`${request.nextUrl.origin}/api/generate-map?difficulty=${difficulty}`)
    if (!mapResponse.ok) {
      console.error("Failed to generate map:", mapResponse.status)
      return NextResponse.json({ error: "Failed to generate map" }, { status: 500 })
    }
    
    const mapData = await mapResponse.json()
    console.log("Map generated successfully for difficulty:", difficulty)
    
    const gameState = {
      player: {
        x: Number(mapData.playerStart.x),
        y: Number(mapData.playerStart.y),
        health: settings.playerHealth,
        speed: 1.0,
        score: 0,
      },
      enemies: mapData.enemies.map(enemy => ({
        id: enemy.id,
        x: Number(enemy.x),
        y: Number(enemy.y)
      })),
      obstacles: [],
      goal: {
        x: Number(mapData.goal.x),
        y: Number(mapData.goal.y)
      },
      maze: JSON.stringify(mapData.maze),
      gameStatus: "playing" as const,
      viewers: 0,
      lastUpdate: Date.now(),
      timeLeft: settings.timeLimit,
      difficulty: difficulty,
      difficultySettings: settings,
    }
    
    console.log("Game state created, updating room:", roomId)
    const roomRef = doc(db, "rooms", roomId)
    
    const firestoreData = {
      player: gameState.player,
      enemies: gameState.enemies,
      obstacles: gameState.obstacles,
      goal: gameState.goal,
      maze: gameState.maze,
      gameStatus: gameState.gameStatus,
      viewers: gameState.viewers,
      lastUpdate: gameState.lastUpdate,
      timeLeft: gameState.timeLeft,
      difficulty: gameState.difficulty,
      difficultySettings: gameState.difficultySettings,
      createdAt: new Date()
    }
    
    console.log("Firestore data:", JSON.stringify(firestoreData, null, 2))
    // Use setDoc with merge option to handle existing rooms
    await setDoc(roomRef, firestoreData, { merge: true })
    console.log("Game started successfully")
    
    return NextResponse.json(gameState)
  } catch (error) {
    console.error("Game start error:", error)
    return NextResponse.json({ 
      error: "Failed to start game", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 })
  }
}
