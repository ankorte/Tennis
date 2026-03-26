import type { Metadata } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'
import { AuthProvider } from '@/components/AuthProvider'
import { ThemeProvider } from '@/components/ThemeProvider'

export const metadata: Metadata = {
  title: 'Tennis Turnier Manager',
  description: 'Verwalten Sie Ihre Tennis Turniere mit Double Elimination Brackets',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de">
      <body className="bg-gray-50 min-h-screen">
        <ThemeProvider>
          <AuthProvider>
            <Navigation />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
            <footer className="mt-16 th-nav text-white py-6">
              <div className="max-w-7xl mx-auto px-4 text-center">
                <p className="th-text-nav text-sm">
                  🎾 Tennis Turnier Manager — Double Elimination Brackets
                </p>
              </div>
            </footer>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
