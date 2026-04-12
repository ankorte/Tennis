import React, { createContext, useContext, useState, useEffect } from 'react'
import type { User } from '../types'

interface AuthContextType {
  user: User | null
  token: string | null
  login: (token: string, user: User) => void
  logout: () => void
  clearMustChangePin: () => void
  updateUser: (updates: Partial<User>) => void
  isAdmin: boolean
  isThekenwart: boolean
  isKassenwart: boolean
  mustChangePin: boolean
}

const AuthContext = createContext<AuthContextType>(null!)

function isTokenValid(tok: string | null): boolean {
  if (!tok) return false
  try {
    const payload = JSON.parse(atob(tok.split('.')[1]))
    return payload.exp * 1000 > Date.now()
  } catch { return false }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const tok = localStorage.getItem('token')
    if (!isTokenValid(tok)) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      return null
    }
    const u = localStorage.getItem('user')
    return u ? JSON.parse(u) : null
  })
  const [token, setToken] = useState<string | null>(() => {
    const tok = localStorage.getItem('token')
    if (!isTokenValid(tok)) return null
    return tok
  })

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

  const clearMustChangePin = () => {
    if (!user) return
    const updated = { ...user, must_change_pin: false }
    localStorage.setItem('user', JSON.stringify(updated))
    setUser(updated)
  }

  const updateUser = (updates: Partial<User>) => {
    if (!user) return
    const updated = { ...user, ...updates }
    localStorage.setItem('user', JSON.stringify(updated))
    setUser(updated)
  }

  const isAdmin = user?.role === 'admin'
  const isKassenwart = user?.role === 'kassenwart' || isAdmin
  const isThekenwart = user?.role === 'thekenwart' || isKassenwart
  const mustChangePin = user?.must_change_pin === true

  return (
    <AuthContext.Provider value={{ user, token, login, logout, clearMustChangePin, updateUser, isAdmin, isThekenwart, isKassenwart, mustChangePin }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
