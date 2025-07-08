"use client"
import App from "../app"
import { useAuth } from "../components/auth-provider"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function Page() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user) router.push("/login")
  }, [user])

  if (!user) return null
  return <App />
}
