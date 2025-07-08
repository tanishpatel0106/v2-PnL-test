'use client'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { PublicClientApplication, AuthenticationResult } from '@azure/msal-browser'

const CLIENT_ID = 'e2838e02-87d4-413f-bf65-de15a7da9acb'
const TENANT_ID = '12bd9b63-46f8-4092-a420-8df6f60703f7'
// Matches **exactly** what you added under “Single-page application” in Azure
// (no trailing slash).  Falls back to window.location.origin in dev,
// or you can set NEXT_PUBLIC_REDIRECT_URI="https://ai.pchase.com" in Vercel.
const REDIRECT_URI =
  process.env.NEXT_PUBLIC_REDIRECT_URI ||
  (typeof window !== 'undefined'
    ? window.location.origin          // http://localhost:3000 in dev
    : 'http://localhost:3000');
const SCOPES = ['User.Read']

const msalInstance = new PublicClientApplication({
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: REDIRECT_URI,
    postLogoutRedirectUri: REDIRECT_URI,   // optional but nice UX
  },
  cache: {
    cacheLocation: 'localStorage',         // tokens survive tab refresh
    storeAuthStateInCookie: false,         // set true only for legacy IE
  },
})

interface AuthContextValue {
  user: string | null
  loginLocal: (u: string, p: string) => Promise<boolean>
  loginAzure: () => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const USERS: Record<string, string> = {
  'Admin.Tanish': 'Tanish@123',
  'Admin.Bimal': 'Bimal@123',
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<string | null>(null)
  const [msalReady, setMsalReady] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) setUser(stored)

    // Initialize MSAL instance
    const initializeMsal = async () => {
      try {
        await msalInstance.initialize()

        // If the user already signed in during a previous tab, restore them
        const accounts = msalInstance.getAllAccounts()
        if (accounts.length) {
          const name = accounts[0].name || accounts[0].username
          setUser(name)
          localStorage.setItem('user', name)
        }

        setMsalReady(true)
      } catch (err) {
        console.error('MSAL initialization failed:', err)
      }
    }

    initializeMsal()
  }, [])

  const loginLocal = async (u: string, p: string) => {
    if (USERS[u] && USERS[u] === p) {
      setUser(u)
      localStorage.setItem('user', u)
      return true
    }
    return false
  }

  const loginAzure = async () => {
    if (!msalReady) {
      console.warn("MSAL is not ready yet.")
      return
    }
    try {
      const result: AuthenticationResult = await msalInstance.loginPopup({
        scopes: SCOPES,
        prompt: 'select_account',   // surfaces account-picker every time
      })
      const name =
        result.account?.name ?? result.account?.username ?? 'Unknown'
      setUser(name)
      localStorage.setItem('user', name)
    } catch (e) {
      console.error('Azure login failed:', e)
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('user')
    msalInstance.logoutPopup({ postLogoutRedirectUri: REDIRECT_URI }).catch(() => {})
  }

  const value: AuthContextValue = { user, loginLocal, loginAzure, logout }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('AuthContext not found')
  return ctx
}
