import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  // NEXT_PUBLIC_FIREBASE_API_KEY - Firebase browser API key from Firebase Console > Project Settings > Web App
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  // NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN - Firebase Auth domain from Firebase Console > Project Settings > Web App
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  // NEXT_PUBLIC_FIREBASE_PROJECT_ID - Firebase project ID from Firebase Console > Project Settings > Web App
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  // NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET - Firebase storage bucket from Firebase Console > Project Settings > Web App
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  // NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID - Firebase sender ID from Firebase Console > Project Settings > Web App
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  // NEXT_PUBLIC_FIREBASE_APP_ID - Firebase app ID from Firebase Console > Project Settings > Web App
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = getApps().length > 0
  ? getApp()
  : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
