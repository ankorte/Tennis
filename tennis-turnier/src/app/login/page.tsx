'use client'

import { Suspense, useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'

function LoginForm() {
  const { login } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Anmeldung fehlgeschlagen')
        return
      }

      login(data.token, {
        userId: data.user.id,
        name: data.user.name,
        email: data.user.email,
        rolle: data.user.rolle,
      })

      router.push(redirect)
    } catch {
      setError('Verbindungsfehler. Bitte versuchen Sie es erneut.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          E-Mail-Adresse
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="name@beispiel.de"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Passwort
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="Ihr Passwort"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-700 hover:bg-green-800 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Wird angemeldet...
          </span>
        ) : (
          'Anmelden'
        )}
      </button>

      <div className="text-center">
        <p className="text-sm text-gray-600">
          Noch kein Konto?{' '}
          <Link href="/registrieren" className="text-green-700 font-medium hover:text-green-800">
            Jetzt registrieren
          </Link>
        </p>
      </div>

    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="th-gradient px-6 py-8 text-white text-center">
          <div className="text-4xl mb-2">🎾</div>
          <h1 className="text-2xl font-bold">Anmelden</h1>
          <p className="text-green-100 text-sm mt-1">Tennis Turnier Manager</p>
        </div>

        <div className="p-6">
          <Suspense fallback={<div className="text-center text-gray-400 py-4">Lädt...</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
