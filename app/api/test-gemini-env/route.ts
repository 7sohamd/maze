import { NextResponse } from "next/server";

export async function GET() {
  const geminiKey = process.env.GEMINI_API_KEY;
  
  return NextResponse.json({
    geminiKeyExists: !!geminiKey,
    geminiKeyLength: geminiKey?.length || 0,
    geminiKeyPrefix: geminiKey?.substring(0, 10) + "..." || "N/A",
    allEnvKeys: Object.keys(process.env).filter(key => key.includes('GEMINI') || key.includes('NEXT_')),
    nodeEnv: process.env.NODE_ENV,
  });
} 