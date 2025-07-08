"use client"
import { useAuth } from "../../components/auth-provider"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { PowerBIEmbed } from "../../components/powerbi-embed"

export default function BIPage() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user) router.push("/login")
  }, [user])

  if (!user) return null

  const embedUrl = process.env.NEXT_PUBLIC_POWERBI_EMBED_URL || "https://app.powerbi.com/reportEmbed?reportId=3a385926-4cc0-41f8-9a0d-2a8a9b76ec4a&autoAuth=true&ctid=12bd9b63-46f8-4092-a420-8df6f60703f7"

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold text-zinc-700">BI Report</h1>
      {embedUrl ? (
        <PowerBIEmbed embedUrl={embedUrl} height={800} />
      ) : (
        <p className="text-zinc-700">Power BI embed URL not configured.</p>
      )}
    </div>
  )
}
