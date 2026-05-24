"use client"

import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth"

import { useEffect, useState } from "react"

import { auth } from "@/lib/firebase-client"

type UseAuthReturn = {
  user: User | null
  loading: boolean
  signup: (
    email: string,
    password: string
  ) => Promise<void>
  login: (
    email: string,
    password: string
  ) => Promise<void>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

async function createSession(): Promise<void> {
  const currentUser = auth.currentUser

  if (!currentUser) {
    return
  }

  const token = await currentUser.getIdToken()

  await fetch("/api/auth/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token,
    }),
  })
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        setUser(firebaseUser)

        if (firebaseUser) {
          await createSession()
        }

        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  async function signup(
    email: string,
    password: string
  ): Promise<void> {
    await createUserWithEmailAndPassword(
      auth,
      email,
      password
    )

    await createSession()
  }

  async function login(
    email: string,
    password: string
  ): Promise<void> {
    await signInWithEmailAndPassword(
      auth,
      email,
      password
    )

    await createSession()
  }

  async function loginWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider()

    await signInWithPopup(auth, provider)

    await createSession()
  }

  async function logout(): Promise<void> {
    await fetch("/api/auth/logout", {
      method: "POST",
    })

    await signOut(auth)
  }

  return {
    user,
    loading,
    signup,
    login,
    loginWithGoogle,
    logout,
  }
}