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
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  return text;
}

export async function POST(request: NextRequest) {
  try {
    const { description } = await request.json();
    if (!description || !GEMINI_API_KEY) {
      return NextResponse.json({ error: "Missing description or Gemini API key" }, { status: 400 });
    }
    let sabotageId;
    try {
      sabotageId = await classifySabotage(description);
    } catch (err) {
      console.error("Gemini classify error", err);
      return NextResponse.json({ error: "Failed to classify sabotage" }, { status: 500 });
    }
    const match = SABOTAGES.find(s => s.id === sabotageId);
    if (!match) {
      return NextResponse.json({ error: "No sabotage matches your description." }, { status: 404 });
    }
    return NextResponse.json({ sabotage: match });
  } catch (error) {
    console.error("Gemini route error", error);
    return NextResponse.json({ error: "Failed to process Gemini request" }, { status: 500 });
  }
} 