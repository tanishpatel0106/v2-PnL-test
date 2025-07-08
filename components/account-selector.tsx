"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sparkles } from "lucide-react"
import { fetchAccounts, AccountOption } from "@/lib/api"

interface AccountSelectorProps {
  onGenerate: (accountType: string, uniqueId: string) => void
  disabled: boolean
  companyCode: string
  siteCode: string
}

export function AccountSelector({ onGenerate, disabled, companyCode, siteCode }: AccountSelectorProps) {
  const [selectedAccount, setSelectedAccount] = useState("")
  const [accounts, setAccounts] = useState<AccountOption[]>([])

  useEffect(() => {
    if (!disabled && companyCode && siteCode) {
      fetchAccounts(companyCode, siteCode)
        .then(setAccounts)
        .catch(() => setAccounts([]))
    } else {
      setAccounts([])
    }
    setSelectedAccount("")
  }, [companyCode, siteCode, disabled])

  const handleGenerate = () => {
    if (selectedAccount) {
      const acc = accounts.find((a) => a.value === selectedAccount)
      onGenerate(selectedAccount, acc?.uniqueId || '')
    }
  }

  return (
    <Card className="mb-6 border-0 shadow-lg bg-gradient-to-r from-indigo-50 to-purple-50">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">🎯 Account Selection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Account</label>
          <Select value={selectedAccount} onValueChange={setSelectedAccount} disabled={disabled || accounts.length === 0}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose an account..." />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.value} value={account.value}>
                  {account.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={!selectedAccount || disabled}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105"
          size="lg"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Generate P&L Summary
        </Button>
      </CardContent>
    </Card>
  )
}
