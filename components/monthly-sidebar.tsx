"use client"
import { useState, useEffect } from "react"
import { Building2, MapPin, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { fetchMonthlyCompanyCodes, fetchMonthlySiteCodes } from "@/lib/api"

interface MonthlySidebarProps {
  onSelectionChange: (vals: { companyCode: string; siteCode: string; year: string; period: string }) => void
  onConfirm: (vals: { companyCode: string; siteCode: string; year: string; period: string }) => void
}

const YEARS = ["2023", "2024", "2025"]
const PERIODS = Array.from({ length: 12 }, (_, i) => `P${i + 1}`)

export function MonthlySidebar({ onSelectionChange, onConfirm }: MonthlySidebarProps) {
  const [companyCode, setCompanyCode] = useState("")
  const [siteCode, setSiteCode] = useState("")
  const [year, setYear] = useState("")
  const [period, setPeriod] = useState("")
  const [companies, setCompanies] = useState<{ value: string; label: string }[]>([])
  const [sites, setSites] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    fetchMonthlyCompanyCodes()
      .then((codes) => setCompanies(codes.map((c) => ({ value: c, label: c }))))
      .catch(() => setCompanies([]))
  }, [])

  useEffect(() => {
    if (companyCode) {
      fetchMonthlySiteCodes(companyCode)
        .then((codes) => setSites(codes.map((c) => ({ value: c, label: c }))))
        .catch(() => setSites([]))
    } else {
      setSites([])
    }
    setSiteCode("")
  }, [companyCode])

  const notifyChange = (c = companyCode, s = siteCode, y = year, p = period) => {
    onSelectionChange({ companyCode: c, siteCode: s, year: y, period: p })
  }

  return (
    <div className="fixed left-4 top-28 bottom-4 w-80 z-50 bg-gradient-to-br from-slate-50 to-white rounded-xl shadow-2xl border border-gray-200/50 flex flex-col backdrop-blur-sm">
      <div className="p-6 border-b border-gray-200/50">
        <h2 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">📅 Monthly Config</h2>
      </div>
      <div className="flex-1 p-6 space-y-4 overflow-y-auto">
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-500" />
            Company Code
          </label>
          <Select value={companyCode} onValueChange={(v) => { setCompanyCode(v); notifyChange(v, "", year, period) }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select company..." />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <MapPin className="w-4 h-4 text-green-500" />
            Site Code
          </label>
          <Select value={siteCode} onValueChange={(v) => { setSiteCode(v); notifyChange(companyCode, v, year, period) }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select site..." />
            </SelectTrigger>
            <SelectContent>
              {sites.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-500" />
            Year
          </label>
          <Select value={year} onValueChange={(v) => { setYear(v); notifyChange(companyCode, siteCode, v, period) }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select year..." />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-500" />
            Period
          </label>
          <Select value={period} onValueChange={(v) => { setPeriod(v); notifyChange(companyCode, siteCode, year, v) }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select period..." />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          className="w-full mt-4"
          onClick={() => onConfirm({ companyCode, siteCode, year, period })}
          disabled={!companyCode || !siteCode || !year || !period}
        >
          Confirm
        </Button>
      </div>
    </div>
  )
}
