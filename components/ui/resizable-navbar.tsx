import * as React from "react"
import { Menu, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"

import { cn } from "@/lib/utils"
import { Button, ButtonProps } from "@/components/ui/button"

export function Navbar({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = React.useState(false)
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100)
    onScroll()
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <nav
      role="navigation"
      className={cn(
        "top-0 z-[60] w-full bg-white transition-all md:sticky",
        scrolled && "backdrop-blur-md shadow"
      )}
    >
      {children}
    </nav>
  )
}

export function NavBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto hidden items-center justify-between py-4 md:flex">
      {children}
    </div>
  )
}

export function NavItems({
  items,
}: {
  items: { name: string; link: string }[]
}) {
  const pathname = usePathname()

  return (
    <ul
      role="menubar"
      className="flex items-center gap-x-4 overflow-x-auto overflow-y-hidden no-scrollbar"
    >
      {items.map((item, idx) => {
        const active = item.link === pathname
        return (
          <li key={idx} role="none">
            <Link
              role="menuitem"
              href={item.link}
              className={cn(
                'px-8 py-3 rounded-full bg-purple-500 text-white font-bold transition duration-200 hover:bg-white hover:text-black border-2 border-transparent hover:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500',
                active && 'border-purple-500 bg-white text-black'
              )}
              style={{ maxHeight: '30px', display: 'flex', alignItems: 'center' }}
            >
              {item.name}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function NavbarLogo() {
  return (
    <Link
      href="/"
      /* pill outline */
      className="inline-flex h-16 overflow-hidden"
    >
      {/* ───────────────  PART 1  ─────────────── */}
      <div className="flex items-center justify-center px-4">
        <Image src="logo-pt1.jpeg" alt="Company Logo" width={50} height={50} />
      </div>

      {/* ───────────────  PART 2 & 3  ─────────────── */}
      <div className="flex flex-col">
        {/* PART 2 – right-top logo */}
        <div className="flex flex-1 items-center justify-left">
          <Image src="logo-pt2.png" alt="Company Logo" width={130} height={40} />
        </div>

        {/* PART 3 – right-bottom title */}
        <div className="flex flex-1 items-center justify-left">
          <span className="whitespace-nowrap font-bold text-zinc-700 dark:text-zinc-100">
            P&amp;L&nbsp;Management&nbsp;Dashboard
          </span>
        </div>
      </div>
    </Link>
  )
}

export function NavbarButton({
  className,
  ...props
}: ButtonProps) {
  return <Button className={className} {...props} />
}

export function MobileNav({ children }: { children: React.ReactNode }) {
  return <div className="md:hidden">{children}</div>
}

export function MobileNavHeader({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between p-4">{children}</div>
}

interface ToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isOpen: boolean
}
export function MobileNavToggle({ isOpen, ...props }: ToggleProps) {
  return (
    <Button variant="ghost" size="icon" {...props}>
      {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </Button>
  )
}

export function MobileNavMenu({
  isOpen,
  children,
}: {
  isOpen: boolean
  children: React.ReactNode
  onClose?: () => void
}) {
  return (
    <div className={cn("border-t bg-white p-4", !isOpen && "hidden")}>{children}</div>
  )
}
