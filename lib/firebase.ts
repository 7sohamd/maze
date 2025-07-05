import { initializeApp, getApps } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

// Debug environment variables
console.log("Firebase config check:");
console.log("API Key:", process.env.FIREBASE_API_KEY ? "Present" : "Missing");
console.log("Auth Domain:", process.env.FIREBASE_AUTH_DOMAIN ? "Present" : "Missing");
console.log("Project ID:", process.env.FIREBASE_PROJECT_ID ? "Present" : "Missing");
console.log("Storage Bucket:", process.env.FIREBASE_STORAGE_BUCKET ? "Present" : "Missing");
console.log("Messaging Sender ID:", process.env.FIREBASE_MESSAGING_SENDER_ID ? "Present" : "Missing");
console.log("App ID:", process.env.FIREBASE_APP_ID ? "Present" : "Missing");

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY!,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.FIREBASE_PROJECT_ID!,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.FIREBASE_APP_ID!,
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