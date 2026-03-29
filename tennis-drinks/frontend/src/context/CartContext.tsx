import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import type { Drink } from '../types'
import api from '../api'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useToast } from '../components/Toast'

export interface CartItem {
  drink: Drink
  quantity: number
}

interface CartContextType {
  items: CartItem[]
  addItem: (drink: Drink, quantity?: number) => void
  removeItem: (drinkId: number) => void
  updateQuantity: (drinkId: number, quantity: number) => void
  clearCart: () => void
  totalItems: number
  totalPrice: number
  cartLoading: boolean
}

const CART_KEY = 'bruvi-cart-v1'

function loadLocal(): CartItem[] {
  try {
    const s = localStorage.getItem(CART_KEY)
    return s ? JSON.parse(s) : []
  } catch { return [] }
}

function saveLocal(items: CartItem[]) {
  try {
    if (items.length === 0) localStorage.removeItem(CART_KEY)
    else localStorage.setItem(CART_KEY, JSON.stringify(items))
  } catch {}
}

const CartContext = createContext<CartContextType>(null!)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadLocal)
  const [cartLoading, setCartLoading] = useState(false)
  const isOnline = useOnlineStatus()
  const { showToast } = useToast()
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialLoadDone = useRef(false)

  // Vom Server laden (einmalig nach Login / wenn Token vorhanden)
  const loadFromServer = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token || !isOnline) return
    try {
      setCartLoading(true)
      const { data } = await api.get('/cart')
      // Server-Antwort: [{drink_id, quantity, name, price, category, stock, unit, article_number, active}]
      const inactiveItems = data.filter((r: any) => r.active === 0)
      const serverItems: CartItem[] = data
        .filter((r: any) => r.active !== 0)
        .map((r: any) => ({
          drink: {
            id: r.drink_id,
            name: r.name,
            price: r.price,
            category: r.category,
            stock: r.stock,
            unit: r.unit,
            article_number: r.article_number,
            active: r.active,
          } as Drink,
          quantity: r.quantity,
        }))
      if (inactiveItems.length > 0) {
        const names = inactiveItems.map((r: any) => r.name).join(', ')
        showToast(
          `${inactiveItems.length} Getränk${inactiveItems.length > 1 ? 'e' : ''} nicht mehr verfügbar und aus deinem Warenkorb entfernt: ${names}`,
          'info'
        )
      }
      setItems(serverItems)
      saveLocal(serverItems)
    } catch {
      // Offline oder Fehler: localStorage-Version behalten
    } finally {
      setCartLoading(false)
    }
  }, [isOnline, showToast])

  // Beim Start einmalig vom Server laden
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true
      loadFromServer()
    }
  }, [loadFromServer])

  // Wenn wieder online: Server-Cart laden (neuester Stand von anderem Gerät)
  const wasOfflineRef = useRef(false)
  useEffect(() => {
    if (isOnline && wasOfflineRef.current) {
      loadFromServer()
    }
    wasOfflineRef.current = !isOnline
  }, [isOnline, loadFromServer])

  // Debounced Server-Sync (500ms nach letzter Änderung)
  const scheduleSyncToServer = useCallback((newItems: CartItem[]) => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(async () => {
      if (!isOnline) return
      try {
        await api.put('/cart', {
          items: newItems.map(i => ({ drink_id: i.drink.id, quantity: i.quantity }))
        })
      } catch {}
    }, 500)
  }, [isOnline])

  // Zentrale Setter-Funktion: localStorage sofort + Server debounced
  const applyItems = useCallback((newItems: CartItem[]) => {
    saveLocal(newItems)
    scheduleSyncToServer(newItems)
    return newItems
  }, [scheduleSyncToServer])

  const addItem = (drink: Drink, quantity = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.drink.id === drink.id)
      const next = existing
        ? prev.map(i => i.drink.id === drink.id
            ? { ...i, quantity: Math.min(i.drink.stock, i.quantity + quantity) }
            : i)
        : [...prev, { drink, quantity: Math.min(drink.stock, quantity) }]
      return applyItems(next)
    })
  }

  const removeItem = (drinkId: number) => {
    setItems(prev => applyItems(prev.filter(i => i.drink.id !== drinkId)))
  }

  const updateQuantity = (drinkId: number, quantity: number) => {
    if (quantity <= 0) { removeItem(drinkId); return }
    setItems(prev => applyItems(
      prev.map(i => i.drink.id === drinkId ? { ...i, quantity: Math.min(i.drink.stock, quantity) } : i)
    ))
  }

  const clearCart = () => {
    saveLocal([])
    setItems([])
    if (isOnline) {
      api.delete('/cart').catch(() => {})
    }
  }

  const totalItems = items.reduce((s, i) => s + i.quantity, 0)
  const totalPrice = items.reduce((s, i) => s + i.drink.price * i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, cartLoading }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
