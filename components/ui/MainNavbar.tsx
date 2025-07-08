"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "../auth-provider"
import {
  Navbar,
  NavBody,
  NavItems,
  MobileNav,
  NavbarLogo,
  NavbarButton,
  MobileNavHeader,
  MobileNavToggle,
  MobileNavMenu,
} from "@/components/ui/resizable-navbar"

export function MainNavbar() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const adminUsers = [
    "Admin.Tanish",
    "Admin.Bimal",
    "admin1@example.com",
    "admin2@example.com",
    "admin3@example.com",
  ]

  if (!user) return null

  const navItems = [
    { name: "P&L Analysis", link: "/" },
    { name: "Monthly Analysis", link: "/monthly" },
    { name: "Monthly Forecast", link: "/forecast" },
    { name: "BI Report", link: "/bi" },
  ]

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const handleAdminPanel = () => {
    router.push("/admin")
  }

  return (
    <Navbar>
      <NavBody>
        <NavbarLogo />
        <NavItems items={navItems} />
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-700">Signed in as {user}</span>
          <div className="flex flex-col">
            <NavbarButton
              size="xs"
              variant="secondary"
              onClick={handleLogout}
              className="rounded-full"
            >
              Logout
            </NavbarButton>
            {adminUsers.includes(user) && (
              <NavbarButton
                size="xs"
                variant="secondary"
                onClick={handleAdminPanel}
                className="rounded-full mt-2"
              >
                Admin Panel
              </NavbarButton>
            )}
          </div>
        </div>
      </NavBody>
      <MobileNav>
        <MobileNavHeader>
          <NavbarLogo />
          <MobileNavToggle isOpen={open} onClick={() => setOpen(!open)} />
        </MobileNavHeader>
        <MobileNavMenu isOpen={open} onClose={() => setOpen(false)}>
          {navItems.map((item, idx) => (
            <Link
              key={idx}
              href={item.link}
              onClick={() => setOpen(false)}
              className="relative text-zinc-700"
            >
              <span className="block">{item.name}</span>
            </Link>
          ))}
          <NavbarButton
            onClick={() => {
              setOpen(false)
              handleLogout()
            }}
            variant="secondary"
            className="w-full rounded-full"
          >
            Logout
          </NavbarButton>
          {adminUsers.includes(user) && (
            <NavbarButton
              onClick={() => {
                setOpen(false)
                handleAdminPanel()
              }}
              variant="secondary"
              className="w-full rounded-full mt-2"
            >
              Admin Panel
            </NavbarButton>
          )}
          <span className="mt-2 w-full text-center text-sm text-zinc-500">
            Signed in as {user}
          </span>
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  )
}
