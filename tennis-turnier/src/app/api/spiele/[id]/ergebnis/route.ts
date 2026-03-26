import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthFromRequest } from '@/lib/auth'
import { verarbeiteErgebnis } from '@/lib/bracket'

// PATCH: Spiel als "laufend" markieren
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = getAuthFromRequest(request)
    if (!auth || auth.rolle !== 'admin') {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const spielId = parseInt(params.id)
    const spiel = await prisma.spiel.findUnique({ where: { id: spielId } })

    if (!spiel) {
      return NextResponse.json({ error: 'Spiel nicht gefunden' }, { status: 404 })
    }
    if (spiel.status !== 'ausstehend') {
      return NextResponse.json({ error: 'Nur ausstehende Spiele können gestartet werden' }, { status: 400 })
    }

    const updated = await prisma.spiel.update({
      where: { id: spielId },
      data: { status: 'laufend' },
    })

    return NextResponse.json({ spiel: updated })
  } catch (error) {
    console.error('Mark match laufend error:', error)
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = getAuthFromRequest(request)

    if (!auth || auth.rolle !== 'admin') {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const spielId = parseInt(params.id)
    const body = await request.json()
    const { ergebnis, siegerId } = body

    if (!siegerId) {
      return NextResponse.json({ error: 'Sieger-ID erforderlich' }, { status: 400 })
    }

    const spiel = await prisma.spiel.findUnique({
      where: { id: spielId },
    })

    if (!spiel) {
      return NextResponse.json({ error: 'Spiel nicht gefunden' }, { status: 404 })
    }

    if (spiel.status === 'abgeschlossen') {
      return NextResponse.json(
        { error: 'Ergebnis wurde bereits eingetragen' },
        { status: 400 }
      )
    }

    if (spiel.spieler1Id !== siegerId && spiel.spieler2Id !== siegerId) {
      return NextResponse.json(
        { error: 'Ungültiger Sieger - Spieler nicht in diesem Spiel' },
        { status: 400 }
      )
    }

    await verarbeiteErgebnis(spielId, siegerId, ergebnis || '')

    // Check if tournament is complete (GF finished)
    const gf = await prisma.spiel.findFirst({
      where: {
        turnierId: spiel.turnierId,
        runde: 'GF',
        status: 'abgeschlossen',
      },
    })

    if (gf) {
      await prisma.turnier.update({
        where: { id: spiel.turnierId },
        data: { status: 'abgeschlossen' },
      })
    }

    const updatedSpiel = await prisma.spiel.findUnique({
      where: { id: spielId },
      include: {
        spieler1: { select: { id: true, name: true } },
        spieler2: { select: { id: true, name: true } },
        sieger: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ spiel: updatedSpiel })
  } catch (error) {
    console.error('Submit result error:', error)
    return NextResponse.json(
      { error: 'Fehler beim Eintragen des Ergebnisses' },
      { status: 500 }
    )
  }
}
