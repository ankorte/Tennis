export interface User {
  id: number
  member_number: string
  first_name: string
  last_name: string
  email?: string
  role: 'mitglied' | 'thekenwart' | 'kassenwart' | 'admin'
  team?: string
}

export interface Drink {
  id: number
  article_number: string
  name: string
  category: string
  price: number
  stock: number
  min_stock: number
  unit: string
  active: number
  purchase_price?: number
  deposit?: number
  vat_rate?: number
}

export interface Member {
  id: number
  member_number: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  status: string
  role: string
  team?: string
  active: number
  iban?: string
  bic?: string
  mandate_ref?: string
  mandate_date?: string
  daily_limit?: number | null
}

export interface Booking {
  id: number
  drink_id: number
  drink_name: string
  drink_category: string
  member_id?: number
  member_name?: string
  group_id?: number
  group_name?: string
  quantity: number
  unit_price: number
  total_price: number
  booking_type: string
  status: string
  created_by: number
  created_by_name: string
  created_at: string
  cancelled: number
  guest_note?: string
}

export interface Group {
  id: number
  name: string
  group_type: string
  status: string
  created_by_name: string
  member_count: number
  booking_count: number
  created_at: string
}

export const CATEGORY_LABELS: Record<string, string> = {
  bier: '🍺 Bier',
  softdrinks: '🥤 Softdrinks',
  wasser: '💧 Wasser',
  wein_sekt: '🍷 Wein/Sekt',
  kaffee: '☕ Kaffee',
  sonstiges: '🍽️ Sonstiges',
}

export const STATUS_COLORS: Record<string, string> = {
  bestaetigt: 'bg-green-100 text-green-800',
  offen_gruppe: 'bg-yellow-100 text-yellow-800',
  verteilt: 'bg-blue-100 text-blue-800',
  storniert: 'bg-red-100 text-red-800',
  abgerechnet: 'bg-gray-100 text-gray-800',
}
