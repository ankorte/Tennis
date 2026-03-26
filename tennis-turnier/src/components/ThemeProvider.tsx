'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'gruen' | 'blau' | 'lila' | 'orange' | 'dunkel'

export const THEMES: { value: Theme; label: string; emoji: string; preview: string }[] = [
  { value: 'gruen',  label: 'Tennis Grün', emoji: '🌿', preview: '#15803d' },
  { value: 'blau',   label: 'Ocean Blau',  emoji: '🌊', preview: '#1d4ed8' },
  { value: 'lila',   label: 'Royal Lila',  emoji: '💜', preview: '#7c3aed' },
  { value: 'orange', label: 'Sunset',      emoji: '🌅', preview: '#ea580c' },
  { value: 'dunkel', label: 'Dunkel',      emoji: '🌙', preview: '#334155' },
]

interface ThemeContextType {
  theme: Theme
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'gruen',
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('gruen')

  useEffect(() => {
    const saved = localStorage.getItem('app-theme') as Theme | null
    const valid = THEMES.map((t) => t.value)
    if (saved && valid.includes(saved)) {
      applyTheme(saved)
      setThemeState(saved)
    }
  }, [])

  function applyTheme(t: Theme) {
    document.documentElement.setAttribute('data-theme', t)
  }

  function setTheme(t: Theme) {
    setThemeState(t)
    localStorage.setItem('app-theme', t)
    applyTheme(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
