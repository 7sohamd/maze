import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export async function GET(request: NextRequest, { params }: { params: { roomId: string } }) {
  try {
    const roomId = params.roomId;
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);
    
    if (!roomSnap.exists()) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    
    return NextResponse.json(roomSnap.data());
  } catch (error) {
    console.error("Room fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch room" }, { status: 500 });
  }
} 