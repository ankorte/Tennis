'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface AuthUser {
  userId: number
  name: string
  email: string
  rolle: string
  token: string
}

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  login: (token: string, userData: Omit<AuthUser, 'token'>) => void
  logout: () => void
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
  isAdmin: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Load user from localStorage
    try {
      const token = localStorage.getItem('auth-token')
      const userData = localStorage.getItem('auth-user')

      if (token && userData) {
        const parsed = JSON.parse(userData)

        // Check token expiry
        const parts = token.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]))
          if (payload.exp && payload.exp > Date.now() / 1000) {
            setUser({ ...parsed, token })
          } else {
            // Token expired
            localStorage.removeItem('auth-token')
            localStorage.removeItem('auth-user')
            document.cookie = 'auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
          }
        }
      }
    } catch (e) {
      console.error('Error loading auth:', e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = (token: string, userData: Omit<AuthUser, 'token'>) => {
    const fullUser = { ...userData, token }
    setUser(fullUser)
    localStorage.setItem('auth-token', token)
    localStorage.setItem('auth-user', JSON.stringify(userData))
    // Set cookie for middleware
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString()
    document.cookie = `auth-token=${encodeURIComponent(token)}; expires=${expires}; path=/`
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('auth-token')
    localStorage.removeItem('auth-user')
    document.cookie = 'auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAdmin: user?.rolle === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
