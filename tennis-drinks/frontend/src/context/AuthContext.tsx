import React, { createContext, useContext, useState, useEffect } from 'react'
import type { User } from '../types'

interface AuthContextType {
  user: User | null
  token: string | null
  login: (token: string, user: User) => void
  logout: () => void
  isAdmin: boolean
  isThekenwart: boolean
  isKassenwart: boolean
}

const AuthContext = createContext<AuthContextType>(null!)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const u = localStorage.getItem('user')
    return u ? JSON.parse(u) : null
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))

  const login = (tok: string, u: User) => {
    localStorage.setItem('token', tok)
    localStorage.setItem('user', JSON.stringify(u))
    setToken(tok)
    setUser(u)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  const isAdmin = user?.role === 'admin'
  const isKassenwart = user?.role === 'kassenwart' || isAdmin
  const isThekenwart = user?.role === 'thekenwart' || isKassenwart

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAdmin, isThekenwart, isKassenwart }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
