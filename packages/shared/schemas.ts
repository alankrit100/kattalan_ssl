import { z } from "zod"

export const normalizeUrl = (raw: string): string => {
  const url = new URL(
    raw.startsWith("http") ? raw : `https://${raw}`
  )

  const hostname = url.hostname.startsWith("www.")
    ? url.hostname.slice(4)
    : url.hostname

  return `${url.protocol}//${hostname}`
}

export const BLOCKED_HOSTNAMES = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.169.254",
  "metadata.google.internal",
] as const

export const BLOCKED_IP_PREFIXES = [
  "10.",
  "172.16.",
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.",
  "192.168.",
] as const

function isPublicStyleHostname(hostname: string): boolean {
  const labels = hostname.split(".")
  const tld = labels.at(-1)

  if (labels.length < 2 || !tld || tld.length < 2) {
    return false
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return false
  }

  return labels.every((label) => {
    return (
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9-]+$/i.test(label) &&
      !label.startsWith("-") &&
      !label.endsWith("-")
    )
  })
}

export const AddSiteSchema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .transform(normalizeUrl)
    .refine((url) => {
      try {
        const parsed = new URL(url)
        const host = parsed.hostname

        if (!isPublicStyleHostname(host)) {
          return false
        }

        if (
          BLOCKED_HOSTNAMES.includes(
            host as (typeof BLOCKED_HOSTNAMES)[number]
          )
        ) {
          return false
        }

        if (
          BLOCKED_IP_PREFIXES.some((prefix) =>
            host.startsWith(prefix)
          )
        ) {
          return false
        }

        return true
      } catch {
        return false
      }
    }, "Invalid or private URL"),

  label: z.string().min(1).max(100).trim(),
})

export const SslStatusSchema = z.enum([
  "valid",
  "expiring_soon",
  "expired",
  "error",
  "unknown",
])

export const DomainStatusSchema = z.enum([
  "valid",
  "expiring_soon",
  "expired",
  "error",
  "unknown",
])

export const CronLogSchema = z.object({
  jobType: z.enum([
    "ssl_check",
    "domain_check",
    "weekly_digest",
  ]),
  trigger: z.enum(["scheduled", "manual"]),
  status: z.enum(["started", "completed", "failed"]),
  sitesProcessed: z.number().default(0),
  alertsSent: z.number().default(0),
  errors: z.array(z.string()).default([]),
  durationMs: z.number().default(0),
})

export type AddSiteInput = z.infer<typeof AddSiteSchema>
export type CronLog = z.infer<typeof CronLogSchema>
