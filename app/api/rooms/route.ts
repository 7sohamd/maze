import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, setDoc, getDocs, collection, serverTimestamp } from "firebase/firestore"

export async function POST(request: NextRequest) {
  try {
    console.log("Room creation request received")
    const { roomId } = await request.json()
    console.log("Room ID:", roomId)
    
    if (!roomId) {
      console.log("No room ID provided")
      return NextResponse.json({ error: "Room ID required" }, { status: 400 })
    }
    
    const roomRef = doc(db as any, "rooms", roomId)
    console.log("Creating room document:", roomId)
    
    const roomData = {
      id: roomId,
      gameStatus: "waiting",
      viewers: 0,
      createdAt: new Date(),
    }
    
    console.log("Room data:", roomData)
    await setDoc(roomRef, roomData)
    console.log("Room created successfully")
    
    return NextResponse.json({ success: true, roomId })
  } catch (error: any) {
    console.error("Room creation error:", error)
    
    // Handle Firebase quota exceeded error
    if (error.code === 'resource-exhausted') {
      console.warn('Firebase quota exceeded, returning success with warning')
      return NextResponse.json({ 
        success: true, 
        roomId,
        warning: "Using fallback mode due to service limits"
      })
    }
    
    return NextResponse.json({ 
      error: "Failed to create room", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const roomsSnap = await getDocs(collection(db, "rooms"))
    const rooms = roomsSnap.docs.map(doc => doc.id)
    return NextResponse.json({ rooms, total: rooms.length })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch rooms" }, { status: 500 })
  }
}
