"use client"

import { useState } from "react"
import { Toaster } from "sonner"
import { FloatingSidebar } from "./components/floating-sidebar"
import { AccountSelector } from "./components/account-selector"
import { AccountSummary } from "./components/account-summary"
import { CommentGeneration } from "./components/comment-generation"
import { FollowUpChat } from "./components/followup-chat"

interface Selections {
  companyCode: string
  siteCode: string
  periods: string[]
  companyInfo: string
}

export default function App() {
  const [selections, setSelections] = useState<Selections>({
    companyCode: "",
    siteCode: "",
    periods: [],
    companyInfo: "",
  })
  const [selectedAccount, setSelectedAccount] = useState("")
  const [selectedUniqueId, setSelectedUniqueId] = useState("")
  const [confirmedSelections, setConfirmedSelections] = useState<Selections>({
    companyCode: "",
    siteCode: "",
    periods: [],
    companyInfo: "",
  })
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isSummaryLoading, setIsSummaryLoading] = useState(false)
  const [accountSummary, setAccountSummary] = useState<any | null>(null)
  const [chatContext, setChatContext] = useState<{
    accountJson: any
    summary: string
    finalComment: string
    companyInfo?: string
  } | null>(null)


  const isConfigurationComplete =
    isConfirmed &&
    confirmedSelections.companyCode &&
    confirmedSelections.siteCode &&
    confirmedSelections.periods.length > 0

  const handleSelectionChange = (newSelections: Selections) => {
    setSelections(newSelections)
    if (
      isConfirmed &&
      (newSelections.companyCode !== confirmedSelections.companyCode ||
        newSelections.siteCode !== confirmedSelections.siteCode ||
        newSelections.periods.join() !== confirmedSelections.periods.join() ||
        newSelections.companyInfo !== confirmedSelections.companyInfo)
    ) {
      setIsConfirmed(false)
      setSelectedAccount("")
      setSelectedUniqueId("")
      setAccountSummary(null)

    }
  }

  const handleConfirm = (vals: Selections) => {
    setSelections(vals)
    setConfirmedSelections(vals)
    setIsConfirmed(
      !!(vals.companyCode && vals.siteCode && vals.periods.length > 0)
    )
  }

  const handleGenerate = (accountType: string, uniqueId: string) => {
    setSelectedAccount(accountType)
    setSelectedUniqueId(uniqueId)
    setAccountSummary(null)
  }

  const handleFollowUp = () => {
    setIsChatOpen(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <FloatingSidebar
        onSelectionChange={handleSelectionChange}
        onConfirm={handleConfirm}
      />

      <div className="ml-96 min-h-screen">
        {!isConfigurationComplete ? (
          <div className="flex items-center justify-center h-screen">
            <div className="text-center space-y-4">
              <div className="text-6xl">📊</div>
              <h1 className="text-3xl font-bold text-gray-700">P&L Commentary & Approval</h1>
              <p className="text-gray-500 max-w-md">
                Please complete the configuration in the sidebar to get started with your P&L analysis.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="text-center py-8">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                P&L Commentary & Approval Portal
              </h1>
              <p className="text-gray-600">
                Selected: {selections.companyCode} • {selections.siteCode} • {selections.periods.length} period(s)
              </p>
            </div>

            <AccountSelector
              onGenerate={handleGenerate}
              disabled={!isConfigurationComplete}
              companyCode={confirmedSelections.companyCode}
              siteCode={confirmedSelections.siteCode}
            />

            {selectedAccount && (
              <>
                <AccountSummary
                  accountType={selectedAccount}
                  selectedPeriods={confirmedSelections.periods}
                  companyCode={confirmedSelections.companyCode}
                  siteCode={confirmedSelections.siteCode}
                  onLoadingChange={setIsSummaryLoading}
                  onSummaryChange={setAccountSummary}
                />

                {accountSummary && !isSummaryLoading && (
                  <CommentGeneration
                    accountId={selectedUniqueId}
                    periods={confirmedSelections.periods}
                    companyCode={confirmedSelections.companyCode}
                    siteCode={confirmedSelections.siteCode}
                    accountData={accountSummary}
                    companyInfo={confirmedSelections.companyInfo}
                    onFollowUp={handleFollowUp}
                    onContextChange={setChatContext}
                  />

                )}
              </>
            )}
          </div>
        )}
      </div>

      <FollowUpChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        context={chatContext}
      />

      <Toaster position="top-right" />
    </div>
  )
}
