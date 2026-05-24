import { NextRequest, NextResponse } from "next/server"

import { adminDb } from "@/lib/firebase-admin"
import { verifyToken } from "@/lib/auth-middleware"

type RouteContext = {
  params: Promise<{
    siteId: string
  }>
}

export async function DELETE(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  let uid: string

  try {
    uid = await verifyToken(req)
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  const { siteId } = await context.params

  const siteRef = adminDb
    .collection("users")
    .doc(uid)
    .collection("sites")
    .doc(siteId)

  const site = await siteRef.get()

  if (!site.exists) {
    return NextResponse.json(
      { error: "Site not found" },
      { status: 404 }
    )
  }

  await siteRef.delete()

  return NextResponse.json({
    success: true,
  })
}
