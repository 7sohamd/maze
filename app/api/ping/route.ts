import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Simple response with timestamp for validation
    return NextResponse.json({ 
      ok: true, 
      timestamp: Date.now(),
      message: "pong"
    })
  } catch (error) {
    return NextResponse.json({ 
      ok: false, 
      error: "Ping failed" 
    }, { status: 500 })
  }
} 