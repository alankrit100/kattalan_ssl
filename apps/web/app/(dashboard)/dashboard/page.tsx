"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { AddSiteModal } from "@/components/AddSiteModal"
import { SiteCard, type Site } from "@/components/SiteCard"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"

type SitesResponse = {
  sites: Site[]
}

type SiteResponse = {
  site: Site
}

export default function DashboardPage() {
  const router = useRouter()

  const { user, loading, logout } = useAuth()
  const [sites, setSites] = useState<Site[]>([])
  const [sitesLoading, setSitesLoading] = useState(false)
  const [error, setError] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(
    null
  )

  useEffect(() => {
    if (!user) {
      return
    }

    const currentUser = user
    let active = true

    async function loadSites(): Promise<void> {
      setSitesLoading(true)
      setError("")

      try {
        const token = await currentUser.getIdToken()
        const response = await fetch("/api/sites", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error("Could not load sites")
        }

        const data = (await response.json()) as SitesResponse

        if (active) {
          setSites(data.sites)
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load sites"
          )
        }
      } finally {
        if (active) {
          setSitesLoading(false)
        }
      }
    }

    void loadSites()

    return () => {
      active = false
    }
  }, [user])

  async function handleLogout(): Promise<void> {
    await logout()

    router.push("/login")
  }

  async function authFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    if (!user) {
      throw new Error("Unauthorized")
    }

    const token = await user.getIdToken()
    const response = await fetch(input, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${token}`,
      },
    })

    if (response.status !== 401) {
      return response
    }

    const refreshedToken = await user.getIdToken(true)

    return fetch(input, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${refreshedToken}`,
      },
    })
  }

  async function handleAddSite(input: {
    url: string
    label: string
  }): Promise<void> {
    const response = await authFetch("/api/sites", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    })

    const data = (await response.json()) as
      | SiteResponse
      | { error?: string }

    if (!response.ok || !("site" in data)) {
      const message =
        "error" in data && data.error
          ? data.error
          : "Could not add site"

      throw new Error(message)
    }

    setSites((current) => [data.site, ...current])
  }

  async function handleDeleteSite(
    siteId: string
  ): Promise<void> {
    const previousSites = sites
    setDeletingId(siteId)
    setSites((current) =>
      current.filter((site) => site.id !== siteId)
    )

    try {
      const response = await authFetch(
        `/api/sites/${siteId}`,
        {
          method: "DELETE",
        }
      )

      if (!response.ok) {
        const data = (await response.json()) as {
          error?: string
        }
        throw new Error(
          data.error ?? "Could not delete site"
        )
      }
    } catch (err) {
      setSites(previousSites)
      setError(
        err instanceof Error
          ? err.message
          : "Could not delete site"
      )
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>Unauthorized</p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Kattalan Dashboard
          </h1>

          <p className="text-muted-foreground">
            {user.email}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <AddSiteModal onAddSite={handleAddSite} />

          <Button
            variant="outline"
            onClick={handleLogout}
          >
            Logout
          </Button>
        </div>
      </div>

      <section className="rounded-lg border p-6">
        <h2 className="text-xl font-semibold">
          Your monitored sites
        </h2>

        {error ? (
          <p className="mt-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {sitesLoading ? (
          <p className="mt-4 text-muted-foreground">
            Loading sites...
          </p>
        ) : null}

        {!sitesLoading && sites.length === 0 ? (
          <p className="mt-4 text-muted-foreground">
            No sites added yet.
          </p>
        ) : null}

        {sites.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {sites.map((site) => (
              <SiteCard
                key={site.id}
                site={site}
                deleting={deletingId === site.id}
                onDelete={handleDeleteSite}
              />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  )
}
