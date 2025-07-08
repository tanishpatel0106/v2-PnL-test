"use client"
import { useEffect, useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { fetchForecast, ForecastResponse, approveForecast } from "@/lib/api"
import { toast } from "sonner"

interface ForecastTableProps {
  companyCode: string
  siteCode: string
  year: string
  period: string
}

interface ForecastEntry {
  date: string
  income?: number
  cogs?: number
  expense?: number
  approvedIncome?: number | null
  approvedCogs?: number | null
  approvedExpense?: number | null
}

export function ForecastTable({ companyCode, siteCode, year, period }: ForecastTableProps) {
  const [data, setData] = useState<ForecastEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const lastParams = useRef<string>("")

  useEffect(() => {
    if (!companyCode || !siteCode || !year || !period) return
    const key = `${companyCode}|${siteCode}|${year}|${period}`
    if (lastParams.current === key) return
    lastParams.current = key

    setLoading(true)
    Promise.all([
      fetchForecast('income', { companyCode, siteCode, year, period }),
      fetchForecast('cogs', { companyCode, siteCode, year, period }),
      fetchForecast('expense', { companyCode, siteCode, year, period }),
    ])
      .then(([incomeRes, cogsRes, expenseRes]) => {
        if (incomeRes.message || cogsRes.message || expenseRes.message) {
          toast.info(incomeRes.message || cogsRes.message || expenseRes.message)
        }
        const map: Record<string, ForecastEntry> = {}
        incomeRes.forecast.forEach((row) => {
          map[row.date] = {
            ...(map[row.date] || { date: row.date }),
            income: row.forecast,
            approvedIncome: row.approved ?? null,
          }
        })
        cogsRes.forecast.forEach((row) => {
          map[row.date] = {
            ...(map[row.date] || { date: row.date }),
            cogs: row.forecast,
            approvedCogs: row.approved ?? null,
          }
        })
        expenseRes.forecast.forEach((row) => {
          map[row.date] = {
            ...(map[row.date] || { date: row.date }),
            expense: row.forecast,
            approvedExpense: row.approved ?? null,
          }
        })
        const combined = Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
        setData(combined)
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [companyCode, siteCode, year, period])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    )
  }

  if (data.length === 0) {
    return null
  }

  const formatNumber = (n: number | undefined) =>
    n === undefined ? '-' : new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

  const handleInputChange = (index: number, field: keyof ForecastEntry, value: string) => {
    const num = value === '' ? null : parseFloat(value)
    setData((prev) => {
      const copy = [...prev]
      ;(copy[index] as any)[field] = isNaN(num as number) ? null : num
      return copy
    })
  }

  const handleApprove = () => {
    setSaving(true)
    approveForecast({
      companyCode,
      siteCode,
      year,
      period,
      entries: data.map((row) => ({
        date: row.date,
        income: row.approvedIncome,
        cogs: row.approvedCogs,
        expense: row.approvedExpense,
      })),
    })
      .then(() => toast.success('Forecast Approved'))
      .catch(() => toast.error('Failed to approve forecast'))
      .finally(() => setSaving(false))
  }

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-r from-orange-50 to-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">📈 Forecast (next 3 months)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead className="text-center" colSpan={2}>Income</TableHead>
                <TableHead className="text-center" colSpan={2}>COGS</TableHead>
                <TableHead className="text-center" colSpan={2}>Expense</TableHead>
              </TableRow>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">System Generated</TableHead>
                <TableHead className="text-right">To Be Approved</TableHead>
                <TableHead className="text-right">System Generated</TableHead>
                <TableHead className="text-right">To Be Approved</TableHead>
                <TableHead className="text-right">System Generated</TableHead>
                <TableHead className="text-right">To Be Approved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, idx) => (
                <TableRow key={row.date}>
                  <TableCell>{row.date}</TableCell>
                  <TableCell className="text-right font-mono">{formatNumber(row.income)}</TableCell>
                  <TableCell className="flex justify-end">
                    <Input
                      type="number"
                      value={row.approvedIncome ?? ''}
                      onChange={(e) => handleInputChange(idx, 'approvedIncome', e.target.value)}
                      className="w-32 text-right font-mono"
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatNumber(row.cogs)}</TableCell>
                  <TableCell className="flex justify-end">
                    <Input
                      type="number"
                      value={row.approvedCogs ?? ''}
                      onChange={(e) => handleInputChange(idx, 'approvedCogs', e.target.value)}
                      className="w-32 text-right font-mono"
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatNumber(row.expense)}</TableCell>
                  <TableCell className="flex justify-end">
                    <Input
                      type="number"
                      value={row.approvedExpense ?? ''}
                      onChange={(e) => handleInputChange(idx, 'approvedExpense', e.target.value)}
                      className="w-32 text-right font-mono"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="text-right">
          <Button onClick={handleApprove} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Approve Forecast'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
