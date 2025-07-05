import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, setDoc } from "firebase/firestore"

export async function POST() {
  try {
    const testRoomId = "TEST" + Date.now()
    console.log("Testing room creation with ID:", testRoomId)
    
    const roomRef = doc(db, "rooms", testRoomId)
    
    // Minimal room data
    const minimalData = {
      id: testRoomId,
      status: "test",
      viewers: 0
    }
    
    console.log("Attempting to create room with data:", minimalData)
    await setDoc(roomRef, minimalData)
    console.log("Room created successfully!")
    
    return NextResponse.json({ success: true, roomId: testRoomId })
  } catch (error) {
    console.error("Test room creation failed:", error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 })
  }
} 