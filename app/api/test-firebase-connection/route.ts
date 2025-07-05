import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"

export async function GET() {
  try {
    console.log("Testing Firebase connection...")
    
    // Test basic Firestore connection
    const testCollection = collection(db, "test")
    const snapshot = await getDocs(testCollection)
    
    console.log("Firebase connection successful")
    return NextResponse.json({ 
      success: true, 
      message: "Firebase connection working",
      collections: snapshot.docs.length,
      env: {
        apiKey: process.env.FIREBASE_API_KEY ? "Present" : "Missing",
        projectId: process.env.FIREBASE_PROJECT_ID ? "Present" : "Missing"
      }
    })
  } catch (error) {
    console.error("Firebase connection error:", error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error",
      env: {
        apiKey: process.env.FIREBASE_API_KEY ? "Present" : "Missing",
        projectId: process.env.FIREBASE_PROJECT_ID ? "Present" : "Missing"
      }
    }, { status: 500 })
  }
} 