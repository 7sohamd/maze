import { NextRequest, NextResponse } from "next/server";

const SABOTAGES = [
  {
    id: "slow",
    name: "Slow Down",
    description: "Reduce player speed by 30%",
  },
  {
    id: "block",
    name: "Block Path",
    description: "Place obstacle near player",
  },
  {
    id: "damage",
    name: "Damage",
    description: "Reduce player health",
  },
  {
    id: "enemy",
    name: "Spawn Enemy",
    description: "Spawn enemy near player",
  },
];

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

async function classifySabotage(userText: string) {
  const sabotageList = SABOTAGES.map(s => `${s.id}: ${s.description}`).join(", ");
  const prompt = `Given the following sabotage actions: ${sabotageList}. Which one best matches the user's request: '${userText}'? Respond with only the sabotage id.`;
  const res = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ]
    }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error("Gemini API error response:", errorText);
    throw new Error("Failed to classify sabotage");
  }
  const data = await res.json();
  console.log("Gemini API response:", JSON.stringify(data));
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (text) text = text.toLowerCase();
  return text;
}

export async function POST(request: NextRequest) {
  try {
    const { description } = await request.json();
    
    // Debug logging
    console.log("Received description:", description);
    console.log("GEMINI_API_KEY exists:", !!GEMINI_API_KEY);
    console.log("GEMINI_API_KEY length:", GEMINI_API_KEY?.length);
    
    if (!description) {
      return NextResponse.json({ error: "Missing description" }, { status: 400 });
    }
    
    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not set in environment variables");
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
    }
    
    let sabotageId;
    try {
      sabotageId = await classifySabotage(description);
    } catch (err) {
      console.error("Gemini classify error", err);
      // Fallback: simple keyword match
      const desc = description.toLowerCase();
      if (desc.includes("enemy")) sabotageId = "enemy";
      else if (desc.includes("block")) sabotageId = "block";
      else if (desc.includes("slow")) sabotageId = "slow";
      else if (desc.includes("damage") || desc.includes("health")) sabotageId = "damage";
      else sabotageId = undefined;
    }
    // Robust id match
    const match = SABOTAGES.find(s => s.id === sabotageId?.trim());
    if (!match) {
      return NextResponse.json({ error: "No sabotage matches your description." }, { status: 404 });
    }
    return NextResponse.json({ sabotage: match });
  } catch (error) {
    console.error("Gemini route error", error);
    return NextResponse.json({ error: "Failed to process Gemini request" }, { status: 500 });
  }
} 