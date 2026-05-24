"use client"

import { FormEvent, useState } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type AddSiteModalProps = {
  onAddSite: (input: {
    url: string
    label: string
  }) => Promise<void>
}

export function AddSiteModal({
  onAddSite,
}: AddSiteModalProps) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [label, setLabel] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      await onAddSite({ url, label })
      setUrl("")
      setLabel("")
      setOpen(false)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not add site"
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Add site
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
      >
        <DialogContent>
          <form
            onSubmit={handleSubmit}
            className="grid gap-4"
          >
            <DialogHeader>
              <DialogTitle>Add monitored site</DialogTitle>
              <DialogDescription>
                Save a site for weekly health checks.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <Label htmlFor="site-label">Label</Label>
              <Input
                id="site-label"
                value={label}
                onChange={(event) =>
                  setLabel(event.target.value)
                }
                placeholder="Client site"
                maxLength={100}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="site-url">URL</Label>
              <Input
                id="site-url"
                value={url}
                onChange={(event) =>
                  setUrl(event.target.value)
                }
                placeholder="example.com"
                required
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={loading}
              >
                {loading ? "Adding..." : "Add site"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
