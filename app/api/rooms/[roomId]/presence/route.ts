import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, updateDoc, increment, getDoc, setDoc } from "firebase/firestore"

// In-memory fallback storage for when Firebase quota is exceeded
const fallbackViewerCounts = new Map<string, number>()
let firebaseQuotaExceeded = false

export async function POST(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  try {
    // Check if this is a new viewer joining
    const isNewViewer = request.headers.get("x-new-viewer") === "true";
    
    console.log(`[Presence POST] Room: ${roomId}, New viewer: ${isNewViewer}`)
    
    // If Firebase quota is exceeded, use fallback mode
    if (firebaseQuotaExceeded) {
      const currentViewers = fallbackViewerCounts.get(roomId) || 0
      
      if (isNewViewer) {
        const newCount = currentViewers + 1
        fallbackViewerCounts.set(roomId, newCount)
        console.log(`[Presence POST] Fallback mode - Incrementing viewers from ${currentViewers} to ${newCount}`)
      } else {
        console.log(`[Presence POST] Fallback mode - Heartbeat received, no count change`)
      }
      
      return NextResponse.json({ success: true, fallback: true })
    }
    
    const roomRef = doc(db, "rooms", roomId)
    
    // Check if the room document exists
    const roomSnap = await getDoc(roomRef)
    
    if (!roomSnap.exists()) {
      // If room doesn't exist, create it with initial values
      console.log(`[Presence POST] Creating new room with viewers: 1`)
      try {
        await setDoc(roomRef, {
          viewers: 1,
          createdAt: new Date(),
          gameStatus: "waiting"
        })
        console.log(`[Presence POST] Successfully created room with 1 viewer`)
      } catch (error: any) {
        if (error.code === 'resource-exhausted') {
          firebaseQuotaExceeded = true
          fallbackViewerCounts.set(roomId, 1)
          console.log(`[Presence POST] Firebase quota exceeded, switching to fallback mode`)
          return NextResponse.json({ success: true, fallback: true })
        }
        throw error
      }
    } else if (isNewViewer) {
      // Only increment viewer count if this is a new viewer joining
      const currentData = roomSnap.data()
      const currentViewers = currentData?.viewers || 0
      const newViewerCount = currentViewers + 1
      
      console.log(`[Presence POST] Incrementing viewers from ${currentViewers} to ${newViewerCount}`)
      
      try {
        // Use setDoc instead of increment for better control
        await updateDoc(roomRef, {
          viewers: newViewerCount
        })
        console.log(`[Presence POST] Successfully incremented viewers for room: ${roomId}`)
      } catch (error: any) {
        if (error.code === 'resource-exhausted') {
          firebaseQuotaExceeded = true
          fallbackViewerCounts.set(roomId, newViewerCount)
          console.log(`[Presence POST] Firebase quota exceeded, switching to fallback mode`)
          return NextResponse.json({ success: true, fallback: true })
        }
        throw error
      }
    } else {
      // This is just a heartbeat, don't change the viewer count
      console.log(`[Presence POST] Heartbeat received for room: ${roomId}, no count change`)
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Presence POST error:", error)
    
    // Handle Firebase quota exceeded error
    if (error.code === 'resource-exhausted') {
      firebaseQuotaExceeded = true
      console.warn('Firebase quota exceeded, switching to fallback mode')
      
      // Use fallback mode
      const isNewViewer = request.headers.get("x-new-viewer") === "true";
      const currentViewers = fallbackViewerCounts.get(roomId) || 0
      
      if (isNewViewer) {
        const newCount = currentViewers + 1
        fallbackViewerCounts.set(roomId, newCount)
        console.log(`[Presence POST] Fallback mode - Incrementing viewers from ${currentViewers} to ${newCount}`)
      } else {
        console.log(`[Presence POST] Fallback mode - Heartbeat received, no count change`)
      }
      
      return NextResponse.json({ success: true, fallback: true })
    }
    
    return NextResponse.json({ error: "Failed to update presence" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  try {
    console.log(`[Presence DELETE] Room: ${roomId}`)
    
    // If Firebase quota is exceeded, use fallback mode
    if (firebaseQuotaExceeded) {
      const currentViewers = fallbackViewerCounts.get(roomId) || 0
      
      if (currentViewers > 0) {
        const newCount = Math.max(0, currentViewers - 1) // Ensure we don't go below 0
        fallbackViewerCounts.set(roomId, newCount)
        console.log(`[Presence DELETE] Fallback mode - Decrementing viewers from ${currentViewers} to ${newCount}`)
      } else {
        console.log(`[Presence DELETE] Fallback mode - No viewers to decrement, skipping`)
      }
      
      return NextResponse.json({ success: true, fallback: true })
    }
    
    const roomRef = doc(db, "rooms", roomId)
    
    // Check if the room document exists
    const roomSnap = await getDoc(roomRef)
    
    if (roomSnap.exists()) {
      const currentData = roomSnap.data()
      const currentViewers = currentData?.viewers || 0
      
      console.log(`[Presence DELETE] Current viewers: ${currentViewers}`)
      
      // Only decrement if there are viewers to decrement and we won't go below 0
      if (currentViewers > 0) {
        const newViewerCount = Math.max(0, currentViewers - 1)
        console.log(`[Presence DELETE] Decrementing viewers from ${currentViewers} to ${newViewerCount}`)
        
        try {
          // Use setDoc instead of increment to ensure we don't go below 0
          await updateDoc(roomRef, {
            viewers: newViewerCount
          })
          console.log(`[Presence DELETE] Successfully decremented viewers for room: ${roomId}`)
        } catch (error: any) {
          if (error.code === 'resource-exhausted') {
            firebaseQuotaExceeded = true
            fallbackViewerCounts.set(roomId, newViewerCount)
            console.log(`[Presence DELETE] Firebase quota exceeded, switching to fallback mode`)
            return NextResponse.json({ success: true, fallback: true })
          }
          throw error
        }
      } else {
        console.log(`[Presence DELETE] No viewers to decrement, skipping`)
      }
    } else {
      console.log(`[Presence DELETE] Room doesn't exist, skipping`)
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Presence DELETE error:", error)
    
    // Handle Firebase quota exceeded error
    if (error.code === 'resource-exhausted') {
      firebaseQuotaExceeded = true
      console.warn('Firebase quota exceeded, switching to fallback mode')
      
      // Use fallback mode
      const currentViewers = fallbackViewerCounts.get(roomId) || 0
      
      if (currentViewers > 0) {
        const newCount = Math.max(0, currentViewers - 1)
        fallbackViewerCounts.set(roomId, newCount)
        console.log(`[Presence DELETE] Fallback mode - Decrementing viewers from ${currentViewers} to ${newCount}`)
      }
      
      return NextResponse.json({ success: true, fallback: true })
    }
    
    return NextResponse.json({ error: "Failed to update presence" }, { status: 500 })
  }
}

// Export the fallback viewer counts for use in other APIs
export function getFallbackViewerCount(roomId: string): number {
  return fallbackViewerCounts.get(roomId) || 0
}

export function isFirebaseQuotaExceeded(): boolean {
  return firebaseQuotaExceeded
} 