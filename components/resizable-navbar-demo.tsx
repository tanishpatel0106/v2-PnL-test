"use client"

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
import { useState } from "react"

export default function NavbarDemo() {
  const navItems = [
    { name: "P&L Analysis", link: "#pl" },
    { name: "Monthly Analysis", link: "#monthly" },
    { name: "BI Report", link: "#bi" },
  ]

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="relative w-full">
      <Navbar>
        {/* Desktop Navigation */}
        <NavBody>
          <NavbarLogo />
          <NavItems items={navItems} />
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-700">Signed in as Tanish</span>
            <NavbarButton variant="secondary" className="rounded-full">
              Logout
            </NavbarButton>
          </div>
        </NavBody>

        {/* Mobile Navigation */}
        <MobileNav>
          <MobileNavHeader>
            <NavbarLogo />
            <MobileNavToggle
              isOpen={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            />
          </MobileNavHeader>

          <MobileNavMenu
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
          >
            {navItems.map((item, idx) => (
              <a
                key={`mobile-link-${idx}`}
                href={item.link}
                onClick={() => setIsMobileMenuOpen(false)}
                className="relative text-zinc-700"
              >
                <span className="block">{item.name}</span>
              </a>
            ))}

            <NavbarButton
              onClick={() => {
                setIsMobileMenuOpen(false)
                // TODO: hook into your auth logout
              }}
              variant="secondary"
              className="w-full rounded-full"
            >
              Logout
            </NavbarButton>
            <span className="mt-2 w-full text-center text-sm text-zinc-500">
              Signed in as Tanish
            </span>
          </MobileNavMenu>
        </MobileNav>
      </Navbar>

      <DummyContent />
    </div>
  )
}

const DummyContent = () => (
  <div className="container mx-auto p-8 pt-24">
    <h1 className="mb-4 text-center text-3xl font-bold">
      Check the navbar at the top of the container
    </h1>
    <p className="mb-10 text-center text-sm text-zinc-500">
      For demo purpose we have kept the position as{" "}
      <span className="font-medium">Sticky</span>. Keep in mind that this
      component is <span className="font-medium">fixed</span> and will not move
      when scrolling.
    </p>
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="h-24 rounded-md bg-slate-100" />
      ))}
    </div>
  </div>
)
