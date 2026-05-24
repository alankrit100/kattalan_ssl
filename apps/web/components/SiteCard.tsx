"use client"

import { Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export type Site = {
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

type SiteCardProps = {
  site: Site
  deleting: boolean
  onDelete: (siteId: string) => Promise<void>
}

export function SiteCard({
  site,
  deleting,
  onDelete,
}: SiteCardProps) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>{site.label}</CardTitle>
        <CardDescription>{site.url}</CardDescription>
        <CardAction>
          <Button
            variant="destructive"
            size="icon-sm"
            aria-label={`Delete ${site.label}`}
            disabled={deleting}
            onClick={() => onDelete(site.id)}
          >
            <Trash2 />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-wrap gap-2">
        <Badge variant="outline">SSL pending first check</Badge>
        <Badge variant="outline">
          Domain pending first check
        </Badge>
      </CardContent>
    </Card>
  )
}
