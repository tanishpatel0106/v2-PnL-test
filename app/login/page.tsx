'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../components/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const { user, loginLocal, loginAzure } = useAuth()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) router.push('/')
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await loginLocal(username, password)
    if (!ok) setError('Invalid credentials')
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="p-6 bg-white shadow rounded w-80 space-y-4">
        <h1 className="text-xl font-bold text-center">Login</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" className="w-full">Login</Button>
        </form>
        <div className="text-center">
          <Button variant="outline" className="w-full" onClick={loginAzure}>Login with Azure AD</Button>
        </div>
      </div>
    </div>
  )
}
