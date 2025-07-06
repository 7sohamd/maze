import { NextResponse } from "next/server";

export async function GET() {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  // Check for common issues
  const issues = [];
  
  if (!firebaseConfig.apiKey) {
    issues.push("Firebase API Key is missing");
  } else if (firebaseConfig.apiKey.length < 30) {
    issues.push("Firebase API Key appears to be too short");
  } else if (firebaseConfig.apiKey.includes("AIzaSy") && firebaseConfig.apiKey.length > 50) {
    issues.push("Firebase API Key appears to be malformed (too long or concatenated)");
  }

  if (!firebaseConfig.appId) {
    issues.push("Firebase App ID is missing");
  } else if (!firebaseConfig.appId.includes(":")) {
    issues.push("Firebase App ID appears to be malformed");
  }

  if (!firebaseConfig.projectId) {
    issues.push("Firebase Project ID is missing");
  }

  return NextResponse.json({
    config: {
      apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : "Missing",
      authDomain: firebaseConfig.authDomain || "Missing",
      projectId: firebaseConfig.projectId || "Missing",
      storageBucket: firebaseConfig.storageBucket || "Missing",
      messagingSenderId: firebaseConfig.messagingSenderId || "Missing",
      appId: firebaseConfig.appId || "Missing",
    },
    issues,
    hasIssues: issues.length > 0,
    recommendations: [
      "Check your Firebase console for correct configuration values",
      "Ensure API key is not concatenated with another key",
      "Verify App ID is complete and properly formatted",
      "Make sure all environment variables are properly set"
    ]
  });
} 