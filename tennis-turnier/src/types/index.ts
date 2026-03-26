export interface Spieler {
  id: number
  name: string
  email: string
  rolle: string
  erstelltAm: string
}

export interface Turnier {
  id: number
  name: string
  beschreibung?: string | null
  status: 'anmeldung' | 'aktiv' | 'abgeschlossen'
  maxSpieler: number
  erstelltAm: string
  _count?: {
    anmeldungen: number
  }
  anmeldungen?: Anmeldung[]
  spiele?: Spiel[]
}

export interface Anmeldung {
  id: number
  turnierId: number
  spielerId: number
  setzung?: number | null
  angemeldetAm: string
  spieler?: Spieler
  turnier?: Turnier
}

export interface Spiel {
  id: number
  turnierId: number
  runde: string
  spielNummer: number
  spieler1Id?: number | null
  spieler2Id?: number | null
  siegerId?: number | null
  ergebnis?: string | null
  geplanteZeit?: string | null
  platz?: string | null
  status: 'ausstehend' | 'laufend' | 'abgeschlossen' | 'walkover'
  siegerSpielId?: number | null
  siegerSlot?: number | null
  verliererSpielId?: number | null
  verliererSlot?: number | null
  spieler1?: Spieler | null
  spieler2?: Spieler | null
  sieger?: Spieler | null
}

export interface AuthState {
  userId: number | null
  name: string | null
  email: string | null
  rolle: string | null
  token: string | null
  isLoading: boolean
}

export interface LoginResponse {
  token: string
  user: {
    id: number
    name: string
    email: string
    rolle: string
  }
}

export interface ApiError {
  error: string
}
