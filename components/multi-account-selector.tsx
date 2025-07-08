"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ChevronDown } from "lucide-react"
import { fetchAccounts, AccountOption } from "@/lib/api"

interface MultiAccountDropdownProps {
  companyCode: string
  siteCode: string
  disabled: boolean
  onChange: (accounts: { id: string; uniqueId: string }[]) => void
}

export function MultiAccountDropdown({ companyCode, siteCode, disabled, onChange }: MultiAccountDropdownProps) {
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!disabled && companyCode && siteCode) {
      fetchAccounts(companyCode, siteCode)
        .then((accs) => {
          setAccounts(accs)
        })
        .catch(() => {
          setAccounts([])
        })
    } else {
      setAccounts([])
      setSelected([])
      onChange([])
    }
  }, [companyCode, siteCode, disabled])

  useEffect(() => {
    if (accounts.length > 0) {
      const defaults = accounts
        .filter((a) => Boolean(a.isAggregated))
        .map((a) => a.value)
      setSelected(defaults)
      const chosen = accounts
        .filter((a) => Boolean(a.isAggregated))
        .map((a) => ({ id: a.value, uniqueId: a.uniqueId }))
      onChange(chosen)
    } else {
      setSelected([])
      onChange([])
    }
  }, [accounts])

  const toggle = (value: string) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  const confirm = () => {
    const chosen = accounts
      .filter((a) => selected.includes(a.value))
      .map((a) => ({ id: a.value, uniqueId: a.uniqueId }))
    onChange(chosen)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-48 justify-between"
          disabled={disabled}
        >
          {selected.length > 0 ? `${selected.length} account(s)` : "Select accounts"}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2 space-y-2">
        <div className="max-h-60 overflow-y-auto space-y-1">
          {accounts.map((acc) => (
            <label key={acc.value} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.includes(acc.value)}
                onCheckedChange={() => toggle(acc.value)}
                disabled={disabled}
              />
              {acc.label}
            </label>
          ))}
        </div>
        <Button onClick={confirm} disabled={selected.length === 0} className="w-full">
          Apply
        </Button>
      </PopoverContent>
    </Popover>
  )
}
