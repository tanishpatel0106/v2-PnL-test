"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Info, RefreshCw } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { fetchAccountSummary } from "@/lib/api"

interface AccountSummaryProps {
  accountType: string
  selectedPeriods: string[]
  companyCode: string
  siteCode: string
  onLoadingChange?: (loading: boolean) => void
  onSummaryChange?: (summary: any | null) => void
}

export function AccountSummary({ accountType, selectedPeriods, companyCode, siteCode, onLoadingChange, onSummaryChange }: AccountSummaryProps) {

  const [data, setData] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!accountType || selectedPeriods.length === 0 || !companyCode || !siteCode) {
      setData(null)
      onSummaryChange?.(null)

      return
    }
    setIsLoading(true)
    onLoadingChange?.(true)
    fetchAccountSummary({
      companyCode,
      siteCode,
      periods: selectedPeriods,
      accountNumber: accountType,
    })
      .then((res) => {
        setData(res.summary)
        onSummaryChange?.(res.summary)
      })
      .catch(() => {
        setData(null)
        onSummaryChange?.(null)
      })
      .finally(() => {
        setIsLoading(false)
        onLoadingChange?.(false)
      })
  }, [accountType, selectedPeriods, companyCode, siteCode])

  const isAggregated = data?.Aggregated === "True"

  const filteredPeriods = selectedPeriods
  const periodColumns = filteredPeriods.flatMap((period) => [period, `${period} %`])

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }

  const parsePercentageField = (field: any): string => {
    try {
      const obj = typeof field === "string" ? JSON.parse(field) : field
      if (obj && Array.isArray(obj["Denominator Accounts"])) {
        return obj["Denominator Accounts"]
          .map((acc: any) => acc.Description)
          .filter(Boolean)
          .join(", ")
      }
      return ""
    } catch {
      return ""
    }
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-40">
        <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Main Account Summary */}
      <Card
        className={`border-0 shadow-lg ${isAggregated ? "bg-gradient-to-r from-blue-50 to-indigo-50" : "bg-gradient-to-r from-green-50 to-emerald-50"}`}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📊 Main Account Summary
            <Badge variant={isAggregated ? "default" : "secondary"} className="ml-2">
              {isAggregated ? "Aggregated" : "Non-Aggregated"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Type</TableHead>
                  <TableHead>SubAccount</TableHead>
                  <TableHead>Is Aggregated</TableHead>
                  <TableHead className="flex items-center gap-1">
                    Percentage Field
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-4 h-4 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Denominator information for percentage calculations</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  {periodColumns.map((period) => (
                    <TableHead key={period} className="text-right min-w-24">
                      {period}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">{data?.Account_Type}</TableCell>
                  <TableCell className="font-medium">{data?.SubAccount}</TableCell>
                  <TableCell>
                    <Badge variant={isAggregated ? "default" : "outline"}>{isAggregated ? "True" : "False"}</Badge>
                  </TableCell>
                  <TableCell className="text-sm max-w-48" title={JSON.stringify(data?.["Percentage Field"])}>
                    {parsePercentageField(data?.["Percentage Field"])}
                  </TableCell>
                  {periodColumns.map((period) => (
                    <TableCell key={period} className="text-right font-mono">
                      {formatNumber((data?.[period] as number | undefined) || 0)}{period.includes("%") ? "%" : ""}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Aggregated Fields Breakdown - Only show for aggregated accounts */}
      {isAggregated && (
        <Card className="border-0 shadow-lg bg-gradient-to-r from-slate-50 to-gray-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">📈 Aggregated Fields Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SubAccount</TableHead>
                    <TableHead>Account Type</TableHead>
                    <TableHead>Percentage Field</TableHead>
                    {periodColumns.map((period) => (
                      <TableHead key={period} className="text-right min-w-24">
                        {period}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.isArray(data?.["Aggregated Fields"]) &&
                    data!["Aggregated Fields"].map((field: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{field.SubAccount}</TableCell>
                        <TableCell>{field.Account_Type}</TableCell>
                        <TableCell className="text-xs">
                          {parsePercentageField(field["Percentage Field"])}
                        </TableCell>
                        {periodColumns.map((period) => (
                          <TableCell key={period} className="text-right font-mono">
                            {formatNumber((field[period] as number | undefined) || 0)}{period.includes("%") ? "%" : ""}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
