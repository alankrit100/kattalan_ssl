import { NextRequest, NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import { ZodError } from "zod"

import {
  AddSiteSchema,
  type AddSiteInput,
} from "../../../../../packages/shared/schemas"
import { PLAN_LIMITS } from "@/lib/constants"
import { adminDb } from "@/lib/firebase-admin"
import { verifyToken } from "@/lib/auth-middleware"

type UnknownSslStatus = {
  status: "unknown"
  daysUntilExpiry: null
  expiresAt: null
  issuer: null
  lastCheckedAt: null
}

type UnknownDomainStatus = {
  status: "unknown"
  daysUntilExpiry: null
  expiresAt: null
  registrar: null
  lastCheckedAt: null
}

type SiteResponse = {
  id: string
  url: string
  label: string
  addedAt: string | null
  lastCheckedAt: string | null
  ssl: {
    status: string
    daysUntilExpiry: number | null
    expiresAt: string | null
    issuer: string | null
    lastCheckedAt: string | null
  }
  domain: {
    status: string
    daysUntilExpiry: number | null
    expiresAt: string | null
    registrar: string | null
    lastCheckedAt: string | null
  }
}

type SiteDocument = {
  url: string
  label: string
  addedAt?: Timestamp
  lastCheckedAt?: Timestamp | null
  ssl?: {
    status?: string
    daysUntilExpiry?: number | null
    expiresAt?: Timestamp | null
    issuer?: string | null
    lastCheckedAt?: Timestamp | null
  }
  domain?: {
    status?: string
    daysUntilExpiry?: number | null
    expiresAt?: Timestamp | null
    registrar?: string | null
    lastCheckedAt?: Timestamp | null
  }
}

function timestampToIso(
  value: Timestamp | null | undefined
): string | null {
  return value ? value.toDate().toISOString() : null
}

function toSiteResponse(
  id: string,
  data: SiteDocument
): SiteResponse {
  return {
    id,
    url: data.url,
    label: data.label,
    addedAt: timestampToIso(data.addedAt),
    lastCheckedAt: timestampToIso(data.lastCheckedAt),
    ssl: {
      status: data.ssl?.status ?? "unknown",
      daysUntilExpiry: data.ssl?.daysUntilExpiry ?? null,
      expiresAt: timestampToIso(data.ssl?.expiresAt),
      issuer: data.ssl?.issuer ?? null,
      lastCheckedAt: timestampToIso(data.ssl?.lastCheckedAt),
    },
    domain: {
      status: data.domain?.status ?? "unknown",
      daysUntilExpiry: data.domain?.daysUntilExpiry ?? null,
      expiresAt: timestampToIso(data.domain?.expiresAt),
      registrar: data.domain?.registrar ?? null,
      lastCheckedAt: timestampToIso(data.domain?.lastCheckedAt),
    },
  }
}

function unknownSslStatus(): UnknownSslStatus {
  return {
    status: "unknown",
    daysUntilExpiry: null,
    expiresAt: null,
    issuer: null,
    lastCheckedAt: null,
  }
}

function unknownDomainStatus(): UnknownDomainStatus {
  return {
    status: "unknown",
    daysUntilExpiry: null,
    expiresAt: null,
    registrar: null,
    lastCheckedAt: null,
  }
}

function initialAlertsSent(): Record<string, boolean> {
  return {
    ssl_30d: false,
    ssl_14d: false,
    ssl_7d: false,
    ssl_expired: false,
    domain_30d: false,
    domain_14d: false,
    domain_7d: false,
    domain_expired: false,
  }
}

function validationError(
  error: ZodError
): NextResponse {
  return NextResponse.json(
    {
      error: error.issues[0]?.message ?? "Invalid site",
    },
    { status: 400 }
  )
}

export async function GET(
  req: NextRequest
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

  try {
    const snapshot = await adminDb
      .collection("users")
      .doc(uid)
      .collection("sites")
      .orderBy("addedAt", "desc")
      .get()

    const sites = snapshot.docs.map((doc) =>
      toSiteResponse(doc.id, doc.data() as SiteDocument)
    )

    return NextResponse.json({ sites })
  } catch {
    return NextResponse.json(
      { error: "Could not load sites" },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest
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

  let input: AddSiteInput

  try {
    input = AddSiteSchema.parse(await req.json())
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error)
    }

    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    )
  }

  const sitesRef = adminDb
    .collection("users")
    .doc(uid)
    .collection("sites")

  const existingSites = await sitesRef.get()

  if (existingSites.size >= PLAN_LIMITS.free.maxSites) {
    return NextResponse.json(
      { error: "Free plan site limit reached" },
      { status: 400 }
    )
  }

  const duplicate = existingSites.docs.find(
    (doc) => (doc.data() as SiteDocument).url === input.url
  )

  if (duplicate) {
    return NextResponse.json(
      { error: "Site already exists" },
      { status: 409 }
    )
  }

  const now = Timestamp.now()
  const siteRef = sitesRef.doc()
  const siteData = {
    url: input.url,
    label: input.label,
    addedAt: now,
    lastCheckedAt: null,
    ssl: unknownSslStatus(),
    domain: unknownDomainStatus(),
    alertsSent: initialAlertsSent(),
  }

  await siteRef.set(siteData)

  return NextResponse.json(
    {
      site: toSiteResponse(siteRef.id, siteData),
    },
    { status: 201 }
  )
}
