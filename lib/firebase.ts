import { initializeApp, getApps } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

// Debug environment variables
console.log("Firebase config check:");
console.log("API Key:", process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "Present" : "Missing");
console.log("Auth Domain:", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? "Present" : "Missing");
console.log("Project ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? "Present" : "Missing");
console.log("Storage Bucket:", process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? "Present" : "Missing");
console.log("Messaging Sender ID:", process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? "Present" : "Missing");
console.log("App ID:", process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? "Present" : "Missing");

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

let app;
let db: Firestore;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  console.log("Firebase app initialized successfully");
  
  db = getFirestore(app);
  console.log("Firestore database initialized successfully");
} catch (error) {
  console.error("Firebase initialization error:", error);
  throw error;
}

export { db }; 