'use client'
import { useAuth } from './auth-provider'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const { user, logout } = useAuth()
  const router = useRouter()

  if (!user) return null

  const handle = () => {
    logout()
    router.push('/login')
  }

  return (
    <div className="absolute top-4 right-4 flex items-center gap-2 z-50">
      <span className="text-sm text-gray-700">{user}</span>
      <Button size="xs" variant="outline" onClick={handle}>
        Logout
      </Button>
    </div>
  )
}
