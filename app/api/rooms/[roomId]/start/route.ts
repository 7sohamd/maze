import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, setDoc } from "firebase/firestore"

// In-memory storage
// const rooms = new Map<string, any>()

export async function POST(request: NextRequest, { params }: { params: { roomId: string } }) {
  const roomId = params.roomId;
  try {
    console.log("Game start request for room:", roomId)
    
    const mapResponse = await fetch(`${request.nextUrl.origin}/api/generate-map`)
    if (!mapResponse.ok) {
      console.error("Failed to generate map:", mapResponse.status)
      return NextResponse.json({ error: "Failed to generate map" }, { status: 500 })
    }
    
    const mapData = await mapResponse.json()
    console.log("Map generated successfully")
    
    const gameState = {
      player: {
        x: Number(mapData.playerStart.x),
        y: Number(mapData.playerStart.y),
        health: 100,
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
      timeLeft: 120,
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
      timeLeft: gameState.timeLeft
    }
    
    console.log("Firestore data:", JSON.stringify(firestoreData, null, 2))
    await setDoc(roomRef, firestoreData)
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
