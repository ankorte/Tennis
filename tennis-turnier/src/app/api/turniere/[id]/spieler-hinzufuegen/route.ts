import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthFromRequest, hashPassword } from '@/lib/auth'

// Admin: Spieler manuell zum Turnier hinzufügen
// Erstellt einen Account falls Email noch nicht existiert
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = getAuthFromRequest(request)
    if (!auth || auth.rolle !== 'admin') {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const turnierId = parseInt(params.id)
    const body = await request.json()
    const { name, email } = body

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'Name und Email sind erforderlich' }, { status: 400 })
    }

    const emailLower = email.trim().toLowerCase()

    const turnier = await prisma.turnier.findUnique({
      where: { id: turnierId },
      include: { _count: { select: { anmeldungen: true } } },
    })

    if (!turnier) {
      return NextResponse.json({ error: 'Turnier nicht gefunden' }, { status: 404 })
    }

    if (turnier.status !== 'anmeldung') {
      return NextResponse.json({ error: 'Turnier läuft bereits – keine Anmeldungen mehr möglich' }, { status: 400 })
    }

    if (turnier._count.anmeldungen >= turnier.maxSpieler) {
      return NextResponse.json({ error: 'Turnier ist voll (max. 16 Spieler)' }, { status: 400 })
    }

    // Spieler suchen oder neu anlegen
    let spieler = await prisma.spieler.findUnique({ where: { email: emailLower } })
    let created = false

    if (!spieler) {
      // Temporäres Passwort – Spieler kann es später ändern
      const tempPassword = await hashPassword(Math.random().toString(36).slice(-10))
      spieler = await prisma.spieler.create({
        data: {
          name: name.trim(),
          email: emailLower,
          passwortHash: tempPassword,
          rolle: 'spieler',
        },
      })
      created = true
    }

    // Prüfen ob schon angemeldet
    const existing = await prisma.anmeldung.findUnique({
      where: { turnierId_spielerId: { turnierId, spielerId: spieler.id } },
    })

    if (existing) {
      return NextResponse.json({ error: `${spieler.name} ist bereits angemeldet` }, { status: 409 })
    }

    const anmeldung = await prisma.anmeldung.create({
      data: { turnierId, spielerId: spieler.id },
      include: { spieler: { select: { id: true, name: true, email: true } } },
    })

    return NextResponse.json({
      anmeldung,
      accountCreated: created,
      message: created
        ? `Spieler "${spieler.name}" neu angelegt und angemeldet`
        : `Spieler "${spieler.name}" zum Turnier hinzugefügt`,
    }, { status: 201 })
  } catch (error) {
    console.error('Admin add player error:', error)
    return NextResponse.json({ error: 'Fehler beim Hinzufügen' }, { status: 500 })
  }
}
