import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import React, { Suspense } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { SyncProvider } from './context/SyncContext'
import Layout from './components/Layout'

// Kern-Seiten sofort laden (Login, Dashboard, Buchen)
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import BookPage from './pages/BookPage'
import CartPage from './pages/CartPage'
import RegisterPage from './pages/RegisterPage'

// Selten genutzte Seiten lazy laden – werden erst bei Bedarf geladen
const MyBookingsPage = React.lazy(() => import('./pages/MyBookingsPage'))
const DrinksPage = React.lazy(() => import('./pages/DrinksPage'))
const MembersPage = React.lazy(() => import('./pages/MembersPage'))
const InventoryPage = React.lazy(() => import('./pages/InventoryPage'))
const BillingPage = React.lazy(() => import('./pages/BillingPage'))
const BookingsAdminPage = React.lazy(() => import('./pages/BookingsAdminPage'))
const AdminCartsPage = React.lazy(() => import('./pages/AdminCartsPage'))
const ClubStatsPage = React.lazy(() => import('./pages/ClubStatsPage'))
const ImportPage = React.lazy(() => import('./pages/ImportPage'))
const SepaPage = React.lazy(() => import('./pages/SepaPage'))
const EmailPage = React.lazy(() => import('./pages/EmailPage'))
const DatabasePage = React.lazy(() => import('./pages/DatabasePage'))
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'))

// Lade-Spinner für lazy-geladene Seiten
function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-4 rounded-full animate-spin mb-3"
          style={{ borderColor: '#1A3B8F', borderTopColor: 'transparent' }} />
        <p className="text-sm text-gray-400">Laden...</p>
      </div>
    </div>
  )
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  return token ? <>{children}</> : <Navigate to="/login" />
}

// Error Boundary damit die App bei Fehlern nicht komplett weiß wird
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ color: '#1A3B8F' }}>Etwas ist schiefgelaufen</h2>
          <p style={{ color: '#666', margin: '0.5rem 0' }}>{this.state.error}</p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                // Service Worker entfernen + Cache leeren + neu laden
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(regs => {
                    regs.forEach(r => r.unregister())
                  })
                }
                if ('caches' in window) {
                  caches.keys().then(keys => {
                    Promise.all(keys.map(key => caches.delete(key))).then(() => location.reload())
                  })
                } else {
                  location.reload()
                }
              }}
              style={{
                padding: '0.75rem 2rem', background: '#1A3B8F',
                color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 'bold',
                cursor: 'pointer', fontSize: '1rem',
              }}>
              App neu laden
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('token')
                localStorage.removeItem('user')
                localStorage.removeItem('bruvi-cart-v1')
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(regs => {
                    regs.forEach(r => r.unregister())
                  })
                }
                const doRedirect = () => { (window as Window).location.href = '/login' }
                if ('caches' in window) {
                  caches.keys().then(keys => {
                    Promise.all(keys.map(key => caches.delete(key))).then(doRedirect)
                  })
                } else {
                  doRedirect()
                }
              }}
              style={{
                padding: '0.75rem 2rem', background: '#E8002D',
                color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 'bold',
                cursor: 'pointer', fontSize: '1rem',
              }}>
              Abmelden
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CartProvider>
          <SyncProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
                  <Route index element={<DashboardPage />} />
                  <Route path="book" element={<BookPage />} />
                  <Route path="cart" element={<CartPage />} />
                  <Route path="my-bookings" element={<Suspense fallback={<PageLoader />}><MyBookingsPage /></Suspense>} />
                  <Route path="drinks" element={<Suspense fallback={<PageLoader />}><DrinksPage /></Suspense>} />
                  <Route path="members" element={<Suspense fallback={<PageLoader />}><MembersPage /></Suspense>} />
                  <Route path="inventory" element={<Suspense fallback={<PageLoader />}><InventoryPage /></Suspense>} />
                  <Route path="billing" element={<Suspense fallback={<PageLoader />}><BillingPage /></Suspense>} />
                  <Route path="admin/bookings" element={<Suspense fallback={<PageLoader />}><BookingsAdminPage /></Suspense>} />
                  <Route path="admin/carts" element={<Suspense fallback={<PageLoader />}><AdminCartsPage /></Suspense>} />
                  <Route path="admin/stats" element={<Suspense fallback={<PageLoader />}><ClubStatsPage /></Suspense>} />
                  <Route path="import" element={<Suspense fallback={<PageLoader />}><ImportPage /></Suspense>} />
                  <Route path="sepa" element={<Suspense fallback={<PageLoader />}><SepaPage /></Suspense>} />
                  <Route path="email" element={<Suspense fallback={<PageLoader />}><EmailPage /></Suspense>} />
                  <Route path="database" element={<Suspense fallback={<PageLoader />}><DatabasePage /></Suspense>} />
                  <Route path="profile" element={<Suspense fallback={<PageLoader />}><ProfilePage /></Suspense>} />
                </Route>
              </Routes>
            </BrowserRouter>
          </SyncProvider>
        </CartProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
