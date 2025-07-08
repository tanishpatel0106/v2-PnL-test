"use client"
import { useAuth } from "../../components/auth-provider"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import {
  ChevronDown,
  Building2,
  MapPin,
  Calendar,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarGridSelector } from "@/components/calendar-grid-selector"
import {
  fetchCompanyCodes,
  fetchSiteCodes,
  fetchAccountSummary,
  generateComment,
  approveComment,
  fetchForecast,
} from "@/lib/api"
import { MultiAccountDropdown } from "@/components/multi-account-selector"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { Check, RefreshCw } from "lucide-react"

const ADMIN_USERS = [
  "Admin.Tanish",
  "Admin.Bimal",
  "admin1@example.com",
  "admin2@example.com",
  "admin3@example.com",
]

const ADMIN_PASSWORD = "adminpass"

const YEARS = ["2023", "2024", "2025"]
const PERIODS = Array.from({ length: 12 }, (_, i) => `P${i + 1}`)

export default function AdminPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [authorized, setAuthorized] = useState(false)

  const [companyCode, setCompanyCode] = useState("")
  const [siteCode, setSiteCode] = useState("")
  const [periods, setPeriods] = useState<string[]>([])
  const [companies, setCompanies] = useState<{ value: string; label: string }[]>([])
  const [sites, setSites] = useState<{ value: string; label: string }[]>([])
  const [periodsOpen, setPeriodsOpen] = useState(false)
  const [selectedAccounts, setSelectedAccounts] = useState<{ id: string; uniqueId: string }[]>([])
  const [progress, setProgress] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentAccount, setCurrentAccount] = useState("")
  const [completed, setCompleted] = useState(false)

  const [fcCompanyCode, setFcCompanyCode] = useState("")
  const [fcSiteCode, setFcSiteCode] = useState("")
  const [fcYear, setFcYear] = useState("")
  const [fcPeriod, setFcPeriod] = useState("")
  const [fcSites, setFcSites] = useState<{ value: string; label: string }[]>([])
  const [fcProgress, setFcProgress] = useState(0)
  const [fcGenerating, setFcGenerating] = useState(false)
  const [fcCompleted, setFcCompleted] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push("/login")
    } else if (!ADMIN_USERS.includes(user)) {
      router.push("/")
    }
  }, [user])

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

  useEffect(() => {
    if (fcCompanyCode) {
      fetchSiteCodes(fcCompanyCode)
        .then((codes) =>
          setFcSites(codes.map((c) => ({ value: c, label: c })))
        )
        .catch(() => setFcSites([]))
    } else {
      setFcSites([])
    }
    setFcSiteCode("")
  }, [fcCompanyCode])

  if (!user || !ADMIN_USERS.includes(user)) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setAuthorized(true)
    } else {
      setPassword("")
    }
  }

  const handleAccountConfirm = (accs: { id: string; uniqueId: string }[]) => {
    setSelectedAccounts(accs)
  }

  const runGeneration = async () => {
    if (selectedAccounts.length === 0) return
    setIsGenerating(true)
    setCompleted(false)
    setProgress(0)
    for (let i = 0; i < selectedAccounts.length; i++) {
      const acc = selectedAccounts[i]
      setCurrentAccount(acc.id)
      try {
        const summaryRes = await fetchAccountSummary({
          accountNumber: acc.id,
          companyCode,
          siteCode,
          periods,
        })
        const gen = await generateComment({
          accountId: acc.uniqueId,
          companyCode,
          siteCode,
          periods,
          accountJson: summaryRes.summary,
        })
        await approveComment({
          accountId: acc.uniqueId,
          companyCode,
          siteCode,
          periods,
          comment: gen.summary,
          user: user || "AI.Admin",
        })
        setProgress(Math.round(((i + 1) / selectedAccounts.length) * 100))
      } catch {
        toast.error(`Failed for account ${acc.id}`)
      }
    }
    toast.success("Comments Generated and successfully Approved")
    setIsGenerating(false)
    setCompleted(true)
    setCurrentAccount("")
  }

  const runForecastGeneration = async () => {
    if (!fcCompanyCode || !fcSiteCode || !fcYear || !fcPeriod) return
    setFcGenerating(true)
    setFcProgress(0)
    setFcCompleted(false)
    const params = {
      companyCode: fcCompanyCode,
      siteCode: fcSiteCode,
      year: fcYear,
      period: fcPeriod,
    }
    const types: ("income" | "cogs" | "expense")[] = [
      "income",
      "cogs",
      "expense",
    ]
    for (let i = 0; i < types.length; i++) {
      try {
        await fetchForecast(types[i], params)
        setFcProgress(Math.round(((i + 1) / types.length) * 100))
      } catch {
        toast.error(`Failed to generate ${types[i]} forecast`)
      }
    }
    toast.success("Forecasts generated")
    setFcGenerating(false)
    setFcCompleted(true)
  }

  if (!authorized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 bg-white p-6 shadow rounded w-80"
        >
          <h1 className="text-xl font-bold text-center">Admin Panel</h1>
          <Input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" className="w-full">
            Enter
          </Button>
        </form>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen p-6 space-y-4">
      <h1 className="text-2xl font-bold text-center">Admin Panel</h1>

        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between"
            >
              PL Commentary Generation
              <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-x border-b rounded-b-md p-4 space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-500" />
                  Company Code
                </label>
                <Select
                  value={companyCode}
                  onValueChange={(v) => setCompanyCode(v)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select..." />
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
                <Select
                  value={siteCode}
                  onValueChange={(v) => setSiteCode(v)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select..." />
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
                  Periods
                </label>
                <Popover open={periodsOpen} onOpenChange={setPeriodsOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-40 justify-between" role="combobox" aria-expanded={periodsOpen}>
                      {periods.length > 0 ? `${periods.length} period(s)` : "Select..."}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 p-0">
                    <CalendarGridSelector defaultSelected={periods} onChange={(vals) => setPeriods(vals)} />
                  </PopoverContent>
                </Popover>
              </div>

              <MultiAccountDropdown
                companyCode={companyCode}
                siteCode={siteCode}
                disabled={!companyCode || !siteCode || periods.length === 0}
                onChange={handleAccountConfirm}
              />

              <Button
                onClick={runGeneration}
                disabled={
                  !companyCode ||
                  !siteCode ||
                  periods.length === 0 ||
                  selectedAccounts.length === 0 ||
                  isGenerating
                }
                className="p-2"
              >
                <Check className="w-4 h-4" />
              </Button>
            </div>

            {isGenerating && (
              <div className="space-y-2 w-full">
                <Progress value={progress} showPercentage />
                <div className="flex items-center justify-center gap-2 text-sm text-gray-700">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processing account {currentAccount}
                </div>
              </div>
            )}
            {completed && !isGenerating && (
              <div className="text-sm text-green-600 text-center">
                Comments Generated and successfully Approved
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between"
            >
              Monthly Generation
              <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-x border-b rounded-b-md p-4">
            <p>Coming Soon</p>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between"
            >
              Forecast Generation
              <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-x border-b rounded-b-md p-4 space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-500" />
                  Company Code
                </label>
                <Select value={fcCompanyCode} onValueChange={(v) => setFcCompanyCode(v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select..." />
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
                <Select value={fcSiteCode} onValueChange={(v) => setFcSiteCode(v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {fcSites.map((s) => (
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
                <Select value={fcYear} onValueChange={(v) => setFcYear(v)}>
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="Select..." />
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
                <Select value={fcPeriod} onValueChange={(v) => setFcPeriod(v)}>
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={runForecastGeneration}
                disabled={!fcCompanyCode || !fcSiteCode || !fcYear || !fcPeriod || fcGenerating}
                className="p-2"
              >
                <Check className="w-4 h-4" />
              </Button>
            </div>

            {fcGenerating && (
              <div className="space-y-2 w-full">
                <Progress value={fcProgress} showPercentage />
                <div className="flex items-center justify-center gap-2 text-sm text-gray-700">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating forecasts
                </div>
              </div>
            )}
            {fcCompleted && !fcGenerating && (
              <div className="text-sm text-green-600 text-center">Forecasts generated</div>
            )}
          </CollapsibleContent>
        </Collapsible>
    </div>
  )
}
