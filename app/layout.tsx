import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '../components/auth-provider'
import { MainNavbar } from '../components/ui/MainNavbar'

export const metadata: Metadata = {
  title: 'PnL Management Accounts',
  description: 'Created by AI Division',
  generator: 'next.js',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <MainNavbar />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
