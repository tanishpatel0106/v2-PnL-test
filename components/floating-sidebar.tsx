"use client"

import { useState, useEffect, ChangeEvent } from "react"
import { Building2, MapPin, Calendar, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { fetchCompanyCodes, fetchSiteCodes } from "@/lib/api"
import { CalendarGridSelector } from "./calendar-grid-selector"

interface FloatingSidebarProps {
  onSelectionChange: (selections: {
    companyCode: string
    siteCode: string
    periods: string[]
    companyInfo: string
  }) => void
  onConfirm: (selections: {
    companyCode: string
    siteCode: string
    periods: string[]
    companyInfo: string
  }) => void
}

export function FloatingSidebar({ onSelectionChange, onConfirm }: FloatingSidebarProps) {
  const [companyCode, setCompanyCode] = useState("")
  const [siteCode, setSiteCode] = useState("")
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([])
  const [isPeriodsOpen, setIsPeriodsOpen] = useState(false)
  const [companies, setCompanies] = useState<{ value: string; label: string }[]>([])
  const [sites, setSites] = useState<{ value: string; label: string }[]>([])
  const [companyInfo, setCompanyInfo] = useState("")

  useEffect(() => {
    fetchCompanyCodes()
      .then((codes) =>
        setCompanies(codes.map((c) => ({ value: c, label: c })))
      )
      .catch(() => setCompanies([]))
  }, [])

  useEffect(() => {
    if (companyCode) {
      fetchSiteCodes(companyCode)
        .then((codes) =>
          setSites(codes.map((c) => ({ value: c, label: c })))
        )
        .catch(() => setSites([]))
    } else {
      setSites([])
    }
    setSiteCode("")
  }, [companyCode])


  const handleCompanyChange = (value: string) => {
    setCompanyCode(value)
    onSelectionChange({
      companyCode: value,
      siteCode: "",
      periods: selectedPeriods,
      companyInfo,
    })
  }

  const handleSiteChange = (value: string) => {
    setSiteCode(value)
    onSelectionChange({
      companyCode,
      siteCode: value,
      periods: selectedPeriods,
      companyInfo,
    })
  }

  const handleCompanyInfoChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setCompanyInfo(e.target.value)
    onSelectionChange({ companyCode, siteCode, periods: selectedPeriods, companyInfo: e.target.value })
  }

  return (
    <div className="fixed left-4 top-28 bottom-4 w-80 z-50 bg-gradient-to-br from-slate-50 to-white rounded-xl shadow-2xl border border-gray-200/50 flex flex-col backdrop-blur-sm">
      <div className="p-6 border-b border-gray-200/50">
        <h2 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          📊 P&L Configuration
        </h2>
      </div>
      <div className="flex-1 p-6 space-y-4 overflow-y-auto">
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-500" />
            Company Code
          </label>
          <Select value={companyCode} onValueChange={handleCompanyChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select company..." />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.value} value={company.value}>
                  {company.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <MapPin className="w-4 h-4 text-green-500" />
            Site Code
          </label>
          <Select value={siteCode} onValueChange={handleSiteChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select site..." />
            </SelectTrigger>
            <SelectContent>
              {sites.map((site) => (
                <SelectItem key={site.value} value={site.value}>
                  {site.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-500" />
            Periods & Years
          </label>
          <Popover open={isPeriodsOpen} onOpenChange={setIsPeriodsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                role="combobox"
                aria-expanded={isPeriodsOpen}
              >
                {selectedPeriods.length > 0 ? `${selectedPeriods.length} period(s) selected` : "Select periods..."}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0">
              <CalendarGridSelector
                defaultSelected={selectedPeriods}
                onChange={(vals) => {
                  setSelectedPeriods(vals)
                  onSelectionChange({
                    companyCode,
                    siteCode,
                    periods: vals,
                    companyInfo,
                  })
                }}
              />
            </PopoverContent>
          </Popover>

        {selectedPeriods.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {selectedPeriods.map((period) => (
              <Badge key={period} variant="secondary" className="text-xs">
                {period}
              </Badge>
            ))}
          </div>
        )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Company Instructions</label>
          <Textarea
            value={companyInfo}
            onChange={handleCompanyInfoChange}
            placeholder="Add any company-specific instructions..."
            className="min-h-20"
          />
        </div>
        <Button
          className="w-full mt-4"
          onClick={() =>
            onConfirm({
              companyCode,
              siteCode,
              periods: selectedPeriods,
              companyInfo,
            })
          }
          disabled={
            !companyCode || !siteCode || selectedPeriods.length === 0
          }
        >
          Confirm
        </Button>
      </div>
    </div>
  )
}
