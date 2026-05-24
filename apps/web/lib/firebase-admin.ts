import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"

const firebaseAdminConfig = {
  // FIREBASE_ADMIN_PROJECT_ID - Firebase project ID from Firebase Console > Project Settings > Service Accounts
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  // FIREBASE_ADMIN_CLIENT_EMAIL - service account client email from Firebase Console > Service Accounts > Generate key
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  // FIREBASE_ADMIN_PRIVATE_KEY - service account private key from Firebase Console > Service Accounts > Generate key
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  ),
}

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(firebaseAdminConfig),
      })

export const adminAuth = getAuth(app)
export const adminDb = getFirestore(app)
