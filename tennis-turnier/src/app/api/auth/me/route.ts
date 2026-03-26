import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthFromRequest(request)

    if (!auth) {
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      )
    }

    const spieler = await prisma.spieler.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        name: true,
        email: true,
        rolle: true,
        erstelltAm: true,
      },
    })

    if (!spieler) {
      return NextResponse.json(
        { error: 'Benutzer nicht gefunden' },
        { status: 404 }
      )
    }

    return NextResponse.json({ user: spieler })
  } catch (error) {
    console.error('Me error:', error)
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Benutzerdaten' },
      { status: 500 }
    )
  }
}
