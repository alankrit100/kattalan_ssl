"use client"

import { useRouter } from "next/navigation"

import { FormEvent, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/useAuth"

export default function LoginPage() {
  const router = useRouter()

  const { login, loginWithGoogle } = useAuth()

  const [email, setEmail] = useState("")

  const [password, setPassword] = useState("")

  const [error, setError] = useState("")

  const [loading, setLoading] = useState(false)

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault()

    setError("")
    setLoading(true)

    try {
      await login(email, password)

      router.push("/dashboard")
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Login failed"
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin(): Promise<void> {
    try {
      await loginWithGoogle()

      router.push("/dashboard")
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Google login failed"
      )
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4"
      >
        <h1 className="text-3xl font-bold">
          Login
        </h1>

        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) =>
            setEmail(event.target.value)
          }
          required
        />

        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          required
        />

        {error ? (
          <p className="text-sm text-red-500">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={loading}
        >
          {loading ? "Loading..." : "Login"}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleLogin}
        >
          Continue with Google
        </Button>
      </form>
    </main>
  )
}