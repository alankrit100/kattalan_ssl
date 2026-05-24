import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"

import { adminAuth, adminDb } from "@/lib/firebase-admin"

type SessionBody = {
  token?: string
}

async function ensureUserDocument(params: {
  uid: string
  email: string
}): Promise<void> {
  const userRef = adminDb.collection("users").doc(params.uid)
  const userSnapshot = await userRef.get()

  if (userSnapshot.exists) {
    return
  }

  await userRef.set({
    email: params.email,
    plan: "free",
    createdAt: Timestamp.now(),
  })
}

export async function POST(
  req: NextRequest
): Promise<NextResponse> {
  try {
    const body = (await req.json()) as SessionBody

    if (!body.token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 400 }
      )
    }

    const decoded = await adminAuth.verifyIdToken(
      body.token
    )

    await ensureUserDocument({
      uid: decoded.uid,
      email: decoded.email ?? "",
    })

    const cookieStore = await cookies()

    cookieStore.set("firebase-token", body.token, {
      httpOnly: true,
      // NODE_ENV - Next.js runtime environment used to restrict cookies to HTTPS in production
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    })

    return NextResponse.json({
      success: true,
      uid: decoded.uid,
    })
  } catch {
    return NextResponse.json(
      { error: "Invalid token" },
      { status: 401 }
    )
  }
}
