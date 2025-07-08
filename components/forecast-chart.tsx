"use client"
import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { RefreshCw } from "lucide-react"
import { fetchForecast, fetchForecastActuals } from "@/lib/api"

interface ForecastChartProps {
  companyCode: string
  siteCode: string
  year: string
  period: string
}

interface ChartPoint {
  date: string
  incomeActual?: number
  incomeForecast?: number
  cogsActual?: number
  cogsForecast?: number
  expenseActual?: number
  expenseForecast?: number
}

export function ForecastChart({ companyCode, siteCode, year, period }: ForecastChartProps) {
  const [data, setData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(false)
  const lastParams = useRef("")

  useEffect(() => {
    if (!companyCode || !siteCode || !year || !period) return
    const key = `${companyCode}|${siteCode}|${year}|${period}`
    if (lastParams.current === key) return
    lastParams.current = key

    setLoading(true)
    Promise.all([
      fetchForecastActuals("income", { companyCode, siteCode, year, period }),
      fetchForecastActuals("cogs", { companyCode, siteCode, year, period }),
      fetchForecastActuals("expense", { companyCode, siteCode, year, period }),
      fetchForecast("income", { companyCode, siteCode, year, period }),
      fetchForecast("cogs", { companyCode, siteCode, year, period }),
      fetchForecast("expense", { companyCode, siteCode, year, period }),
    ])
      .then(([inAct, cAct, eAct, inFc, cFc, eFc]) => {
        const map: Record<string, ChartPoint> = {}
        inAct.actuals.forEach((row) => {
          map[row.date] = { ...(map[row.date] || { date: row.date }), incomeActual: row.actual }
        })
        cAct.actuals.forEach((row) => {
          map[row.date] = { ...(map[row.date] || { date: row.date }), cogsActual: row.actual }
        })
        eAct.actuals.forEach((row) => {
          map[row.date] = { ...(map[row.date] || { date: row.date }), expenseActual: row.actual }
        })
        inFc.forecast.forEach((row) => {
          map[row.date] = { ...(map[row.date] || { date: row.date }), incomeForecast: row.approved ?? row.forecast }
        })
        cFc.forecast.forEach((row) => {
          map[row.date] = { ...(map[row.date] || { date: row.date }), cogsForecast: row.approved ?? row.forecast }
        })
        eFc.forecast.forEach((row) => {
          map[row.date] = { ...(map[row.date] || { date: row.date }), expenseForecast: row.approved ?? row.forecast }
        })
        const arr = Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
        setData(arr)
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

  if (data.length === 0) return null

  const formatDate = (date: string) => {
    const d = new Date(date)
    return `P${d.getMonth() + 1}-${d.getFullYear()}`
  }

  const formatNumber = (n: number | undefined) =>
    n === undefined ? "-" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n)

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-r from-orange-50 to-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">📊 Actuals vs Forecast</CardTitle>
      </CardHeader>
      <CardContent className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatDate} />
            <YAxis />
            <Tooltip labelFormatter={formatDate} formatter={(v: any) => formatNumber(v as number)} />
            <Legend />
            <Line type="monotone" dataKey="incomeActual" stroke="#1d4ed8" dot={false} name="Income Actual" />
            <Line type="monotone" dataKey="incomeForecast" stroke="#1d4ed8" strokeDasharray="4 2" dot={false} name="Income Forecast" />
            <Line type="monotone" dataKey="cogsActual" stroke="#ea580c" dot={false} name="COGS Actual" />
            <Line type="monotone" dataKey="cogsForecast" stroke="#ea580c" strokeDasharray="4 2" dot={false} name="COGS Forecast" />
            <Line type="monotone" dataKey="expenseActual" stroke="#16a34a" dot={false} name="Expense Actual" />
            <Line type="monotone" dataKey="expenseForecast" stroke="#16a34a" strokeDasharray="4 2" dot={false} name="Expense Forecast" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
