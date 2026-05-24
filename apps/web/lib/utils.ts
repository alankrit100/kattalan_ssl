import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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

export function normalizeUrl(raw: string): string {
  const url = new URL(
    raw.startsWith("http") ? raw : `https://${raw}`
  )

  const hostname = url.hostname.startsWith("www.")
    ? url.hostname.slice(4)
    : url.hostname

  return `${url.protocol}//${hostname}`
}

export function isBlockedHostname(hostname: string): boolean {
  return (
    BLOCKED_HOSTNAMES.includes(
      hostname as (typeof BLOCKED_HOSTNAMES)[number]
    ) ||
    BLOCKED_IP_PREFIXES.some((prefix) =>
      hostname.startsWith(prefix)
    )
  )
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(date)
}
