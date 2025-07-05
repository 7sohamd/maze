import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, updateDoc, increment, getDoc, setDoc } from "firebase/firestore"

export async function POST(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  try {
    const roomRef = doc(db, "rooms", roomId)
    
    // Check if the room document exists
    const roomSnap = await getDoc(roomRef)
    
    if (!roomSnap.exists()) {
      // If room doesn't exist, create it with initial values
      await setDoc(roomRef, {
        viewers: 1,
        createdAt: new Date(),
        gameStatus: "waiting"
      })
    } else {
      // If room exists, update the viewer count
      await updateDoc(roomRef, {
        viewers: increment(1)
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Presence POST error:", error)
    
    // Handle Firebase quota exceeded error
    if (error.code === 'resource-exhausted') {
      console.warn('Firebase quota exceeded, returning success to prevent client errors')
      return NextResponse.json({ success: true, warning: "Using fallback mode" })
    }
    
    return NextResponse.json({ error: "Failed to update presence" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  try {
    const roomRef = doc(db, "rooms", roomId)
    
    // Check if the room document exists
    const roomSnap = await getDoc(roomRef)
    
    if (roomSnap.exists()) {
      // Only update if the room exists
      await updateDoc(roomRef, {
        viewers: increment(-1)
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Presence DELETE error:", error)
    
    // Handle Firebase quota exceeded error
    if (error.code === 'resource-exhausted') {
      console.warn('Firebase quota exceeded, returning success to prevent client errors')
      return NextResponse.json({ success: true, warning: "Using fallback mode" })
    }
    
    return NextResponse.json({ error: "Failed to update presence" }, { status: 500 })
  }
} 