"use client"
import { useEffect, useState } from "react"
import { useAuth } from "../../components/auth-provider"
import { useRouter } from "next/navigation"
import { Toaster } from "sonner"
import { MonthlySidebar } from "../../components/monthly-sidebar"
import { MonthlyCommentEditor } from "../../components/monthly-comment-editor"

interface Selections {
  companyCode: string
  siteCode: string
  year: string
  period: string
}

export default function MonthlyPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [selections, setSelections] = useState<Selections>({ companyCode: "", siteCode: "", year: "", period: "" })
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    if (!user) router.push("/login")
  }, [user])

  if (!user) return null

  const handleChange = (vals: Selections) => {
    setSelections(vals)
    setConfirmed(false)
  }

  const handleConfirm = (vals: Selections) => {
    setSelections(vals)
    setConfirmed(true)
  }

  const isComplete = confirmed && selections.companyCode && selections.siteCode && selections.year && selections.period

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <MonthlySidebar onSelectionChange={handleChange} onConfirm={handleConfirm} />
      <div className="ml-96 p-6">
        {!isComplete ? (
          <div className="flex items-center justify-center h-screen">
            <div className="text-center space-y-4">
              <div className="text-6xl">📅</div>
              <h1 className="text-3xl font-bold text-gray-700">Monthly Analysis</h1>
              <p className="text-gray-500">Please complete the configuration in the sidebar.</p>
            </div>
          </div>
        ) : (
          <MonthlyCommentEditor
            companyCode={selections.companyCode}
            siteCode={selections.siteCode}
            year={selections.year}
            period={selections.period}
          />
        )}
      </div>
      <Toaster position="top-right" />
    </div>
  )
}
