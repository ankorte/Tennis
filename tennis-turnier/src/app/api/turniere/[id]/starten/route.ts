import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthFromRequest } from '@/lib/auth'
import { generiereBracket } from '@/lib/bracket'

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

    const turnier = await prisma.turnier.findUnique({
      where: { id: turnierId },
      include: {
        anmeldungen: {
          include: { spieler: true },
          orderBy: { setzung: 'asc' },
        },
      },
    })

    if (!turnier) {
      return NextResponse.json({ error: 'Turnier nicht gefunden' }, { status: 404 })
    }

    if (turnier.status !== 'anmeldung') {
      return NextResponse.json(
        { error: 'Turnier kann nicht gestartet werden (falscher Status)' },
        { status: 400 }
      )
    }

    if (turnier.anmeldungen.length < 2) {
      return NextResponse.json(
        { error: 'Mindestens 2 Spieler sind für den Start erforderlich' },
        { status: 400 }
      )
    }

    // Get player IDs in seeding order
    const spielerIds = turnier.anmeldungen.map((a) => a.spielerId)

    // Generate the bracket
    const spiele = await generiereBracket(turnierId, spielerIds)

    // Update tournament status
    await prisma.turnier.update({
      where: { id: turnierId },
      data: { status: 'aktiv' },
    })

    return NextResponse.json({
      message: 'Turnier gestartet',
      spieleAnzahl: spiele.length,
    })
  } catch (error) {
    console.error('Start tournament error:', error)
    return NextResponse.json(
      { error: 'Fehler beim Starten des Turniers' },
      { status: 500 }
    )
  }
}
