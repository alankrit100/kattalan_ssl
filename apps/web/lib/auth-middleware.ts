import { NextRequest } from "next/server"

import { adminAuth } from "./firebase-admin"

export async function verifyToken(
  req: NextRequest
): Promise<string> {
  const authHeader = req.headers.get("Authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED")
  }

  const token = authHeader.split("Bearer ")[1]

  const decoded = await adminAuth.verifyIdToken(token)

  return decoded.uid
}