"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

const YEARS = [2023, 2024, 2025]
const PERIODS = Array.from({ length: 12 }, (_, i) => `P${i + 1}`)

type Quarter = 1 | 2 | 3 | 4

interface CalendarGridSelectorProps {
  defaultSelected?: string[]
  onChange?: (selected: string[]) => void
}

export function CalendarGridSelector({ defaultSelected = [], onChange }: CalendarGridSelectorProps) {
  const [selected, setSelected] = useState<string[]>(defaultSelected)

  useEffect(() => {
    setSelected(defaultSelected)
  }, [defaultSelected])

  const toggle = (period: string, year: number) => {
    const value = `${period}-${year}`
    const isSelected = selected.includes(value)
    const next = isSelected
      ? selected.filter((v) => v !== value)
      : [...selected, value]
    setSelected(next)
    onChange?.(next)
  }

  const selectAll = () => {
    const all = YEARS.flatMap((y) => PERIODS.map((p) => `${p}-${y}`))
    setSelected(all)
    onChange?.(all)
  }

  const clearAll = () => {
    setSelected([])
    onChange?.([])
  }

  const selectCurrentYear = () => {
    const y = new Date().getFullYear()
    if (YEARS.includes(y)) {
      const vals = PERIODS.map((p) => `${p}-${y}`)
      setSelected(vals)
      onChange?.(vals)
    }
  }

  const selectQuarter = (q: Quarter) => {
    const start = (q - 1) * 3
    const quarterPeriods = PERIODS.slice(start, start + 3)
    const vals = YEARS.flatMap((y) => quarterPeriods.map((p) => `${p}-${y}`))
    setSelected(vals)
    onChange?.(vals)
  }

  const isSelected = (period: string, year: number) =>
    selected.includes(`${period}-${year}`)

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-r from-slate-50 to-white">
      <CardHeader>
        <CardTitle className="text-lg font-bold">Financial Periods</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={selectAll}>Select All</Button>
          <Button size="sm" variant="outline" onClick={clearAll}>Clear All</Button>
          <Button size="sm" variant="outline" onClick={selectCurrentYear}>Select Current Year</Button>
          <Button size="sm" variant="outline" onClick={() => selectQuarter(1)}>Select Q1</Button>
          <Button size="sm" variant="outline" onClick={() => selectQuarter(2)}>Select Q2</Button>
          <Button size="sm" variant="outline" onClick={() => selectQuarter(3)}>Select Q3</Button>
          <Button size="sm" variant="outline" onClick={() => selectQuarter(4)}>Select Q4</Button>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-sm font-medium">Year / Period</th>
                {PERIODS.map((p) => (
                  <th key={p} className="p-2 text-xs font-medium">{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {YEARS.map((year) => (
                <tr key={year} className="text-center">
                  <th className="p-2 text-sm font-semibold">{year}</th>
                  {PERIODS.map((period) => {
                    const value = `${period}-${year}`
                    const selectedState = isSelected(period, year)
                    return (
                      <td key={value} className="p-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => toggle(period, year)}
                                className={cn(
                                  "w-8 h-8 rounded-md border flex items-center justify-center text-xs",
                                  selectedState
                                    ? "bg-blue-500 text-white border-blue-500"
                                    : "bg-white hover:bg-gray-100"
                                )}
                              >
                                {selectedState ? <Check className="w-4 h-4" /> : period.replace("P", "")}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Period {period.replace("P", "")} of {year}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selected.map((v) => (
              <Badge key={v} variant="secondary" className="text-xs">
                {v}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
