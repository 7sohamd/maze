import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, updateDoc, increment } from "firebase/firestore"

export async function POST(request: NextRequest, { params }: { params: { roomId: string } }) {
  const roomId = params.roomId;
  try {
    const roomRef = doc(db, "rooms", roomId)
    await updateDoc(roomRef, {
      viewers: increment(1)
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Presence POST error:", error)
    return NextResponse.json({ error: "Failed to update presence" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { roomId: string } }) {
  const roomId = params.roomId;
  try {
    const roomRef = doc(db, "rooms", roomId)
    await updateDoc(roomRef, {
      viewers: increment(-1)
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Presence DELETE error:", error)
    return NextResponse.json({ error: "Failed to update presence" }, { status: 500 })
  }
} 