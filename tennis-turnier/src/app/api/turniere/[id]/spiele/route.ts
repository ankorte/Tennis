import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthFromRequest } from '@/lib/auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const turnierId = parseInt(params.id)

    const spiele = await prisma.spiel.findMany({
      where: { turnierId },
      include: {
        spieler1: { select: { id: true, name: true } },
        spieler2: { select: { id: true, name: true } },
        sieger: { select: { id: true, name: true } },
      },
      orderBy: [{ runde: 'asc' }, { spielNummer: 'asc' }],
    })

    return NextResponse.json({ spiele })
  } catch (error) {
    console.error('Get matches error:', error)
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Spiele' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = getAuthFromRequest(request)

    if (!auth || auth.rolle !== 'admin') {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const body = await request.json()
    const { spielId, platz, geplanteZeit } = body

    if (!spielId) {
      return NextResponse.json({ error: 'Spiel-ID erforderlich' }, { status: 400 })
    }

    const spiel = await prisma.spiel.update({
      where: { id: spielId },
      data: {
        ...(platz !== undefined && { platz }),
        ...(geplanteZeit !== undefined && {
          geplanteZeit: geplanteZeit ? new Date(geplanteZeit) : null,
        }),
      },
    })

    return NextResponse.json({ spiel })
  } catch (error) {
    console.error('Update match schedule error:', error)
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren des Spielplans' },
      { status: 500 }
    )
  }
}
