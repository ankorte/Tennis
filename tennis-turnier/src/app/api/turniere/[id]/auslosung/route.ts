import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthFromRequest } from '@/lib/auth'

// Setzt zufällige Setzungen für alle Spieler die noch keine haben
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
      include: { anmeldungen: { include: { spieler: { select: { id: true, name: true } } } } },
    })

    if (!turnier) return NextResponse.json({ error: 'Turnier nicht gefunden' }, { status: 404 })
    if (turnier.status !== 'anmeldung') {
      return NextResponse.json({ error: 'Auslosung nur während Anmeldephase möglich' }, { status: 400 })
    }

    const anmeldungen = turnier.anmeldungen
    // Shuffle aller Anmeldungen (Fisher-Yates)
    const shuffled = [...anmeldungen]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    // Setzungen 1..N vergeben
    await Promise.all(
      shuffled.map((a, idx) =>
        prisma.anmeldung.update({
          where: { id: a.id },
          data: { setzung: idx + 1 },
        })
      )
    )

    const result = shuffled.map((a, idx) => ({
      setzung: idx + 1,
      name: a.spieler?.name ?? '?',
      anmeldungId: a.id,
    }))

    return NextResponse.json({ auslosung: result })
  } catch (error) {
    console.error('Auslosung error:', error)
    return NextResponse.json({ error: 'Fehler bei der Auslosung' }, { status: 500 })
  }
}
